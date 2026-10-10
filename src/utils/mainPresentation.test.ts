/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { it } from 'node:test'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

import type { AngryAnimationIntent } from './angryAnimation.ts'
import type { CharacterAmbientSnapshot } from './characterPresentation.ts'
import type { GuitarPerformanceIntent } from './guitarPerformance.ts'
import type { MikuCatEnteredMode, MikuCatPresentationMode } from './mikuCatPresentationConsumer.ts'

import { INVOKE_KEY, LISTEN_KEY } from '../constants/index.ts'
import { CharacterPresentationController, supportsAgentPresentation } from './characterPresentationController.ts'
import { CharacterStateCoordinator } from './characterStateCoordinator.ts'
import { GUITAR_MOTIF_CATALOG } from './guitarMotifs.ts'
import * as guitarPerformance from './guitarPerformance.ts'
import * as keyBubble from './keyBubble.ts'
import { MikuCatPresentationConsumer } from './mikuCatPresentationConsumer.ts'

// Exercise the actual page setup and real state/consumer modules, replacing
// only Vue lifecycle registration, stores, native IPC and the WebGL target.
function fixture(initial: CharacterAmbientSnapshot, load: () => Promise<void> = async () => {}) {
  let now = 80_000
  let nextTimer = 0
  let ready = false
  let destroyed = 0
  let unlistened = 0
  let bubbleOffsetCount = 0
  let press = (_key: string) => {}
  let ambientListener = (_event: { payload: CharacterAmbientSnapshot }) => {}
  const mounted: Array<() => void> = []
  const unmounted: Array<() => void> = []
  const timers = new Map<number, { at: number, callback: () => void }>()
  const listeners = new Map<string, (event: { payload: unknown }) => void>()
  const modeListeners = new Set<(mode: MikuCatEnteredMode) => void>()
  const watches: Array<{ source: () => unknown, previous: unknown, callback: (value: unknown) => unknown }> = []
  const arrayRefs: Array<{ value: unknown[] }> = []
  const pageBindings: { getKeyBubble?: () => keyBubble.KeyBubble | undefined } = {}
  let modelLoad: Promise<unknown> | undefined
  const modelStore = {
    currentModel: { id: 'preset:mikucat', path: 'model', isPreset: true, presetKey: 'mikucat' },
    supportKeys: {},
    pressedKeys: {},
    modelReady: false,
  }
  const generalStore = { app: { agentModelControlEnabled: true, taskbarVisible: false } }
  const catStore = { window: { scale: 50, visible: true, passThrough: false, alwaysOnTop: true }, model: { maxFPS: 60, motionSound: false } }
  const target = {
    enteredAnimationMode: 'relaxed' as MikuCatEnteredMode,
    guitarIntents: [] as GuitarPerformanceIntent[],
    angryIntents: [] as AngryAnimationIntent[],
    expressions: [] as number[],
    motionCount: 0,
    completionCount: 0,
    requests: [] as Array<MikuCatPresentationMode | 'release'>,
    enter(mode: MikuCatEnteredMode) {
      target.enteredAnimationMode = mode
      for (const listener of modeListeners) listener(mode)
    },
    applyAgentPresentation(mode: MikuCatPresentationMode) {
      if (!ready) return false
      target.requests.push(mode)
      target.enter(mode)
      return true
    },
    releaseAgentPresentation() {
      target.requests.push('release')
      target.enter('relaxed')
      return true
    },
    onAnimationModeChange(listener: (mode: MikuCatEnteredMode) => void) {
      modeListeners.add(listener)
      return () => modeListeners.delete(listener)
    },
    setGuitarPerformanceIntent(intent: GuitarPerformanceIntent) {
      target.guitarIntents.push(intent)
      return true
    },
    setAngryAnimationIntent(intent: AngryAnimationIntent) {
      target.angryIntents.push(intent)
      return true
    },
    setGuitarPerformanceTemplateOverride() {
      return true
    },
    setGuitarMotifPreview() {
      return true
    },
    setExpression(index: number) {
      target.expressions.push(index)
    },
    startMotion() {
      target.motionCount++
    },
    setMotionSoundEnabled() {},
    setMaxFPS() {},
    playCompletionAnimation() {
      target.completionCount++
      target.enter('completion')
      return true
    },
  }
  const windowStub = {
    setTimeout(callback: () => void, delayMs: number) {
      const handle = ++nextTimer
      timers.set(handle, { at: now + delayMs, callback })
      return handle
    },
    clearTimeout(handle: number) {
      timers.delete(handle)
    },
  }
  const modules: Record<string, unknown> = {
    '@tauri-apps/api/core': { convertFileSrc: (value: string) => value, invoke: async (key: string) => {
      assert.equal(key, INVOKE_KEY.GET_CODEX_AMBIENT_SNAPSHOT)
      return initial
    } },
    '@tauri-apps/api/event': { listen: async (_name: string, callback: typeof ambientListener) => {
      ambientListener = callback
      return () => {
        unlistened++
      }
    } },
    '@tauri-apps/api/dpi': { PhysicalSize: class {} },
    '@tauri-apps/api/menu': {},
    '@tauri-apps/api/path': { sep: () => '/' },
    '@tauri-apps/api/webviewWindow': { getCurrentWebviewWindow: () => ({ setIgnoreCursorEvents() {} }) },
    '@tauri-apps/plugin-fs': { exists: async () => false, readDir: async () => [] },
    '@vueuse/core': { useDebounceFn: (fn: unknown) => fn, useEventListener() {} },
    'es-toolkit': { round: Math.round },
    'es-toolkit/compat': { nth() {} },
    'vue': {
      onMounted: (callback: () => void) => mounted.push(callback),
      onUnmounted: (callback: () => void) => unmounted.push(callback),
      ref(value: unknown) {
        const result = { value }
        if (Array.isArray(value)) arrayRefs.push(result as { value: unknown[] })
        return result
      },
      watch(source: unknown, callback: (value: unknown) => unknown, options?: { immediate?: boolean }) {
        if (typeof source !== 'function') return
        const getter = source as () => unknown
        const value = getter()
        watches.push({ source: getter, previous: value, callback })
        if (options?.immediate) {
          const result = callback(value)
          if (value === modelStore.currentModel) modelLoad = result as Promise<unknown>
        }
      },
    },
    '@/composables/useAppMenu': { useAppMenu: () => ({}) },
    '@/composables/useDevice': { useDevice: (options: { onKeyboardPress: (key: string) => void }) => {
      press = options.onKeyboardPress
      return { startListening() {} }
    } },
    '@/composables/useGamepad': { useGamepad: () => ({ stickActive: {} }) },
    '@/composables/useModel': { useModel: () => ({
      async handleLoad() {
        await load()
        ready = true
      },
      handleDestroy() {
        ready = false
        destroyed++
      },
    }) },
    '@/composables/useTauriListen': { useTauriListen: (name: string, callback: (event: { payload: unknown }) => void) => listeners.set(name, callback) },
    '@/constants': { INVOKE_KEY, LISTEN_KEY },
    '@/plugins/window': { setAlwaysOnTop() {}, setTaskbarVisibility() {} },
    '@/stores/cat': { useCatStore: () => catStore },
    '@/stores/general.ts': { useGeneralStore: () => generalStore },
    '@/stores/model': { useModelStore: () => modelStore },
    '@/utils/characterPresentationController': { CharacterPresentationController, supportsAgentPresentation },
    '@/utils/characterStateCoordinator': { CharacterStateCoordinator },
    '@/utils/guitarMotifs': { GUITAR_MOTIF_CATALOG },
    '@/utils/guitarPerformance': guitarPerformance,
    '@/utils/is': { isImage: () => false },
    '@/utils/keyBubble': {
      ...keyBubble,
      createKeyBubbleOffset: () => ({ offsetX: ++bubbleOffsetCount, offsetY: -24 - bubbleOffsetCount }),
    },
    '@/utils/live2d': { __esModule: true, default: target },
    '@/utils/mikuCatPresentationConsumer': { MikuCatPresentationConsumer },
    '@/utils/path': { join: (...parts: string[]) => parts.join('/') },
    '@/utils/platform': { isWindows: false },
    '@/utils/shared': { clearObject() {} },
  }
  const source = readFileSync(new URL('../pages/main/index.vue', import.meta.url), 'utf8')
    .split('<script setup lang="ts">')[1]
    .split('</script>')[0]
    .replace(/import\.meta\.env\.DEV/g, 'true')
  const { outputText } = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    esModuleInterop: true,
  } })
  runInNewContext(`${outputText}\nexports.getKeyBubble = () => typeof keyBubble === 'undefined' ? undefined : keyBubble.value;`, {
    exports: pageBindings,
    require: (id: string) => {
      assert.ok(id in modules, `Unexpected setup dependency: ${id}`)
      return modules[id]
    },
    window: windowStub,
    performance: { now: () => now },
  })

  async function mount() {
    for (const callback of mounted) callback()
    await modelLoad
    for (let i = 0; i < 10; i++) await Promise.resolve()
  }
  function advance(ms: number) {
    const end = now + ms
    for (;;) {
      const next = [...timers.entries()].sort((a, b) => a[1].at - b[1].at)[0]
      if (!next || next[1].at > end) break
      now = next[1].at
      timers.delete(next[0])
      next[1].callback()
    }
    now = end
  }
  function setAgentEnabled(enabled: boolean) {
    generalStore.app.agentModelControlEnabled = enabled
    for (const watch of watches) {
      const value = watch.source()
      if (value === watch.previous) continue
      watch.previous = value
      watch.callback(value)
    }
  }
  return {
    mount,
    advance,
    target,
    timers,
    press: (key = 'KeyA') => press(key),
    setAgentEnabled,
    async selectModel(presetKey: string) {
      modelStore.currentModel = { id: `preset:${presetKey}`, path: `model-${presetKey}`, isPreset: true, presetKey }
      for (const watch of watches) {
        const value = watch.source()
        if (value === watch.previous) continue
        watch.previous = value
        await watch.callback(value)
      }
    },
    ambient: (payload: CharacterAmbientSnapshot) => ambientListener({ payload }),
    expression: (payload: number) => listeners.get(LISTEN_KEY.SET_EXPRESSION)?.({ payload }),
    motion: () => listeners.get(LISTEN_KEY.START_MOTION)?.({ payload: {} }),
    unmount: () => {
      for (const callback of unmounted) callback()
    },
    get notes() {
      return arrayRefs[0].value as Array<{ variant: string }>
    },
    get angryEffects() {
      return arrayRefs[1].value as Array<{ intensity: string }>
    },
    bubbleSnapshot() {
      return pageBindings.getKeyBubble?.()
    },
    get destroyed() {
      return destroyed
    },
    get unlistened() {
      return unlistened
    },
    get modeListenerCount() {
      return modeListeners.size
    },
    get bubbleOffsetCount() {
      return bubbleOffsetCount
    },
  }
}

it('routes page keyboard edges to state intents and single rest effects while arbitrating manual controls', async () => {
  const f = fixture({ sequence: 1, sessions: [{ sessionId: 'a', state: 'working' }] })
  await f.mount()
  assert.equal(f.target.enteredAnimationMode, 'guitar')
  f.expression(2)
  f.motion()
  assert.equal(f.target.expressions.length, 0)
  assert.equal(f.target.motionCount, 0)
  f.press()
  assert.equal(f.target.guitarIntents.at(-1)?.profile, 'engaged')
  assert.equal(f.notes.length, 1)
  f.advance(1_000)
  assert.ok(f.notes.some(note => ['rest', 'eighthRest'].includes(note.variant)))

  f.setAgentEnabled(false)
  assert.equal(f.notes.length, 0)
  assert.equal(f.timers.size, 0)
  f.expression(2)
  f.motion()
  assert.equal(f.target.expressions.length, 1)
  assert.equal(f.target.motionCount, 1)
  f.unmount()
})

it('routes waiting deadlines and the real completion edge through the page without restarting on repeated snapshots', async () => {
  const f = fixture({ sequence: 2, sessions: [{ sessionId: 'a', state: 'waiting' }] })
  await f.mount()
  assert.equal(f.target.angryIntents.at(-1)?.intensity, 'annoyed')
  f.advance(4_000)
  f.ambient({ sequence: 3, sessions: [{ sessionId: 'a', state: 'waiting' }] })
  f.advance(4_000)
  assert.equal(f.target.angryIntents.at(-1)?.intensity, 'impatient')
  assert.ok(f.angryEffects.some(effect => effect.intensity === 'impatient'))
  f.advance(17_000)
  assert.equal(f.target.angryIntents.at(-1)?.intensity, 'furious')
  f.ambient({ sequence: 4, sessions: [{ sessionId: 'a', state: 'done' }] })
  assert.equal(f.target.completionCount, 1)
  f.ambient({ sequence: 5, sessions: [{ sessionId: 'a', state: 'done' }] })
  assert.equal(f.target.completionCount, 1)
  f.unmount()
  assert.equal(f.timers.size, 0)
  assert.equal(f.modeListenerCount, 0)
  assert.equal(f.unlistened, 1)
})

it('does not restore presentation or a model whose asynchronous load finishes after page unmount', async () => {
  let finishLoad = () => {}
  const loading = new Promise<void>((resolve) => {
    finishLoad = resolve
  })
  const f = fixture({ sequence: 1, sessions: [{ sessionId: 'a', state: 'waiting' }] }, () => loading)
  const mounting = f.mount()
  f.unmount()
  finishLoad()
  await mounting
  assert.equal(f.target.requests.includes('angry'), false)
  assert.equal(f.timers.size, 0)
  assert.equal(f.modeListenerCount, 0)
  assert.equal(f.destroyed, 2, 'late-loaded resources must also be destroyed')
  f.ambient({ sequence: 2, sessions: [{ sessionId: 'a', state: 'working' }] })
  f.press()
  assert.equal(f.target.requests.includes('guitar'), false)
})

it('replaces a key without replaying its entrance or randomizing its offset and refreshes the hold before fading', async () => {
  const f = fixture({ sequence: 1, sessions: [] })
  await f.mount()
  f.press('KeyA')
  assert.equal(f.bubbleSnapshot()?.src, 'model/resources/input-bubbles/Key_A.png')
  const first = f.bubbleSnapshot()
  assert.equal(first?.phase, 'visible')
  assert.equal(f.notes.length, 0)
  assert.equal(f.timers.size, 1)

  f.advance(500)
  f.press('KeyB')
  assert.equal(f.bubbleSnapshot()?.src, 'model/resources/input-bubbles/Key_B.png')
  assert.equal(f.bubbleSnapshot()?.id, first?.id, 'a visible bubble must not remount when its label changes')
  assert.equal(f.bubbleSnapshot()?.offsetX, first?.offsetX)
  assert.equal(f.bubbleSnapshot()?.offsetY, first?.offsetY)
  assert.equal(f.bubbleOffsetCount, 1)
  assert.equal(f.timers.size, 1, 'rapid typing must not accumulate cleanup timers')
  f.advance(599)
  assert.equal(f.bubbleSnapshot()?.phase, 'visible', 'the hold must be measured from the latest press')
  f.advance(1)
  assert.equal(f.bubbleSnapshot()?.phase, 'leaving')
  f.advance(199)
  assert.equal(f.bubbleSnapshot()?.src, 'model/resources/input-bubbles/Key_B.png')
  f.advance(1)
  assert.equal(f.bubbleSnapshot(), undefined)
  assert.equal(f.timers.size, 0)
  f.unmount()
})

it('restores a fading bubble without replaying its entrance and chooses a new offset only after it disappears', async () => {
  const f = fixture({ sequence: 1, sessions: [] })
  await f.mount()
  f.press('KeyA')
  const first = f.bubbleSnapshot()
  const staleHold = [...f.timers.values()][0].callback
  f.advance(650)
  assert.equal(f.bubbleSnapshot()?.phase, 'leaving')
  const staleFade = [...f.timers.values()][0].callback
  f.press('KeyB')
  assert.equal(f.bubbleSnapshot()?.id, first?.id)
  assert.equal(f.bubbleSnapshot()?.phase, 'visible')
  assert.equal(f.bubbleOffsetCount, 1)
  staleHold()
  staleFade()
  assert.equal(f.bubbleSnapshot()?.phase, 'visible', 'expired callbacks must not fade or clear a renewed bubble')
  assert.equal(f.timers.size, 1)
  f.advance(800)
  assert.equal(f.bubbleSnapshot(), undefined)
  f.press('KeyC')
  assert.notEqual(f.bubbleSnapshot()?.id, first?.id)
  assert.notEqual(f.bubbleSnapshot()?.offsetX, first?.offsetX)
  assert.equal(f.bubbleOffsetCount, 2)
  f.unmount()
})

it('clears default bubbles on Agent mode changes and excludes guitar, angry and completion playback', async () => {
  const f = fixture({ sequence: 1, sessions: [] })
  await f.mount()
  f.press('KeyA')
  assert.ok(f.bubbleSnapshot())
  f.ambient({ sequence: 2, sessions: [{ sessionId: 'a', state: 'working' }] })
  assert.equal(f.bubbleSnapshot(), undefined)
  f.press('KeyB')
  assert.equal(f.bubbleSnapshot(), undefined)
  assert.equal(f.notes.length, 1, 'guitar input must still reach the existing effects path')

  f.ambient({ sequence: 3, sessions: [{ sessionId: 'a', state: 'waiting' }] })
  f.target.enter('relaxed')
  f.press('KeyC')
  assert.equal(f.bubbleSnapshot(), undefined, 'the Agent target mode also gates a bubble before animation handoff')

  f.ambient({ sequence: 4, sessions: [{ sessionId: 'a', state: 'done' }] })
  f.press('KeyD')
  assert.equal(f.bubbleSnapshot(), undefined)
  f.target.enter('relaxed')
  f.press('KeyE')
  assert.equal(f.bubbleSnapshot()?.src, 'model/resources/input-bubbles/Key_E.png')
  f.unmount()
})

it('allows default bubbles without Agent ownership and clears them on manual mode changes and unmount', async () => {
  const f = fixture({ sequence: 1, sessions: [] })
  await f.mount()
  f.setAgentEnabled(false)
  f.press('KeyQ')
  assert.equal(f.bubbleSnapshot()?.src, 'model/resources/input-bubbles/Key_Q.png')
  f.advance(600)
  assert.equal(f.bubbleSnapshot()?.phase, 'leaving')
  f.target.enter('guitar')
  assert.equal(f.bubbleSnapshot(), undefined)
  f.press('KeyA')
  assert.equal(f.bubbleSnapshot(), undefined)
  f.target.enter('relaxed')
  f.press('KeyB')
  assert.ok(f.bubbleSnapshot())
  f.unmount()
  assert.equal(f.bubbleSnapshot(), undefined)
  assert.equal(f.timers.size, 0)
  assert.equal(f.modeListenerCount, 0)
  f.press('KeyC')
  assert.equal(f.bubbleSnapshot(), undefined)
})

it('clears a bubble when switching models and never adds MikuCat sprites to other models', async () => {
  const f = fixture({ sequence: 1, sessions: [] })
  await f.mount()
  f.press('KeyA')
  assert.ok(f.bubbleSnapshot())
  await f.selectModel('standard')
  assert.equal(f.bubbleSnapshot(), undefined)
  assert.equal(f.timers.size, 0)
  f.press('KeyB')
  assert.equal(f.bubbleSnapshot(), undefined)
  await f.selectModel('mikucat')
  f.press('KeyC')
  assert.equal(f.bubbleSnapshot()?.src, 'model-mikucat/resources/input-bubbles/Key_C.png')
  f.unmount()
})
