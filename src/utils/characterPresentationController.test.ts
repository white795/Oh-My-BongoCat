/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { Model } from './modelPresets.ts'

import {
  CharacterPresentationController,
  supportsAgentPresentation,
} from './characterPresentationController.ts'

const mikuCat: Model = {
  id: 'preset:mikucat',
  path: 'assets/models/mikucat',
  mode: 'standard',
  isPreset: true,
  presetKey: 'mikucat',
}

const standardCat: Model = {
  id: 'preset:standard',
  path: 'assets/models/standard',
  mode: 'standard',
  isPreset: true,
  presetKey: 'standard',
}

function session(
  state: 'idle' | 'working' | 'waiting' | 'done',
  sessionId: string = state,
) {
  return { sessionId, state }
}

describe('character presentation controller', () => {
  it('only declares the built-in MikuCat preset as Agent-controllable', () => {
    assert.equal(supportsAgentPresentation(mikuCat), true)
    assert.equal(supportsAgentPresentation(standardCat), false)
    assert.equal(supportsAgentPresentation({ ...mikuCat, isPreset: false }), false)
    assert.equal(supportsAgentPresentation(undefined), false)
  })

  it('restores the latest ambient snapshot before taking control', () => {
    const controller = new CharacterPresentationController()

    controller.applyAmbient({ sequence: 4, sessions: [session('waiting')] })
    controller.setModel(mikuCat)
    const takeover = controller.setAgentRequested(true)

    assert.equal(takeover.changed, true)
    assert.deepEqual(controller.snapshot, { owner: 'agent', mode: 'angry', generation: 1 })
    assert.equal(controller.manualControlAllowed, false)
  })

  it('keeps manual control on unsupported models and takes over from the cached state after selecting MikuCat', () => {
    const controller = new CharacterPresentationController()

    controller.applyAmbient({ sequence: 8, sessions: [session('working')] })
    controller.setModel(standardCat)
    controller.setAgentRequested(true)

    assert.deepEqual(controller.snapshot, { owner: 'manual', generation: 0 })
    assert.equal(controller.manualControlAllowed, true)

    const modelChange = controller.setModel(mikuCat)

    assert.equal(modelChange.changed, true)
    assert.deepEqual(modelChange.current, { owner: 'agent', mode: 'guitar', generation: 1 })
  })

  it('returns control immediately when the model becomes unsupported and reuses newer cached state on return', () => {
    const controller = new CharacterPresentationController()

    controller.applyAmbient({ sequence: 12, sessions: [session('working')] })
    controller.setModel(mikuCat)
    controller.setAgentRequested(true)

    const release = controller.setModel(standardCat)

    assert.deepEqual(release.current, { owner: 'manual', generation: 2 })

    controller.applyAmbient({ sequence: 13, sessions: [session('waiting')] })

    assert.deepEqual(
      controller.setModel(mikuCat).current,
      { owner: 'agent', mode: 'angry', generation: 3 },
    )
  })

  it('returns control immediately when Agent control is disabled', () => {
    const controller = new CharacterPresentationController()

    controller.applyAmbient({ sequence: 20, sessions: [session('working')] })
    controller.setModel(mikuCat)
    controller.setAgentRequested(true)

    const release = controller.setAgentRequested(false)

    assert.deepEqual(release.current, { owner: 'manual', generation: 2 })
    assert.equal(controller.manualControlAllowed, true)
  })
})
