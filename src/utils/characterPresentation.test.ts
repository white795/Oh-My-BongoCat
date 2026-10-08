/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { CharacterPresentationReducer } from './characterPresentation.ts'

function session(
  state: 'idle' | 'working' | 'waiting' | 'done',
  sessionId: string = state,
) {
  return { sessionId, state }
}

describe('agent character presentation ownership', () => {
  it('caches ambient sessions while manual and derives the current mode immediately on takeover', () => {
    const reducer = new CharacterPresentationReducer()

    const ambient = reducer.applyAmbient({
      sequence: 4,
      sessions: [session('waiting')],
    })

    assert.equal(ambient.changed, false)
    assert.deepEqual(ambient.current, { owner: 'manual', generation: 0 })

    const takeover = reducer.setAgentEnabled(true)

    assert.equal(takeover.changed, true)
    assert.deepEqual(takeover.previous, { owner: 'manual', generation: 0 })
    assert.deepEqual(takeover.current, { owner: 'agent', mode: 'angry', generation: 1 })
  })

  it('reduces all sessions with waiting above working above relaxed', () => {
    const reducer = new CharacterPresentationReducer()

    reducer.setAgentEnabled(true)

    assert.deepEqual(
      reducer.applyAmbient({
        sequence: 1,
        sessions: [session('done'), session('working')],
      }).current,
      { owner: 'agent', mode: 'guitar', generation: 2 },
    )
    assert.deepEqual(
      reducer.applyAmbient({
        sequence: 2,
        sessions: [session('working'), session('waiting'), session('done')],
      }).current,
      { owner: 'agent', mode: 'angry', generation: 3 },
    )
    assert.deepEqual(
      reducer.applyAmbient({
        sequence: 3,
        sessions: [session('working'), session('done')],
      }).current,
      { owner: 'agent', mode: 'guitar', generation: 4 },
    )
    assert.deepEqual(
      reducer.applyAmbient({
        sequence: 4,
        sessions: [session('done'), session('idle')],
      }).current,
      { owner: 'agent', mode: 'relaxed', generation: 5 },
    )
  })

  it('does not restart a presentation when newer hook events reduce to the same mode', () => {
    const reducer = new CharacterPresentationReducer()

    reducer.applyAmbient({ sequence: 10, sessions: [session('working')] })
    reducer.setAgentEnabled(true)

    const repeated = reducer.applyAmbient({
      sequence: 11,
      sessions: [session('working'), session('working')],
    })

    assert.equal(repeated.changed, false)
    assert.deepEqual(repeated.current, { owner: 'agent', mode: 'guitar', generation: 1 })
  })

  it('ignores an out-of-order ambient snapshot instead of restoring a stale mode', () => {
    const reducer = new CharacterPresentationReducer()

    reducer.setAgentEnabled(true)
    reducer.applyAmbient({ sequence: 21, sessions: [session('waiting')] })

    const stale = reducer.applyAmbient({ sequence: 20, sessions: [session('working')] })

    assert.equal(stale.changed, false)
    assert.deepEqual(stale.current, { owner: 'agent', mode: 'angry', generation: 2 })
  })

  it('hands control back to manual and uses snapshots received while manual on the next takeover', () => {
    const reducer = new CharacterPresentationReducer()

    reducer.applyAmbient({ sequence: 30, sessions: [session('working')] })
    reducer.setAgentEnabled(true)

    const release = reducer.setAgentEnabled(false)

    assert.deepEqual(release.previous, { owner: 'agent', mode: 'guitar', generation: 1 })
    assert.deepEqual(release.current, { owner: 'manual', generation: 2 })

    reducer.applyAmbient({ sequence: 31, sessions: [session('done')] })

    assert.deepEqual(
      reducer.setAgentEnabled(true).current,
      { owner: 'agent', mode: 'relaxed', generation: 3 },
    )
  })

  it('emits one completion cue when the final active session transitions to done', () => {
    const reducer = new CharacterPresentationReducer()

    reducer.setAgentEnabled(true)
    reducer.applyAmbient({
      sequence: 40,
      sessions: [session('working', 'a'), session('done', 'b')],
    })

    const completed = reducer.applyAmbient({
      sequence: 41,
      sessions: [session('done', 'a'), session('done', 'b')],
    })

    assert.deepEqual(completed.current, { owner: 'agent', mode: 'relaxed', generation: 3 })
    assert.deepEqual(completed.cues, [{
      kind: 'all-sessions-done',
      ambientSequence: 41,
      presentationGeneration: 3,
    }])

    const repeated = reducer.applyAmbient({
      sequence: 42,
      sessions: [session('done', 'a'), session('done', 'b')],
    })

    assert.equal(repeated.changed, false)
    assert.deepEqual(repeated.cues, [])
  })

  it('waits for every active session before emitting the completion cue', () => {
    const reducer = new CharacterPresentationReducer()

    reducer.setAgentEnabled(true)
    reducer.applyAmbient({
      sequence: 50,
      sessions: [session('working', 'a'), session('waiting', 'b')],
    })

    const partial = reducer.applyAmbient({
      sequence: 51,
      sessions: [session('done', 'a'), session('waiting', 'b')],
    })

    assert.deepEqual(partial.cues, [])

    const completed = reducer.applyAmbient({
      sequence: 52,
      sessions: [session('done', 'a'), session('done', 'b')],
    })

    assert.deepEqual(completed.cues.map(cue => cue.kind), ['all-sessions-done'])
  })

  it('does not mistake SessionEnd removal for a completion transition', () => {
    const reducer = new CharacterPresentationReducer()

    reducer.setAgentEnabled(true)
    reducer.applyAmbient({
      sequence: 60,
      sessions: [session('working', 'removed'), session('done', 'remaining')],
    })

    const removed = reducer.applyAmbient({
      sequence: 61,
      sessions: [session('done', 'remaining')],
    })

    assert.deepEqual(removed.current, { owner: 'agent', mode: 'relaxed', generation: 3 })
    assert.deepEqual(removed.cues, [])
  })

  it('does not replay historical completion after reconnecting or enabling Agent control later', () => {
    const reducer = new CharacterPresentationReducer()

    const restored = reducer.applyAmbient({
      sequence: 70,
      sessions: [session('done', 'already-done')],
    })

    assert.deepEqual(restored.cues, [])

    const takeover = reducer.setAgentEnabled(true)

    assert.deepEqual(takeover.current, { owner: 'agent', mode: 'relaxed', generation: 1 })
    assert.deepEqual(takeover.cues, [])
  })
})
