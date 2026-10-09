<script setup lang="ts">
import type { UnlistenFn } from '@tauri-apps/api/event'
import type { MotionInfo } from 'easy-live2d'

import { convertFileSrc, invoke } from '@tauri-apps/api/core'
import { PhysicalSize } from '@tauri-apps/api/dpi'
import { listen } from '@tauri-apps/api/event'
import { CheckMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu } from '@tauri-apps/api/menu'
import { sep } from '@tauri-apps/api/path'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { exists, readDir } from '@tauri-apps/plugin-fs'
import { useDebounceFn, useEventListener } from '@vueuse/core'
import { round } from 'es-toolkit'
import { nth } from 'es-toolkit/compat'
import { onMounted, onUnmounted, ref, watch } from 'vue'

import type { AngryAnimationIntensity } from '@/utils/angryAnimation'
import type { AngryEffectInstance } from '@/utils/angryEffectEngine'
import type { CharacterAmbientSnapshot, CharacterPresentationTransition } from '@/utils/characterPresentation'
import type { GuitarNote } from '@/utils/guitarEffectEngine'
import type { GuitarMotifId } from '@/utils/guitarMotifs'
import type { GuitarPerformanceProfile, GuitarPerformanceTemplateId } from '@/utils/guitarPerformance'

import { useAppMenu } from '@/composables/useAppMenu'
import { useDevice } from '@/composables/useDevice'
import { useGamepad } from '@/composables/useGamepad'
import { useModel } from '@/composables/useModel'
import { useTauriListen } from '@/composables/useTauriListen'
import { INVOKE_KEY, LISTEN_KEY } from '@/constants'
import { hideWindow, setAlwaysOnTop, setTaskbarVisibility, showWindow } from '@/plugins/window'
import { useCatStore } from '@/stores/cat'
import { useGeneralStore } from '@/stores/general.ts'
import { useModelStore } from '@/stores/model'
import { CharacterPresentationController } from '@/utils/characterPresentationController'
import { CharacterStateCoordinator } from '@/utils/characterStateCoordinator'
import { GUITAR_MOTIF_CATALOG } from '@/utils/guitarMotifs'
import { GUITAR_CONTINUE_TEMPLATE_ID, GUITAR_INPUT_BASELINE_TEMPLATE_ID, GUITAR_SOFT_CLOSE_TEMPLATE_ID } from '@/utils/guitarPerformance'
import { isImage } from '@/utils/is'
import live2d from '@/utils/live2d'
import { MikuCatPresentationConsumer } from '@/utils/mikuCatPresentationConsumer'
import { join } from '@/utils/path'
import { isWindows } from '@/utils/platform'
import { clearObject } from '@/utils/shared'

import AngryEffectLayer from './AngryEffectLayer.vue'
import GuitarNoteLayer from './GuitarNoteLayer.vue'

const appWindow = getCurrentWebviewWindow()
const { modelSize, handleLoad, handleDestroy, handleResize, handleKeyChange } = useModel()
const catStore = useCatStore()
const { getBaseMenu, getExitMenu } = useAppMenu()
const modelStore = useModelStore()
const generalStore = useGeneralStore()
const resizing = ref(false)
const backgroundImagePath = ref<string>()
const { stickActive } = useGamepad()
const presentationController = new CharacterPresentationController()
const guitarNotes = ref<readonly GuitarNote[]>([])
const angryEffects = ref<readonly AngryEffectInstance[]>([])
const presentationClock = () => performance.now()
const deadlineRuntime = {
  setTimeout: (callback: () => void, delayMs: number) => window.setTimeout(callback, delayMs),
  clearTimeout: (handle: unknown) => window.clearTimeout(handle as number),
}
const presentationConsumer = new MikuCatPresentationConsumer(live2d, presentationClock, Math.random, {
  ...deadlineRuntime,
  onEffectsChange(snapshot) {
    guitarNotes.value = snapshot.guitarNotes
    angryEffects.value = snapshot.angryEffects
  },
})
const stateCoordinator = new CharacterStateCoordinator(presentationClock, {
  ...deadlineRuntime,
  onUpdate: update => presentationConsumer.apply(update),
})
let presentationUnlisten: UnlistenFn | undefined
let presentationReady = false
let presentationDisposed = false
const { startListening } = useDevice({ onKeyboardPress: handleGuitarKeyPress })
const angryDebugIntensities: readonly AngryAnimationIntensity[] = ['annoyed', 'impatient', 'furious']
const guitarDebugProfiles = ['autonomous', 'engaged', 'groove', 'drive'] as const
const guitarDebugMotifs: readonly { text: string, motifId?: GuitarMotifId }[] = [
  { text: 'AUTO (PLANNER)' },
  ...GUITAR_MOTIF_CATALOG.map(motif => ({
    text: `${motif.homeProfile.toUpperCase()} / ${motif.label}`,
    motifId: motif.id,
  })),
]
const guitarDebugTemplates: readonly { text: string, templateId?: GuitarPerformanceTemplateId }[] = [
  { text: 'PROFILE DEFAULT' },
  { text: 'CONTINUE', templateId: GUITAR_CONTINUE_TEMPLATE_ID },
  { text: 'SOFT CLOSE', templateId: GUITAR_SOFT_CLOSE_TEMPLATE_ID },
  { text: 'ACCENT CLOSE', templateId: GUITAR_INPUT_BASELINE_TEMPLATE_ID },
]
const guitarDebugActivity: Record<GuitarPerformanceProfile, number> = {
  autonomous: 0,
  engaged: 0.25,
  groove: 0.6,
  drive: 1,
}

function setAngryDebugIntensity(intensity: AngryAnimationIntensity) {
  if (!presentationController.manualControlAllowed) return false

  return live2d.setAngryAnimationIntent({ intensity })
}

function setGuitarDebugProfile(profile: GuitarPerformanceProfile, activity = guitarDebugActivity[profile], releasing = false) {
  if (!presentationController.manualControlAllowed) return false

  return live2d.setGuitarPerformanceIntent({ profile, activity, releasing })
}

function setGuitarDebugReleasing(releasing: boolean) {
  const { profile } = live2d.guitarPerformanceSnapshot.requestedIntent
  const activity = releasing
    ? Math.min(guitarDebugActivity[profile], 0.15)
    : guitarDebugActivity[profile]
  return setGuitarDebugProfile(profile, activity, releasing)
}

function setGuitarDebugTemplate(templateId?: GuitarPerformanceTemplateId) {
  if (!presentationController.manualControlAllowed) return false

  return live2d.setGuitarPerformanceTemplateOverride(templateId)
}

function setGuitarDebugMotifPreview(motifId?: GuitarMotifId) {
  if (!presentationController.manualControlAllowed) return false

  return live2d.setGuitarMotifPreview(motifId)
}

function playCompletionDebugAnimation() {
  if (!presentationController.manualControlAllowed) return false

  return live2d.playCompletionAnimation()
}

if (import.meta.env.DEV) {
  Object.assign(window, {
    __BONGO_CAT_ANGRY_DEBUG__: {
      set: setAngryDebugIntensity,
      effect: {
        snapshot() {
          return presentationConsumer.angryEffects
        },
      },
      snapshot() {
        return live2d.angryAnimationSnapshot
      },
    },
    __BONGO_CAT_GUITAR_DEBUG__: {
      set: setGuitarDebugProfile,
      setTemplate: setGuitarDebugTemplate,
      previewMotif: setGuitarDebugMotifPreview,
      snapshot() {
        return live2d.guitarPerformanceSnapshot
      },
    },
    __BONGO_CAT_COMPLETION_DEBUG__: {
      play: playCompletionDebugAnimation,
      snapshot() {
        return live2d.completionAnimationSnapshot
      },
    },
  })
}

onMounted(() => {
  startListening()
  void startPresentationController()
})

onUnmounted(() => {
  presentationDisposed = true
  presentationUnlisten?.()
  stateCoordinator.dispose()
  presentationConsumer.dispose()
  guitarNotes.value = []
  angryEffects.value = []
  if (import.meta.env.DEV) {
    for (const key of ['__BONGO_CAT_ANGRY_DEBUG__', '__BONGO_CAT_GUITAR_DEBUG__', '__BONGO_CAT_COMPLETION_DEBUG__']) {
      Reflect.deleteProperty(window, key)
    }
  }
  handleDestroy()
})

const debouncedResize = useDebounceFn(async () => {
  await handleResize()

  resizing.value = false
}, 100)

useEventListener('resize', () => {
  resizing.value = true

  debouncedResize()
})

watch(() => modelStore.currentModel, async (model) => {
  applyPresentationTransition(presentationController.setModel(undefined))

  if (!model) {
    backgroundImagePath.value = undefined
    handleDestroy()
    return
  }

  await handleLoad()

  if (presentationDisposed) {
    handleDestroy()
    return
  }
  if (modelStore.currentModel?.id !== model.id) return

  const path = join(model.path, 'resources', 'background.png')

  const existed = await exists(path)

  if (presentationDisposed || modelStore.currentModel?.id !== model.id) return

  backgroundImagePath.value = existed ? convertFileSrc(path) : void 0

  clearObject([modelStore.supportKeys, modelStore.pressedKeys])

  const resourcePath = join(model.path, 'resources')
  const groups = ['left-keys', 'right-keys']

  for await (const groupName of groups) {
    const groupDir = join(resourcePath, groupName)
    const files = await readDir(groupDir).catch(() => [])
    if (presentationDisposed || modelStore.currentModel?.id !== model.id) return

    const imageFiles = files.filter(file => isImage(file.name))

    for (const file of imageFiles) {
      const fileName = file.name.split('.')[0]

      modelStore.supportKeys[fileName] = join(groupDir, file.name)
    }
  }

  modelStore.modelReady = true
  applyPresentationTransition(presentationController.setModel(model))
}, { deep: true, immediate: true })

watch([() => catStore.window.scale, modelSize], async ([scale, modelSize]) => {
  if (!modelSize) return

  const { width, height } = modelSize

  appWindow.setSize(
    new PhysicalSize({
      width: Math.round(width * (scale / 100)),
      height: Math.round(height * (scale / 100)),
    }),
  )
}, { immediate: true })

watch([modelStore.pressedKeys, stickActive], ([keys, stickActive]) => {
  const dirs = Object.values(keys).map((path) => {
    return nth(path.split(sep()), -2)!
  })

  const hasLeft = dirs.some(dir => dir.startsWith('left'))
  const hasRight = dirs.some(dir => dir.startsWith('right'))

  handleKeyChange(true, stickActive.left || hasLeft)
  handleKeyChange(false, stickActive.right || hasRight)
}, { deep: true })

watch(() => catStore.window.visible, async (value) => {
  value ? showWindow() : hideWindow()
})

watch(() => catStore.window.passThrough, (value) => {
  appWindow.setIgnoreCursorEvents(value)
}, { immediate: true })

watch(() => catStore.window.alwaysOnTop, setAlwaysOnTop, { immediate: true })

watch(() => generalStore.app.taskbarVisible, setTaskbarVisibility, { immediate: true })

watch(() => generalStore.app.agentModelControlEnabled, (enabled) => {
  if (!presentationReady) return

  applyPresentationTransition(presentationController.setAgentRequested(enabled))
})

watch(() => catStore.model.motionSound, live2d.setMotionSoundEnabled, { immediate: true })

watch(() => catStore.model.maxFPS, live2d.setMaxFPS, { immediate: true })

useTauriListen<MotionInfo>(LISTEN_KEY.START_MOTION, ({ payload }) => {
  if (!presentationController.manualControlAllowed) return

  live2d.startMotion(payload)
})

useTauriListen<number>(LISTEN_KEY.SET_EXPRESSION, ({ payload }) => {
  if (!presentationController.manualControlAllowed) return

  live2d.setExpression(payload)
})

async function startPresentationController() {
  const unlisten = await listen<CharacterAmbientSnapshot>(
    LISTEN_KEY.CODEX_AMBIENT_SNAPSHOT,
    ({ payload }) => restorePresentationSnapshot(payload),
  ).catch(() => undefined)

  if (!unlisten) return
  if (presentationDisposed) {
    unlisten()
    return
  }

  presentationUnlisten = unlisten

  const snapshot = await invoke<CharacterAmbientSnapshot>(
    INVOKE_KEY.GET_CODEX_AMBIENT_SNAPSHOT,
  ).catch(() => undefined)

  if (snapshot) restorePresentationSnapshot(snapshot)
}

function restorePresentationSnapshot(snapshot: CharacterAmbientSnapshot) {
  if (presentationDisposed) return

  applyPresentationTransition(presentationController.applyAmbient(snapshot))
  if (presentationReady) return

  presentationReady = true
  applyPresentationTransition(
    presentationController.setAgentRequested(generalStore.app.agentModelControlEnabled),
  )
}

function applyPresentationTransition(transition: CharacterPresentationTransition) {
  if (presentationDisposed) return
  if (import.meta.env.DEV && transition.previous.owner === 'manual' && transition.current.owner === 'agent') {
    live2d.setGuitarPerformanceTemplateOverride()
    live2d.setGuitarMotifPreview()
  }

  presentationConsumer.apply(stateCoordinator.applyPresentation(transition))
}

function handleGuitarKeyPress() {
  if (presentationDisposed) return

  presentationConsumer.apply(stateCoordinator.press(stateCoordinator.snapshot.presentation.generation))
}

function handleMouseDown() {
  appWindow.startDragging()
}

async function handleContextmenu(event: MouseEvent) {
  event.preventDefault()

  if (event.shiftKey) return

  const guitarDebugItems = import.meta.env.DEV && presentationController.manualControlAllowed
    ? [
        await PredefinedMenuItem.new({ item: 'Separator' }),
        await Submenu.new({
          text: 'Guitar profile (dev)',
          items: await Promise.all(guitarDebugProfiles.map((profile) => {
            return CheckMenuItem.new({
              text: profile.toUpperCase(),
              checked: live2d.guitarPerformanceSnapshot.requestedIntent.profile === profile,
              action: () => setGuitarDebugProfile(profile),
            })
          })),
        }),
        await Submenu.new({
          text: 'Guitar release (dev)',
          items: await Promise.all([
            { text: 'ACTIVE', releasing: false },
            { text: 'RELEASING (LOW ACTIVITY)', releasing: true },
          ].map(({ text, releasing }) => {
            return CheckMenuItem.new({
              text,
              checked: live2d.guitarPerformanceSnapshot.requestedIntent.releasing === releasing,
              action: () => setGuitarDebugReleasing(releasing),
            })
          })),
        }),
        await Submenu.new({
          text: 'Guitar template (dev)',
          items: await Promise.all(guitarDebugTemplates.map(({ text, templateId }) => {
            return CheckMenuItem.new({
              text,
              checked: live2d.guitarPerformanceSnapshot.templateOverride === templateId,
              action: () => setGuitarDebugTemplate(templateId),
            })
          })),
        }),
        await Submenu.new({
          text: 'Guitar motif insertion (dev)',
          items: await Promise.all(guitarDebugMotifs.map(({ text, motifId }) => {
            return CheckMenuItem.new({
              text,
              checked: live2d.guitarPerformanceSnapshot.requestedMotifPreview === motifId,
              action: () => setGuitarDebugMotifPreview(motifId),
            })
          })),
        }),
      ]
    : []

  const angryDebugItems = import.meta.env.DEV && presentationController.manualControlAllowed
    ? [
        await Submenu.new({
          text: 'Angry intensity (dev)',
          items: await Promise.all(angryDebugIntensities.map((intensity) => {
            return CheckMenuItem.new({
              text: intensity.toUpperCase(),
              checked: live2d.angryAnimationSnapshot.requestedIntent.intensity === intensity,
              action: () => setAngryDebugIntensity(intensity),
            })
          })),
        }),
      ]
    : []

  const completionDebugItems = import.meta.env.DEV && presentationController.manualControlAllowed
    ? [
        await MenuItem.new({
          text: 'Play completion animation (dev)',
          action: playCompletionDebugAnimation,
        }),
      ]
    : []

  const menu = await Menu.new({
    items: [
      ...await getBaseMenu(),
      ...guitarDebugItems,
      ...angryDebugItems,
      ...completionDebugItems,
      await PredefinedMenuItem.new({ item: 'Separator' }),
      ...await getExitMenu(),
    ],
  })

  // Temporarily disable always-on-top on Windows so the context menu is not covered
  if (isWindows && catStore.window.alwaysOnTop) {
    setAlwaysOnTop(false)
  }

  await menu.popup()

  // Restore always-on-top after the menu is closed
  if (!isWindows || !catStore.window.alwaysOnTop) return

  setAlwaysOnTop(true)
}

function handleMouseMove(event: MouseEvent) {
  const { buttons, shiftKey, movementX, movementY } = event

  if (buttons !== 2 || !shiftKey) return

  const delta = (movementX + movementY) * 0.5
  const nextScale = Math.max(10, Math.min(catStore.window.scale + delta, 500))

  catStore.window.scale = round(nextScale)
}
</script>

<template>
  <div
    class="relative size-screen overflow-hidden children:(absolute size-full)"
    :class="{ '-scale-x-100': catStore.model.mirror }"
    :style="{
      opacity: catStore.window.opacity / 100,
      borderRadius: `${catStore.window.radius}%`,
    }"
    @contextmenu="handleContextmenu"
    @mousedown="handleMouseDown"
    @mousemove="handleMouseMove"
  >
    <img
      v-if="backgroundImagePath"
      class="object-cover"
      :src="backgroundImagePath"
    >

    <canvas id="live2dCanvas" />

    <img
      v-for="path in modelStore.pressedKeys"
      :key="path"
      class="object-cover"
      :src="convertFileSrc(path)"
    >

    <GuitarNoteLayer
      :mirrored="catStore.model.mirror"
      :notes="guitarNotes"
    />

    <AngryEffectLayer
      :effects="angryEffects"
      :mirrored="catStore.model.mirror"
    />

    <div
      v-show="resizing || !modelStore.modelReady"
      class="flex items-center justify-center bg-black"
    >
      <span class="text-center text-[10vw] text-[#fff]">
        {{ resizing ? $t('pages.main.hints.redrawing') : $t('pages.main.hints.switching') }}
      </span>
    </div>
  </div>
</template>
