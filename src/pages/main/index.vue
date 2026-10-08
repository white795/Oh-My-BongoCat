<script setup lang="ts">
import type { MotionInfo } from 'easy-live2d'

import { convertFileSrc } from '@tauri-apps/api/core'
import { PhysicalSize } from '@tauri-apps/api/dpi'
import { CheckMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu } from '@tauri-apps/api/menu'
import { sep } from '@tauri-apps/api/path'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { exists, readDir } from '@tauri-apps/plugin-fs'
import { useDebounceFn, useEventListener } from '@vueuse/core'
import { round } from 'es-toolkit'
import { nth } from 'es-toolkit/compat'
import { onMounted, onUnmounted, ref, watch } from 'vue'

import type { AngryAnimationIntensity } from '@/utils/angryAnimation'
import type { AngryEffectInstance, AngryEffectIntensity } from '@/utils/angryEffectEngine'
import type { GuitarNote } from '@/utils/guitarEffectEngine'
import type { GuitarMotifId } from '@/utils/guitarMotifs'
import type { GuitarPerformanceProfile, GuitarPerformanceTemplateId } from '@/utils/guitarPerformance'

import { useAppMenu } from '@/composables/useAppMenu'
import { useDevice } from '@/composables/useDevice'
import { useGamepad } from '@/composables/useGamepad'
import { useModel } from '@/composables/useModel'
import { useTauriListen } from '@/composables/useTauriListen'
import { LISTEN_KEY } from '@/constants'
import { hideWindow, setAlwaysOnTop, setTaskbarVisibility, showWindow } from '@/plugins/window'
import { useCatStore } from '@/stores/cat'
import { useGeneralStore } from '@/stores/general.ts'
import { useModelStore } from '@/stores/model'
import { AngryEffectEngine } from '@/utils/angryEffectEngine'
import { GUITAR_MOTIF_CATALOG } from '@/utils/guitarMotifs'
import { GUITAR_NOTE_EFFECT, GuitarNoteEffect } from '@/utils/guitarNoteEffect'
import { GUITAR_CONTINUE_TEMPLATE_ID, GUITAR_INPUT_BASELINE_TEMPLATE_ID, GUITAR_SOFT_CLOSE_TEMPLATE_ID } from '@/utils/guitarPerformance'
import { isImage } from '@/utils/is'
import live2d from '@/utils/live2d'
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
const guitarNoteEffect = new GuitarNoteEffect()
const guitarNotes = ref<readonly GuitarNote[]>([])
const guitarNoteTimers = new Map<number, number>()
let guitarRestTimer: number | undefined
const angryEffectEngine = new AngryEffectEngine()
const angryEffects = ref<readonly AngryEffectInstance[]>([])
const angryEffectDebugIntensity = ref<AngryEffectIntensity | null>(null)
let angryEffectTimer: number | undefined
let angryEffectGeneration = 0
let angryEffectRevision = 0
let angryEffectCueSequence = 0
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
  return live2d.setAngryAnimationIntent({ intensity })
}

function setAngryEffectDebugIntensity(intensity: AngryEffectIntensity) {
  const previous = angryEffectDebugIntensity.value

  if (previous !== null && angryIntensityRank(intensity) > angryIntensityRank(previous)) {
    angryEffectRevision++
    angryEffectEngine.applySnapshot({
      lifecycle: 'active',
      parentGeneration: angryEffectGeneration,
      revision: angryEffectRevision,
      intensity,
    })
    angryEffectEngine.consume({
      kind: 'anger-escalated',
      parentGeneration: angryEffectGeneration,
      sequence: ++angryEffectCueSequence,
      intensity,
    })
  } else {
    angryEffectGeneration++
    angryEffectRevision = 1
    angryEffectCueSequence = 0
    angryEffectEngine.applySnapshot({
      lifecycle: 'active',
      parentGeneration: angryEffectGeneration,
      revision: angryEffectRevision,
      intensity,
    })
  }

  angryEffectDebugIntensity.value = intensity
  syncAngryEffects()
}

function clearAngryEffectDebug() {
  angryEffectGeneration++
  angryEffectRevision = 0
  angryEffectCueSequence = 0
  angryEffectDebugIntensity.value = null
  angryEffectEngine.deactivate(angryEffectGeneration)
  syncAngryEffects()
}

function setGuitarDebugProfile(profile: GuitarPerformanceProfile, activity = guitarDebugActivity[profile], releasing = false) {
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
  return live2d.setGuitarPerformanceTemplateOverride(templateId)
}

function setGuitarDebugMotifPreview(motifId?: GuitarMotifId) {
  return live2d.setGuitarMotifPreview(motifId)
}

if (import.meta.env.DEV) {
  Object.assign(window, {
    __BONGO_CAT_ANGRY_DEBUG__: {
      set: setAngryDebugIntensity,
      effect: {
        clear: clearAngryEffectDebug,
        set: setAngryEffectDebugIntensity,
        snapshot() {
          return angryEffectEngine.snapshot
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
      play: () => live2d.playCompletionAnimation(),
      snapshot() {
        return live2d.completionAnimationSnapshot
      },
    },
  })
}

onMounted(startListening)

onUnmounted(() => {
  clearGuitarNotes()
  clearAngryEffectDebug()
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
  if (!model) return

  clearGuitarNotes()
  clearAngryEffectDebug()
  await handleLoad()

  const path = join(model.path, 'resources', 'background.png')

  const existed = await exists(path)

  backgroundImagePath.value = existed ? convertFileSrc(path) : void 0

  clearObject([modelStore.supportKeys, modelStore.pressedKeys])

  const resourcePath = join(model.path, 'resources')
  const groups = ['left-keys', 'right-keys']

  for await (const groupName of groups) {
    const groupDir = join(resourcePath, groupName)
    const files = await readDir(groupDir).catch(() => [])
    const imageFiles = files.filter(file => isImage(file.name))

    for (const file of imageFiles) {
      const fileName = file.name.split('.')[0]

      modelStore.supportKeys[fileName] = join(groupDir, file.name)
    }
  }

  modelStore.modelReady = true
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

watch(() => catStore.model.motionSound, live2d.setMotionSoundEnabled, { immediate: true })

watch(() => catStore.model.maxFPS, live2d.setMaxFPS, { immediate: true })

useTauriListen<MotionInfo>(LISTEN_KEY.START_MOTION, ({ payload }) => {
  live2d.startMotion(payload)
})

useTauriListen<number>(LISTEN_KEY.SET_EXPRESSION, ({ payload }) => {
  live2d.setExpression(payload)

  if (!live2d.isGuitarPerforming) clearGuitarNotes()
  if (!live2d.isAngryAnimating) clearAngryEffectDebug()
})

function angryIntensityRank(intensity: AngryEffectIntensity) {
  return angryDebugIntensities.indexOf(intensity)
}

function syncAngryEffects() {
  if (angryEffectTimer !== undefined) window.clearTimeout(angryEffectTimer)

  angryEffectTimer = undefined
  angryEffects.value = angryEffectEngine.snapshot

  const deadlineAt = angryEffectEngine.nextDeadlineAt

  if (deadlineAt === undefined) return

  angryEffectTimer = window.setTimeout(() => {
    angryEffectTimer = undefined
    angryEffectEngine.advance()
    syncAngryEffects()
  }, Math.max(deadlineAt - Date.now(), 0))
}

function syncGuitarNotes() {
  const notes = guitarNoteEffect.snapshot
  const activeIds = new Set(notes.map(note => note.id))

  for (const [id, timer] of guitarNoteTimers) {
    if (activeIds.has(id)) continue

    window.clearTimeout(timer)
    guitarNoteTimers.delete(id)
  }

  guitarNotes.value = notes
}

function expireGuitarNote(id: number) {
  guitarNoteTimers.delete(id)
  guitarNoteEffect.remove(id)
  syncGuitarNotes()
}

function showGuitarNote(note: GuitarNote | undefined) {
  if (!note) return

  syncGuitarNotes()
  guitarNoteTimers.set(note.id, window.setTimeout(() => expireGuitarNote(note.id), note.durationMs))
}

function scheduleGuitarRest() {
  if (guitarRestTimer !== undefined) window.clearTimeout(guitarRestTimer)

  guitarRestTimer = window.setTimeout(() => {
    guitarRestTimer = undefined

    if (!live2d.isGuitarPerforming) return

    showGuitarNote(guitarNoteEffect.triggerRest())
  }, GUITAR_NOTE_EFFECT.restDelayMs)
}

function handleGuitarKeyPress() {
  if (!live2d.isGuitarPerforming) return

  scheduleGuitarRest()
  showGuitarNote(guitarNoteEffect.trigger())
}

function clearGuitarNotes() {
  for (const timer of guitarNoteTimers.values()) window.clearTimeout(timer)

  if (guitarRestTimer !== undefined) window.clearTimeout(guitarRestTimer)

  guitarNoteTimers.clear()
  guitarRestTimer = undefined
  guitarNoteEffect.clear()
  guitarNotes.value = []
}

function handleMouseDown() {
  appWindow.startDragging()
}

async function handleContextmenu(event: MouseEvent) {
  event.preventDefault()

  if (event.shiftKey) return

  const guitarDebugItems = import.meta.env.DEV
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

  const angryDebugItems = import.meta.env.DEV
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
        await Submenu.new({
          text: 'Angry effect preview (dev)',
          items: await Promise.all([
            { text: 'OFF', intensity: null },
            ...angryDebugIntensities.map(intensity => ({
              text: intensity.toUpperCase(),
              intensity,
            })),
          ].map(({ text, intensity }) => {
            return CheckMenuItem.new({
              text,
              checked: angryEffectDebugIntensity.value === intensity,
              action: () => intensity === null
                ? clearAngryEffectDebug()
                : setAngryEffectDebugIntensity(intensity),
            })
          })),
        }),
      ]
    : []

  const completionDebugItems = import.meta.env.DEV
    ? [
        await MenuItem.new({
          text: 'Play completion animation (dev)',
          action: () => live2d.playCompletionAnimation(),
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
