/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { it } from 'node:test'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

import type { AngryAnimationIntent } from './angryAnimation.ts'
import type { CharacterAmbientSession, CharacterPresentationTransition } from './characterPresentation.ts'
import type { GuitarMotifId } from './guitarMotifs.ts'
import type { GuitarPerformanceIntent, GuitarPerformanceTemplateId } from './guitarPerformance.ts'
import type { MikuCatEnteredMode, MikuCatPresentationMode } from './mikuCatPresentationConsumer.ts'

import { ANGRY_ANIMATION, AngryAnimation } from './angryAnimation.ts'
import { CharacterPresentationController } from './characterPresentationController.ts'
import { CharacterStateCoordinator } from './characterStateCoordinator.ts'
import { COMPLETION_ANIMATION, CompletionAnimation } from './completionAnimation.ts'
import { GuitarHandAnimation } from './guitarHandAnimation.ts'
import { IMMERSED_DOUBLE_NOD_MOTIF_ID } from './guitarMotifs.ts'
import { GUITAR_PERFORMANCE, GUITAR_SOFT_CLOSE_TEMPLATE_ID } from './guitarPerformance.ts'
import { MikuCatPresentationConsumer } from './mikuCatPresentationConsumer.ts'
import { ModelMouseInput } from './modelMouseInput.ts'
import { MIKUCAT_ANGRY_OWNED_PARAMETERS, MIKUCAT_COMPLETION_OWNED_PARAMETERS, MIKUCAT_GUITAR_OWNED_PARAMETERS, MIKUCAT_LEEK_HAND_CHANNELS, MIKUCAT_NORMAL_LEFT_HAND_CHANNELS, ModelParameterOwnership } from './modelParameterOwnership.ts'

// Exercise the real host wrapper; only native IPC, asset loading and WebGL are replaced.
function fixture() {
  const callbacks = new Set<(ticker: { deltaMS: number }) => void>()
  const parameters = new Map<string, number>()
  const parameterWrites: Array<[string, number, number]> = []
  const expressionIndices: number[] = []
  const manifest = readFileSync(new URL('../../src-tauri/assets/models/mikucat/mikucat.model3.json', import.meta.url), 'utf8')
  const source = readFileSync(new URL('./live2d.ts', import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    esModuleInterop: true,
  } })
  class Sprite {
    width = 100
    height = 100
    ready = Promise.resolve()
    getMotions() {
      return []
    }

    getExpressions() {
      return JSON.parse(manifest).FileReferences.Expressions
    }

    setExpression({ index }: { index: number }) {
      expressionIndices.push(index)
    }

    setParameterValueById(id: string, value: number, weight = 1) {
      parameterWrites.push([id, value, weight])
      if (weight > 0) parameters.set(id, value)
    }

    getParameterValueRangeById(id: string) {
      if (['Param18', 'Param16', 'Param17', 'Param19'].includes(id)) return { min: -1, max: 1 }
      if (['ParamMouseLeftDown', 'ParamMouseRightDown'].includes(id)) return { min: 0, max: 1 }
      const animationParameters = [
        ...MIKUCAT_GUITAR_OWNED_PARAMETERS,
        ...MIKUCAT_ANGRY_OWNED_PARAMETERS,
        ...MIKUCAT_COMPLETION_OWNED_PARAMETERS,
      ] as readonly string[]
      if (animationParameters.includes(id)) return { min: -30, max: 30 }
      return null
    }

    destroy() { }
  }
  const modules: Record<string, unknown> = {
    '@tauri-apps/api/core': { convertFileSrc: (value: string) => value },
    '@tauri-apps/plugin-fs': {
      readDir: async () => [{ name: 'mikucat.model3.json' }],
      readTextFile: async () => manifest,
    },
    'easy-live2d': {
      Config: {},
      CubismSetting: class {
        redirectPath() { }
      },
      Live2DSprite: Sprite,
      Priority: {},
    },
    'es-toolkit/compat': { groupBy: () => ({}) },
    'json5': JSON,
    'pixi.js': {
      Application: class {
        stage = { addChild() { } }
        async init() { }
      },
      Ticker: { shared: {
        add: (callback: (ticker: { deltaMS: number }) => void) => callbacks.add(callback),
        remove: (callback: (ticker: { deltaMS: number }) => void) => callbacks.delete(callback),
      } },
    },
    '@/locales': { i18n: { global: { t: (key: string) => key } } },
    './angryAnimation': { AngryAnimation },
    './completionAnimation': { CompletionAnimation },
    './guitarHandAnimation': { GuitarHandAnimation },
    './modelMouseInput': { ModelMouseInput },
    './modelParameterOwnership': {
      MIKUCAT_ANGRY_OWNED_PARAMETERS,
      MIKUCAT_COMPLETION_OWNED_PARAMETERS,
      MIKUCAT_GUITAR_OWNED_PARAMETERS,
      ModelParameterOwnership,
    },
    './path': { join: (...paths: string[]) => paths.join('/') },
  }
  const exports: Record<string, unknown> = {}
  runInNewContext(outputText, {
    exports,
    require: (id: string) => {
      assert.ok(id in modules, `Unexpected boundary dependency: ${id}`)
      return modules[id]
    },
    document: { getElementById: () => ({}) },
    window: {},
    devicePixelRatio: 1,
  }, { filename: 'live2d.cjs' })
  const host = exports.default as {
    load: (path: string, presetKey?: string) => Promise<unknown>
    setExpression: (index: number) => void
    setAngryAnimationIntent: (intent: AngryAnimationIntent) => boolean
    setGuitarPerformanceIntent: (intent: GuitarPerformanceIntent) => boolean
    setGuitarPerformanceTemplateOverride: (templateId?: GuitarPerformanceTemplateId) => boolean
    setGuitarMotifPreview: (motifId?: GuitarMotifId) => boolean
    playCompletionAnimation: () => boolean
    applyAgentPresentation: (mode: MikuCatPresentationMode) => boolean
    releaseAgentPresentation: () => boolean
    onAnimationModeChange: (listener: (mode: MikuCatEnteredMode) => void) => () => void
    destroy: () => void
    readonly enteredAnimationMode: MikuCatEnteredMode
    readonly isGuitarPerforming: boolean
    readonly isAngryAnimating: boolean
    readonly isCompletionAnimating: boolean
    readonly guitarPerformanceSnapshot: GuitarHandAnimation['snapshot']
    readonly angryAnimationSnapshot: AngryAnimation['snapshot']
    readonly completionAnimationSnapshot: CompletionAnimation['snapshot']
    mouseInput: ModelMouseInput
  }
  function advance(ms: number) {
    for (let elapsed = 0; elapsed < ms; elapsed += 10) {
      for (const callback of [...callbacks]) callback({ deltaMS: Math.min(10, ms - elapsed) })
    }
  }
  return { host, advance, callbacks, parameters, parameterWrites, expressionIndices }
}

async function integratedFixture() {
  const hostFixture = fixture()
  await hostFixture.host.load('model', 'mikucat')
  let now = 120_000
  let sequence = 0
  let nextHandle = 0
  const timers = new Map<number, { at: number, callback: () => void }>()
  const clock = () => now
  const runtime = {
    setTimeout(callback: () => void, delayMs: number) {
      const handle = ++nextHandle
      timers.set(handle, { at: now + delayMs, callback })
      return handle
    },
    clearTimeout(handle: unknown) {
      timers.delete(handle as number)
    },
  }
  const controller = new CharacterPresentationController()
  const consumer = new MikuCatPresentationConsumer(hostFixture.host, clock, () => 0, {
    ...runtime,
    onEffectsChange() {},
  })
  const coordinator = new CharacterStateCoordinator(clock, {
    ...runtime,
    onUpdate: update => consumer.apply(update),
  })
  function deliver(transition: CharacterPresentationTransition) {
    const update = coordinator.applyPresentation(transition)
    consumer.apply(update)
    return update
  }
  deliver(controller.setModel({ isPreset: true, presetKey: 'mikucat' }))
  deliver(controller.setAgentRequested(true))

  function ambient(sessions: readonly CharacterAmbientSession[]) {
    return deliver(controller.applyAmbient({ sequence: ++sequence, sessions }))
  }
  function press() {
    consumer.apply(coordinator.press(coordinator.snapshot.presentation.generation))
  }
  function advance(ms: number) {
    const end = now + ms
    for (;;) {
      const next = [...timers.entries()].sort((a, b) => a[1].at - b[1].at)[0]
      if (!next || next[1].at > end) break

      hostFixture.advance(Math.max(0, next[1].at - now))
      now = next[1].at
      timers.delete(next[0])
      next[1].callback()
    }
    hostFixture.advance(end - now)
    now = end
  }
  function dispose() {
    coordinator.dispose()
    consumer.dispose()
    hostFixture.host.destroy()
  }

  return { ...hostFixture, controller, coordinator, consumer, timers, deliver, ambient, press, advance, dispose }
}

it('delivers real guitar input and the single silence cue through shared-clock state and effect deadlines', async () => {
  const f = await integratedFixture()
  f.ambient([{ sessionId: 'a', state: 'working' }])
  assert.equal(f.host.guitarPerformanceSnapshot.requestedIntent.profile, 'autonomous')
  assert.equal(f.timers.size, 0, 'autonomous guitar does not poll')

  f.press()
  assert.equal(f.host.guitarPerformanceSnapshot.requestedIntent.profile, 'engaged')
  assert.equal(f.consumer.guitarNotes.length, 1)
  assert.equal(f.timers.size, 2, 'one semantic and one effect deadline')

  f.advance(400)
  assert.equal(f.host.guitarPerformanceSnapshot.requestedIntent.releasing, true)
  f.advance(600)
  assert.equal(f.host.guitarPerformanceSnapshot.requestedIntent.profile, 'autonomous')
  assert.deepEqual(f.consumer.guitarNotes.map(note => note.variant), ['rest'])
  f.advance(820)
  assert.equal(f.consumer.guitarNotes.length, 0)
  assert.equal(f.timers.size, 0)
  f.advance(2_000)
  assert.equal(f.consumer.guitarNotes.length, 0, 'silence does not repeat the rest')
  f.dispose()
})

it('prioritizes a waiting session and advances both angry consumers without resetting time on repeated hooks', async () => {
  const f = await integratedFixture()
  f.ambient([{ sessionId: 'a', state: 'working' }])
  f.press()
  const oldUpdate = f.coordinator.press(f.controller.snapshot.generation)
  const staleCallbacks = [...f.timers.values()].map(timer => timer.callback)
  const sessions = [{ sessionId: 'a', state: 'working' }, { sessionId: 'b', state: 'waiting' }] as const
  f.ambient(sessions)
  assert.equal(f.consumer.guitarNotes.length, 0)
  assert.equal(f.consumer.angryEffects.length, 0, 'effects wait for actual angry entry')
  assert.equal(f.host.angryAnimationSnapshot.requestedIntent.intensity, 'annoyed')

  f.advance(4_000)
  f.ambient(sessions)
  f.advance(4_000)
  assert.equal(f.host.angryAnimationSnapshot.requestedIntent.intensity, 'impatient')
  assert.ok(f.consumer.angryEffects.some(effect => effect.intensity === 'impatient'))
  f.advance(17_000)
  assert.equal(f.host.angryAnimationSnapshot.requestedIntent.intensity, 'furious')
  assert.ok(f.consumer.angryEffects.some(effect => effect.intensity === 'furious'))
  assert.ok(f.timers.size <= 2)

  assert.equal(f.consumer.apply(oldUpdate), false)
  for (const callback of staleCallbacks) callback()
  assert.equal(f.consumer.guitarNotes.length, 0)
  assert.equal(f.host.angryAnimationSnapshot.requestedIntent.intensity, 'furious')
  f.dispose()
  assert.equal(f.timers.size, 0)
  assert.equal(f.callbacks.size, 0)
})

it('plays completion only on the real all-done edge and lets new work preempt it', async () => {
  const f = await integratedFixture()
  f.ambient([{ sessionId: 'a', state: 'working' }, { sessionId: 'b', state: 'working' }])
  f.ambient([{ sessionId: 'a', state: 'done' }, { sessionId: 'b', state: 'working' }])
  assert.equal(f.host.isCompletionAnimating, false)
  f.ambient([{ sessionId: 'a', state: 'done' }, { sessionId: 'b', state: 'done' }])
  f.advance(GUITAR_PERFORMANCE.exitMs)
  assert.equal(f.host.enteredAnimationMode, 'completion')
  const dotEyesCount = () => f.expressionIndices.filter(index => index === 1).length
  assert.equal(dotEyesCount(), 1)
  f.ambient([{ sessionId: 'a', state: 'done' }, { sessionId: 'b', state: 'done' }])
  assert.equal(dotEyesCount(), 1)

  f.ambient([{ sessionId: 'b', state: 'waiting' }])
  f.advance(COMPLETION_ANIMATION.preemptExitMs)
  assert.equal(f.host.enteredAnimationMode, 'angry')
  f.ambient([])
  f.advance(ANGRY_ANIMATION.exitMs)
  assert.equal(f.host.enteredAnimationMode, 'relaxed')
  assert.equal(dotEyesCount(), 1, 'SessionEnd does not replay completion')
  f.dispose()
})

it('cleans semantic and effect deadlines on manual release or model replacement and rejects retained callbacks', async () => {
  const f = await integratedFixture()
  f.ambient([{ sessionId: 'a', state: 'waiting' }])
  const staleCallbacks = [...f.timers.values()].map(timer => timer.callback)
  f.deliver(f.controller.setAgentRequested(false))
  assert.equal(f.controller.manualControlAllowed, true)
  assert.equal(f.timers.size, 0)
  assert.equal(f.consumer.angryEffects.length, 0)
  for (const callback of staleCallbacks) callback()
  f.advance(ANGRY_ANIMATION.exitMs)
  assert.equal(f.host.mouseInput.accepts(f.host.mouseInput.begin()), true)

  f.deliver(f.controller.setAgentRequested(true))
  f.deliver(f.controller.setModel(undefined))
  await f.host.load('other', 'standard')
  f.deliver(f.controller.setModel({ isPreset: true, presetKey: 'standard' }))
  assert.equal(f.timers.size, 0)
  assert.equal(f.callbacks.size, 0)
  assert.equal(f.consumer.angryEffects.length, 0)
  f.press()
  assert.equal(f.consumer.guitarNotes.length, 0)
  f.dispose()
})

it('maps Agent modes by semantic expression file and keeps mouse locked through the animation handoff', async () => {
  const { host, advance, expressionIndices } = fixture()
  await host.load('model', 'mikucat')

  assert.equal(host.applyAgentPresentation('angry'), true)
  assert.deepEqual(expressionIndices, [2])
  assert.equal(host.mouseInput.accepts(host.mouseInput.begin()), false)

  assert.equal(host.applyAgentPresentation('guitar'), true)
  assert.deepEqual(expressionIndices, [2, 3])
  assert.equal(host.mouseInput.accepts(host.mouseInput.begin()), false)
  advance(ANGRY_ANIMATION.exitMs)
  assert.equal(host.isGuitarPerforming, true)

  assert.equal(host.applyAgentPresentation('relaxed'), true)
  assert.deepEqual(expressionIndices, [2, 3, 0])
  assert.equal(host.mouseInput.accepts(host.mouseInput.begin()), false)
  advance(GUITAR_PERFORMANCE.exitMs)
  assert.equal(host.isGuitarPerforming, false)
  assert.equal(host.mouseInput.accepts(host.mouseInput.begin()), true)
})

it('restores the default expression immediately and mouse ownership after the released Agent animation exits', async () => {
  const { host, advance, expressionIndices } = fixture()
  await host.load('model', 'mikucat')
  host.applyAgentPresentation('angry')

  assert.equal(host.releaseAgentPresentation(), true)
  assert.deepEqual(expressionIndices, [2, 0])
  assert.equal(host.mouseInput.accepts(host.mouseInput.begin()), false)
  advance(ANGRY_ANIMATION.exitMs)
  assert.equal(host.mouseInput.accepts(host.mouseInput.begin()), true)
})

it('does not apply Agent presentation to models without the MikuCat capability', async () => {
  const { host, expressionIndices } = fixture()
  await host.load('model', 'standard')

  assert.equal(host.applyAgentPresentation('guitar'), false)
  assert.deepEqual(expressionIndices, [])
  assert.equal(host.mouseInput.accepts(host.mouseInput.begin()), true)
})

it('runs the restrained angry animation only for the built-in MikuCat expression', async () => {
  const { host, advance, callbacks, parameterWrites } = fixture()
  await host.load('model', 'mikucat')

  host.setExpression(2)
  advance(ANGRY_ANIMATION.enterMs)

  assert.equal(host.isAngryAnimating, true)
  assert.equal(host.angryAnimationSnapshot.phase, 'playing')
  assert.equal(host.angryAnimationSnapshot.intensity, 'annoyed')
  assert.equal(callbacks.size, 1)

  host.setExpression(0)
  advance(ANGRY_ANIMATION.exitMs)

  assert.equal(host.isAngryAnimating, false)
  assert.equal(callbacks.size, 0)
  const released = parameterWrites
    .filter(([, , weight]) => weight === 0)
    .map(([id]) => id)
  assert.deepEqual([...new Set(released)].sort(), [...MIKUCAT_ANGRY_OWNED_PARAMETERS].sort())

  await host.load('model', 'standard')
  host.setExpression(2)
  assert.equal(host.isAngryAnimating, false)
  assert.equal(callbacks.size, 0)
})

it('forwards the selected angry intensity and its leek-hand gesture into the next isolated angry entry', async () => {
  const { host, advance, parameters } = fixture()
  await host.load('model', 'mikucat')

  assert.equal(host.setAngryAnimationIntent({ intensity: 'impatient' }), true)
  host.setExpression(2)
  advance(ANGRY_ANIMATION.enterMs)

  assert.equal(host.angryAnimationSnapshot.intensity, 'impatient')
  assert.deepEqual(host.angryAnimationSnapshot.requestedIntent, { intensity: 'impatient' })

  advance(1250)
  assert.ok(Math.hypot(host.angryAnimationSnapshot.leekHand.x, host.angryAnimationSnapshot.leekHand.y) >= 12)
  assert.equal(parameters.get(MIKUCAT_LEEK_HAND_CHANNELS.x), host.angryAnimationSnapshot.leekHand.x)
  assert.equal(parameters.get(MIKUCAT_LEEK_HAND_CHANNELS.y), host.angryAnimationSnapshot.leekHand.y)
  assert.equal(parameters.has('Param23'), false)
  assert.equal(parameters.has('Param24'), false)
  assert.equal(parameters.get(MIKUCAT_NORMAL_LEFT_HAND_CHANNELS.x), host.angryAnimationSnapshot.normalLeftHand.x)
  assert.equal(parameters.get(MIKUCAT_NORMAL_LEFT_HAND_CHANNELS.y), host.angryAnimationSnapshot.normalLeftHand.y)
})

it('adopts a live angry intensity at the safe loop boundary without adding another ticker', async () => {
  const { host, advance, callbacks } = fixture()
  await host.load('model', 'mikucat')

  host.setExpression(2)
  advance(ANGRY_ANIMATION.enterMs)
  assert.equal(callbacks.size, 1)

  assert.equal(host.setAngryAnimationIntent({ intensity: 'impatient' }), true)
  advance(ANGRY_ANIMATION.annoyedLoopMs - 10)
  assert.equal(host.angryAnimationSnapshot.intensity, 'annoyed')
  assert.equal(host.angryAnimationSnapshot.transitioningTo, undefined)

  advance(10)
  assert.equal(host.angryAnimationSnapshot.transitioningTo, 'impatient')
  assert.equal(callbacks.size, 1)

  advance(ANGRY_ANIMATION.intensityTransitionMs)
  assert.equal(host.angryAnimationSnapshot.intensity, 'impatient')
  assert.equal(host.angryAnimationSnapshot.transitioningTo, undefined)
  assert.equal(callbacks.size, 1)
})

it('forwards the grounded furious flurry into the same angry player without adding another ticker', async () => {
  const { host, advance, callbacks, parameters } = fixture()
  await host.load('model', 'mikucat')

  assert.equal(host.setAngryAnimationIntent({ intensity: 'furious' }), true)
  host.setExpression(2)
  advance(ANGRY_ANIMATION.enterMs + ANGRY_ANIMATION.furiousLoopMs * 0.64)

  assert.equal(callbacks.size, 1)
  assert.equal(host.angryAnimationSnapshot.intensity, 'furious')
  assert.ok(host.angryAnimationSnapshot.body.y < 0)
  assert.ok(Math.hypot(host.angryAnimationSnapshot.leekHand.x, host.angryAnimationSnapshot.leekHand.y) >= 25)
  for (const id of ['Param36', 'Param37', 'Param38', 'Param39', 'Param40', 'Param41']) {
    assert.equal(parameters.has(id), false)
  }
})

it('forwards a presentation profile into the existing guitar player', async () => {
  const { host, advance, callbacks } = fixture()
  await host.load('model', 'mikucat')

  assert.equal(host.setGuitarPerformanceIntent({
    profile: 'drive',
    activity: 1,
    releasing: false,
  }), true)
  host.setExpression(3)
  advance(400)

  assert.equal(callbacks.size, 1)
  assert.equal(host.guitarPerformanceSnapshot.profile, 'drive')
  assert.equal(host.guitarPerformanceSnapshot.phase, 'playing')
})

it('starts angry automatically after guitar releases the shared parameters', async () => {
  const { host, advance, callbacks } = fixture()
  await host.load('model', 'mikucat')
  host.setExpression(3)
  advance(GUITAR_PERFORMANCE.enterMs)

  host.setExpression(2)

  assert.equal(host.guitarPerformanceSnapshot.phase, 'leaving')
  assert.equal(host.angryAnimationSnapshot.phase, 'idle')
  assert.equal(callbacks.size, 1)

  advance(GUITAR_PERFORMANCE.exitMs)

  assert.equal(host.guitarPerformanceSnapshot.phase, 'idle')
  assert.equal(host.angryAnimationSnapshot.phase, 'entering')
  assert.equal(callbacks.size, 1)

  advance(ANGRY_ANIMATION.enterMs)

  assert.equal(host.angryAnimationSnapshot.phase, 'playing')
  assert.equal(callbacks.size, 1)
})

it('starts guitar automatically after angry releases the shared parameters', async () => {
  const { host, advance, callbacks } = fixture()
  await host.load('model', 'mikucat')
  host.setExpression(2)
  advance(ANGRY_ANIMATION.enterMs)

  host.setExpression(3)

  assert.equal(host.angryAnimationSnapshot.phase, 'leaving')
  assert.equal(host.guitarPerformanceSnapshot.phase, 'idle')
  assert.equal(callbacks.size, 1)

  advance(ANGRY_ANIMATION.exitMs)

  assert.equal(host.angryAnimationSnapshot.phase, 'idle')
  assert.equal(host.guitarPerformanceSnapshot.phase, 'entering')
  assert.equal(callbacks.size, 1)

  advance(GUITAR_PERFORMANCE.enterMs)

  assert.equal(host.guitarPerformanceSnapshot.phase, 'playing')
  assert.equal(callbacks.size, 1)
})

it('keeps only the latest target when a cross-mode handoff reverses or returns to default', async () => {
  const { host, advance, callbacks } = fixture()
  await host.load('model', 'mikucat')
  host.setExpression(3)
  advance(GUITAR_PERFORMANCE.enterMs)

  host.setExpression(2)
  advance(80)
  const leavingPose = host.guitarPerformanceSnapshot.strummingGesture
  host.setExpression(3)

  assert.equal(host.guitarPerformanceSnapshot.phase, 'entering')
  assert.deepEqual(host.guitarPerformanceSnapshot.strummingGesture, leavingPose)
  assert.equal(host.angryAnimationSnapshot.phase, 'idle')
  assert.equal(callbacks.size, 1)

  advance(GUITAR_PERFORMANCE.enterMs)
  host.setExpression(2)
  advance(80)
  host.setExpression(0)
  advance(GUITAR_PERFORMANCE.exitMs)

  assert.equal(host.guitarPerformanceSnapshot.phase, 'idle')
  assert.equal(host.angryAnimationSnapshot.phase, 'idle')
  assert.equal(callbacks.size, 0)
  assert.equal(host.mouseInput.accepts(host.mouseInput.begin()), true)
})

it('cancels an angry exit from its current pose when the latest target returns to angry', async () => {
  const { host, advance, callbacks } = fixture()
  await host.load('model', 'mikucat')
  host.setExpression(2)
  advance(ANGRY_ANIMATION.enterMs + 900)

  host.setExpression(3)
  advance(80)
  const leavingHead = host.angryAnimationSnapshot.head
  const leavingHand = host.angryAnimationSnapshot.leekHand
  host.setExpression(2)

  assert.equal(host.angryAnimationSnapshot.phase, 'entering')
  assert.deepEqual(host.angryAnimationSnapshot.head, leavingHead)
  assert.deepEqual(host.angryAnimationSnapshot.leekHand, leavingHand)
  assert.equal(host.guitarPerformanceSnapshot.phase, 'idle')
  assert.equal(callbacks.size, 1)

  advance(ANGRY_ANIMATION.enterMs)

  assert.equal(host.angryAnimationSnapshot.phase, 'playing')
  assert.equal(host.guitarPerformanceSnapshot.phase, 'idle')
  assert.equal(callbacks.size, 1)
})

it('plays dot-eyes once from relaxed and restores the default expression and mouse', async () => {
  const { host, advance, callbacks, expressionIndices } = fixture()
  await host.load('model', 'mikucat')
  host.setExpression(0)

  assert.equal(host.playCompletionAnimation(), true)
  assert.equal(host.isCompletionAnimating, true)
  assert.equal(host.completionAnimationSnapshot.phase, 'playing')
  assert.equal(expressionIndices.at(-1), 1)
  assert.equal(callbacks.size, 1)

  advance(COMPLETION_ANIMATION.actionMs)

  assert.equal(host.completionAnimationSnapshot.phase, 'leaving')
  assert.equal(expressionIndices.at(-1), 0)

  advance(COMPLETION_ANIMATION.returnMs)

  assert.equal(host.isCompletionAnimating, false)
  assert.equal(callbacks.size, 0)
  assert.equal(host.mouseInput.accepts(host.mouseInput.begin()), true)
})

it('waits for guitar to release before starting the completion gesture', async () => {
  const { host, advance, callbacks, expressionIndices } = fixture()
  await host.load('model', 'mikucat')
  host.setExpression(3)
  advance(GUITAR_PERFORMANCE.enterMs)

  assert.equal(host.playCompletionAnimation(), true)
  assert.equal(host.guitarPerformanceSnapshot.phase, 'leaving')
  assert.equal(host.completionAnimationSnapshot.phase, 'idle')
  assert.equal(expressionIndices.at(-1), 3)

  advance(GUITAR_PERFORMANCE.exitMs)

  assert.equal(host.guitarPerformanceSnapshot.phase, 'idle')
  assert.equal(host.completionAnimationSnapshot.phase, 'playing')
  assert.equal(expressionIndices.at(-1), 1)
  assert.equal(callbacks.size, 1)
})

it('lets new angry work preempt completion without a late default expression', async () => {
  const { host, advance, callbacks, expressionIndices } = fixture()
  await host.load('model', 'mikucat')
  host.setExpression(0)
  host.playCompletionAnimation()
  advance(COMPLETION_ANIMATION.popAtMs)

  host.setExpression(2)

  assert.equal(host.completionAnimationSnapshot.phase, 'leaving')
  assert.equal(host.angryAnimationSnapshot.phase, 'idle')
  assert.equal(expressionIndices.at(-1), 2)

  advance(COMPLETION_ANIMATION.preemptExitMs)

  assert.equal(host.completionAnimationSnapshot.phase, 'idle')
  assert.equal(host.angryAnimationSnapshot.phase, 'entering')
  assert.equal(expressionIndices.at(-1), 2)
  assert.equal(callbacks.size, 1)
})

it('finishes completion once when one delayed frame crosses both the action and return', async () => {
  const { host, callbacks, expressionIndices } = fixture()
  await host.load('model', 'mikucat')
  host.setExpression(0)
  host.playCompletionAnimation()

  const [tick] = [...callbacks]

  tick({ deltaMS: COMPLETION_ANIMATION.actionMs + COMPLETION_ANIMATION.returnMs + 1_000 })

  assert.equal(host.completionAnimationSnapshot.phase, 'idle')
  assert.equal(host.isCompletionAnimating, false)
  assert.equal(expressionIndices.at(-1), 0)
  assert.equal(callbacks.size, 0)
})

it('reports actual animation entry instead of the requested mode during handoff', async () => {
  const { host, advance } = fixture()
  const enteredModes: MikuCatEnteredMode[] = []
  await host.load('model', 'mikucat')
  const unsubscribe = host.onAnimationModeChange(mode => enteredModes.push(mode))

  assert.equal(host.enteredAnimationMode, 'relaxed')
  assert.equal(host.applyAgentPresentation('guitar'), true)
  assert.equal(host.enteredAnimationMode, 'guitar')

  assert.equal(host.applyAgentPresentation('angry'), true)
  assert.equal(host.enteredAnimationMode, 'guitar')
  assert.deepEqual(enteredModes, ['guitar'])

  advance(GUITAR_PERFORMANCE.exitMs)

  assert.equal(host.enteredAnimationMode, 'angry')
  assert.deepEqual(enteredModes, ['guitar', 'angry'])

  assert.equal(host.releaseAgentPresentation(), true)
  assert.equal(host.enteredAnimationMode, 'angry')
  advance(ANGRY_ANIMATION.exitMs)

  assert.equal(host.enteredAnimationMode, 'relaxed')
  assert.deepEqual(enteredModes, ['guitar', 'angry', 'relaxed'])

  unsubscribe()
})

it('reports completion as a transient entered mode until it returns to relaxed', async () => {
  const { host, advance } = fixture()
  const enteredModes: MikuCatEnteredMode[] = []
  await host.load('model', 'mikucat')
  host.onAnimationModeChange(mode => enteredModes.push(mode))

  assert.equal(host.applyAgentPresentation('relaxed'), true)
  assert.equal(host.playCompletionAnimation(), true)
  assert.equal(host.enteredAnimationMode, 'completion')

  advance(COMPLETION_ANIMATION.actionMs + COMPLETION_ANIMATION.returnMs)

  assert.equal(host.enteredAnimationMode, 'relaxed')
  assert.deepEqual(enteredModes, ['completion', 'relaxed'])
})

it('accepts the structural state port and aligns effects with real animation entry', async () => {
  let now = 20_000
  const { host, advance } = fixture()
  await host.load('model', 'mikucat')
  const consumer = new MikuCatPresentationConsumer(host, () => now, () => 0)

  consumer.apply({
    snapshot: {
      presentation: { owner: 'agent', mode: 'guitar', generation: 20 },
      child: {
        mode: 'guitar',
        snapshot: {
          lifecycle: 'active',
          parentGeneration: 20,
          revision: 1,
          interaction: 'engaged',
          activity: 0.25,
          releasing: false,
        },
      },
    },
    cues: [{
      source: 'guitar',
      cue: {
        kind: 'press',
        sequence: 1,
        parentGeneration: 20,
        activity: 0.25,
        burst: 0.2,
      },
    }],
  })

  assert.equal(host.enteredAnimationMode, 'guitar')
  assert.equal(consumer.guitarNotes.length, 1)

  now += 100
  consumer.apply({
    snapshot: {
      presentation: { owner: 'agent', mode: 'angry', generation: 21 },
      child: {
        mode: 'angry',
        snapshot: {
          lifecycle: 'active',
          parentGeneration: 21,
          revision: 1,
          intensity: 'annoyed',
        },
      },
    },
    cues: [],
  })

  assert.equal(host.enteredAnimationMode, 'guitar')
  assert.equal(consumer.guitarNotes.length, 0)
  assert.equal(consumer.angryEffects.length, 0)

  advance(GUITAR_PERFORMANCE.exitMs)

  assert.equal(host.enteredAnimationMode, 'angry')
  assert.deepEqual(consumer.angryEffects.map(effect => effect.variant), ['stress-arc'])

  consumer.dispose()
})

it('forwards the development template override without restarting the player', async () => {
  const { host, advance, callbacks } = fixture()
  await host.load('model', 'mikucat')
  host.setGuitarPerformanceIntent({ profile: 'groove', activity: 0.7, releasing: false })
  host.setExpression(3)
  advance(400)

  const phraseNumber = host.guitarPerformanceSnapshot.phraseNumber
  assert.equal(host.setGuitarPerformanceTemplateOverride(GUITAR_SOFT_CLOSE_TEMPLATE_ID), true)
  assert.equal(host.guitarPerformanceSnapshot.templateOverride, GUITAR_SOFT_CLOSE_TEMPLATE_ID)
  assert.equal(host.guitarPerformanceSnapshot.phraseNumber, phraseNumber)
  assert.equal(callbacks.size, 1)
})

it('forwards a contextual Motif preview without creating another ticker', async () => {
  const { host, advance, callbacks } = fixture()
  await host.load('model', 'mikucat')
  host.setGuitarPerformanceIntent({ profile: 'groove', activity: 0.7, releasing: false })
  assert.equal(host.setGuitarMotifPreview(IMMERSED_DOUBLE_NOD_MOTIF_ID), true)
  host.setExpression(3)
  advance(400)

  assert.equal(host.guitarPerformanceSnapshot.activeMotifPreview, IMMERSED_DOUBLE_NOD_MOTIF_ID)
  assert.equal(callbacks.size, 1)
  assert.equal(host.setGuitarMotifPreview(undefined), true)
  assert.equal(callbacks.size, 1)
})

it('returns head and hand control to the latest cursor target, even if it moves during the exit', async () => {
  const { host, advance, callbacks, parameters } = fixture()
  await host.load('model', 'mikucat')
  assert.equal(host.isGuitarPerforming, false)
  host.mouseInput.write('ParamMouseX', 14)
  host.mouseInput.write('ParamAngleX', -17)
  host.mouseInput.write('ParamAngleY', 12)
  host.setExpression(3)
  assert.equal(host.isGuitarPerforming, true)
  assert.equal(parameters.get('ParamMouseX'), 0)
  assert.equal(parameters.get('ParamAngleX'), -17)
  assert.equal(parameters.get('ParamAngleY'), 12)
  assert.equal(parameters.get('Param23'), 0)
  advance(1000)
  host.mouseInput.write('ParamMouseX', -20)
  host.mouseInput.write('ParamMouseY', 9)
  host.mouseInput.write('ParamAngleX', 22)
  host.mouseInput.write('ParamAngleY', -16)
  assert.notEqual(parameters.get('ParamMouseX'), -20)
  assert.notEqual(parameters.get('ParamAngleX'), 22)
  assert.notEqual(parameters.get('ParamAngleY'), -16)
  host.setExpression(0)
  assert.equal(host.isGuitarPerforming, false)
  advance(100)
  host.mouseInput.write('ParamMouseX', -8)
  host.mouseInput.write('ParamAngleX', -11)
  advance(140)
  assert.equal(callbacks.size, 0)
  assert.equal(parameters.get('ParamMouseX'), -8)
  assert.equal(parameters.get('ParamMouseY'), 9)
  assert.equal(parameters.get('ParamAngleX'), -11)
  assert.equal(parameters.get('ParamAngleY'), -16)
  host.mouseInput.write('ParamMouseX', 5)
  host.mouseInput.write('ParamAngleY', 8)
  assert.equal(parameters.get('ParamMouseX'), 5)
  assert.equal(parameters.get('ParamAngleY'), 8)
})

it('releases every persistent guitar and mouse-control override before returning to manual input', async () => {
  const { host, advance, callbacks, parameterWrites } = fixture()
  await host.load('model', 'mikucat')
  host.setExpression(3)
  advance(700)
  host.setExpression(0)
  advance(300)

  assert.equal(callbacks.size, 0)
  const released = parameterWrites
    .filter(([, , weight]) => weight === 0)
    .map(([id]) => id)
  assert.deepEqual([...new Set(released)].sort(), [...MIKUCAT_GUITAR_OWNED_PARAMETERS].sort())
})

it('keeps one ticker through repeated selection and re-entry, and removes it on model replacement', async () => {
  const { host, advance, callbacks, parameters } = fixture()
  await host.load('model', 'mikucat')
  host.setExpression(3)
  advance(700)
  host.setExpression(3)
  assert.equal(callbacks.size, 1)
  host.setExpression(1)
  advance(50)
  const pose = parameters.get('Param23')
  const head = parameters.get('ParamAngleX')
  host.setExpression(3)
  assert.equal(parameters.get('Param23'), pose)
  assert.equal(parameters.get('ParamAngleX'), head)
  advance(500)
  assert.equal(callbacks.size, 1)
  assert.equal(host.mouseInput.accepts(host.mouseInput.begin()), false)
  const oldToken = host.mouseInput.begin()
  await host.load('other', 'standard')
  assert.equal(callbacks.size, 0)
  parameters.clear()
  host.mouseInput.write('ParamMouseX', 12, oldToken)
  advance(1000)
  assert.equal(parameters.size, 0)
  host.destroy()
})

it('does not start guitar control for other presets or an imported model with the same expressions', async () => {
  const { host, callbacks, parameters } = fixture()
  for (const preset of ['standard', 'keyboard', 'gamepad', undefined]) {
    await host.load('model', preset)
    host.setExpression(3)
    assert.equal(callbacks.size, 0)
    host.mouseInput.write('ParamMouseY', 21)
    assert.equal(parameters.get('ParamMouseY'), 21)
  }
})
