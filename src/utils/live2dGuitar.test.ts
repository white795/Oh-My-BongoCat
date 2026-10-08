/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { it } from 'node:test'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

import type { AngryAnimationIntent } from './angryAnimation.ts'
import type { GuitarMotifId } from './guitarMotifs.ts'
import type { GuitarPerformanceIntent, GuitarPerformanceTemplateId } from './guitarPerformance.ts'

import { ANGRY_ANIMATION, AngryAnimation } from './angryAnimation.ts'
import { GuitarHandAnimation } from './guitarHandAnimation.ts'
import { IMMERSED_DOUBLE_NOD_MOTIF_ID } from './guitarMotifs.ts'
import { GUITAR_SOFT_CLOSE_TEMPLATE_ID } from './guitarPerformance.ts'
import { ModelMouseInput } from './modelMouseInput.ts'
import { MIKUCAT_ANGRY_OWNED_PARAMETERS, MIKUCAT_GUITAR_OWNED_PARAMETERS, MIKUCAT_LEEK_HAND_CHANNELS, MIKUCAT_NORMAL_LEFT_HAND_CHANNELS, ModelParameterOwnership } from './modelParameterOwnership.ts'

// Exercise the real host wrapper; only native IPC, asset loading and WebGL are replaced.
function fixture() {
  const callbacks = new Set<(ticker: { deltaMS: number }) => void>()
  const parameters = new Map<string, number>()
  const parameterWrites: Array<[string, number, number]> = []
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

    setExpression() { }
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
    './guitarHandAnimation': { GuitarHandAnimation },
    './modelMouseInput': { ModelMouseInput },
    './modelParameterOwnership': {
      MIKUCAT_ANGRY_OWNED_PARAMETERS,
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
    destroy: () => void
    readonly isGuitarPerforming: boolean
    readonly isAngryAnimating: boolean
    readonly guitarPerformanceSnapshot: GuitarHandAnimation['snapshot']
    readonly angryAnimationSnapshot: AngryAnimation['snapshot']
    mouseInput: ModelMouseInput
  }
  function advance(ms: number) {
    for (let elapsed = 0; elapsed < ms; elapsed += 10) {
      for (const callback of [...callbacks]) callback({ deltaMS: Math.min(10, ms - elapsed) })
    }
  }
  return { host, advance, callbacks, parameters, parameterWrites }
}

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
