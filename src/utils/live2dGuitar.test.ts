/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { it } from 'node:test'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

import { GuitarHandAnimation } from './guitarHandAnimation.ts'
import { ModelMouseInput } from './modelMouseInput.ts'

// Exercise the real host wrapper; only native IPC, asset loading and WebGL are replaced.
function fixture() {
  const callbacks = new Set<(ticker: { deltaMS: number }) => void>()
  const parameters = new Map<string, number>()
  const selectedExpressions: number[] = []
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
      selectedExpressions.push(index)
    }

    setParameterValueById(id: string, value: number) {
      parameters.set(id, value)
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
    './guitarHandAnimation': { GuitarHandAnimation },
    './modelMouseInput': { ModelMouseInput },
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
    applyAgentPresentation: (mode: 'relaxed' | 'guitar' | 'angry') => boolean
    releaseAgentPresentation: () => boolean
    setExpression: (index: number) => void
    destroy: () => void
    readonly isGuitarPerforming: boolean
    mouseInput: ModelMouseInput
  }
  function advance(ms: number) {
    for (let elapsed = 0; elapsed < ms; elapsed += 10) {
      for (const callback of [...callbacks]) callback({ deltaMS: Math.min(10, ms - elapsed) })
    }
  }
  return { host, advance, callbacks, parameters, selectedExpressions }
}

it('maps Agent modes by semantic expression file and gives mouse control only to relaxed mode', async () => {
  const { host, advance, parameters, selectedExpressions } = fixture()
  await host.load('model', 'mikucat')

  host.mouseInput.write('ParamAngleX', 12)
  assert.equal(host.applyAgentPresentation('angry'), true)
  assert.deepEqual(selectedExpressions, [2])
  assert.equal(host.mouseInput.accepts(host.mouseInput.begin()), false)
  assert.equal(parameters.get('ParamAngleX'), 0)

  host.mouseInput.write('ParamAngleX', -18)
  assert.equal(parameters.get('ParamAngleX'), 0)

  assert.equal(host.applyAgentPresentation('guitar'), true)
  assert.deepEqual(selectedExpressions, [2, 3])
  assert.equal(host.isGuitarPerforming, true)
  assert.equal(host.mouseInput.accepts(host.mouseInput.begin()), false)

  assert.equal(host.applyAgentPresentation('relaxed'), true)
  assert.deepEqual(selectedExpressions, [2, 3, 0])
  advance(1000)
  assert.equal(host.isGuitarPerforming, false)
  assert.equal(host.mouseInput.accepts(host.mouseInput.begin()), true)
})

it('restores the default expression and mouse ownership when Agent control is released', async () => {
  const { host, selectedExpressions } = fixture()
  await host.load('model', 'mikucat')

  host.applyAgentPresentation('angry')

  assert.equal(host.releaseAgentPresentation(), true)
  assert.deepEqual(selectedExpressions, [2, 0])
  assert.equal(host.mouseInput.accepts(host.mouseInput.begin()), true)
})

it('does not apply Agent presentation to models without the MikuCat capability', async () => {
  const { host, selectedExpressions } = fixture()
  await host.load('model', 'standard')

  assert.equal(host.applyAgentPresentation('guitar'), false)
  assert.deepEqual(selectedExpressions, [])
  assert.equal(host.mouseInput.accepts(host.mouseInput.begin()), true)
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
  assert.equal(parameters.get('ParamMouseX'), 14)
  assert.equal(parameters.get('ParamAngleX'), -17)
  assert.equal(parameters.get('ParamAngleY'), 12)
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

it('keeps one ticker through repeated selection and re-entry, and removes it on model replacement', async () => {
  const { host, advance, callbacks, parameters } = fixture()
  await host.load('model', 'mikucat')
  host.setExpression(3)
  advance(700)
  host.setExpression(3)
  assert.equal(callbacks.size, 1)
  host.setExpression(1)
  advance(50)
  const pose = parameters.get('ParamMouseX')
  const head = parameters.get('ParamAngleX')
  host.setExpression(3)
  assert.equal(parameters.get('ParamMouseX'), pose)
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
