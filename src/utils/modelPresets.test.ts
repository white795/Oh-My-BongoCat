/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { Model, ModelMode, ModelPresetKey } from './modelPresets.ts'

import { initializeModelPresets } from './modelPresets.ts'

const resolvePath = (key: ModelPresetKey) => `D:/BongoCat/assets/models/${key}`
const legacyModes: ModelMode[] = ['standard', 'keyboard', 'gamepad']
const keys: ModelPresetKey[] = [...legacyModes, 'mikucat']

function legacyModels(): Model[] {
  return legacyModes.map(mode => ({
    id: `saved-${mode}`,
    path: `C:/OldInstall/assets/models/${mode}`,
    mode,
    isPreset: true,
  }))
}

describe('built-in model registration', () => {
  it('adds MikuCat as the fourth built-in while keeping standard as the default', () => {
    const result = initializeModelPresets([], undefined, resolvePath)

    assert.deepEqual(result.models.map(model => model.presetKey), keys)
    assert.deepEqual(result.models.map(model => model.mode), [...legacyModes, 'standard'])
    assert.ok(result.models.every(model => model.isPreset))
    assert.equal(result.currentModel.presetKey, 'standard')
    assert.equal(result.models[3].path, resolvePath('mikucat'))
    assert.equal(new Set(result.models.map(model => model.id)).size, 4)
  })

  it('preserves each legacy selection and ID so existing shortcut keys remain valid', () => {
    const models = legacyModels()
    const before = structuredClone(models)
    const shortcuts = Object.fromEntries(models.map(model => [`${model.id}:expression:0`, 'Alt+1']))

    for (const selected of models) {
      const result = initializeModelPresets(models, selected.id, resolvePath)

      assert.equal(result.currentModel.id, selected.id)
      for (const original of models) {
        const migrated = result.models.find(model => model.presetKey === original.mode)!
        assert.equal(migrated.id, original.id)
        assert.equal(migrated.path, resolvePath(original.mode))
        assert.equal(shortcuts[`${migrated.id}:expression:0`], 'Alt+1')
      }
    }

    assert.deepEqual(models, before)
  })

  it('keeps a selected imported MikuCat separate and leaves custom entries unchanged', () => {
    const imported: Model = { id: 'imported-miku', path: 'D:/Custom/miku', mode: 'standard', isPreset: false }
    const other: Model = { id: 'custom-keys', path: 'D:/Custom/keys', mode: 'keyboard', isPreset: false }
    const result = initializeModelPresets([imported, ...legacyModels(), other], imported.id, resolvePath)

    assert.equal(result.models.length, 6)
    assert.deepEqual(result.models.slice(4), [imported, other])
    assert.equal(result.currentModel, imported)
    assert.notEqual(result.models[3].id, imported.id)
  })

  it('uses preset identity instead of mode when both standard-based models already exist', () => {
    const miku: Model = { id: 'saved-miku', path: 'old/miku', mode: 'standard', isPreset: true, presetKey: 'mikucat' }
    const standard: Model = { id: 'saved-original', path: 'old/cat', mode: 'standard', isPreset: true, presetKey: 'standard' }
    const result = initializeModelPresets([miku, standard], miku.id, resolvePath)

    assert.equal(result.models[0].id, standard.id)
    assert.equal(result.models[3].id, miku.id)
    assert.equal(result.currentModel.presetKey, 'mikucat')
    assert.equal(new Set(result.models.map(model => model.id)).size, 4)
  })

  it('does not borrow the MikuCat ID when rebuilding a missing original standard model', () => {
    const miku: Model = { id: 'saved-miku', path: 'old/miku', mode: 'standard', isPreset: true, presetKey: 'mikucat' }
    const result = initializeModelPresets([miku], miku.id, resolvePath)

    assert.notEqual(result.models[0].id, miku.id)
    assert.equal(result.models[3].id, miku.id)
    assert.equal(result.currentModel.presetKey, 'mikucat')
  })

  it('keeps IDs and selection across restarts and installation path changes without duplicates', () => {
    const first = initializeModelPresets(legacyModels(), undefined, resolvePath)
    const selectedId = first.models.find(model => model.presetKey === 'mikucat')!.id
    const movedPath = (key: ModelPresetKey) => `E:/NewInstall/assets/models/${key}`
    const second = initializeModelPresets(first.models, selectedId, movedPath)
    const third = initializeModelPresets(second.models, selectedId, movedPath)

    assert.deepEqual(second.models.map(model => model.id), first.models.map(model => model.id))
    assert.deepEqual(second.models.map(model => model.path), keys.map(movedPath))
    assert.equal(second.currentModel.id, selectedId)
    assert.deepEqual(third, second)
  })

  it('assigns the same new built-in IDs to independent initializations', () => {
    const first = initializeModelPresets([], undefined, resolvePath)
    const second = initializeModelPresets([], undefined, resolvePath)

    assert.deepEqual(first, second)
  })

  it('falls back to the original standard model when the saved selection is missing', () => {
    const result = initializeModelPresets(legacyModels(), 'deleted-model', resolvePath)

    assert.equal(result.currentModel.id, 'saved-standard')
  })
})
