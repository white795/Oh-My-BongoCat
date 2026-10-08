/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { CharacterMode } from './characterPresentation.ts'

import { CharacterPresentationAdapter } from './characterPresentationAdapter.ts'

function target() {
  const calls: Array<['apply', CharacterMode] | ['release']> = []

  return {
    calls,
    target: {
      applyAgentPresentation(mode: CharacterMode) {
        calls.push(['apply', mode])
        return true
      },
      releaseAgentPresentation() {
        calls.push(['release'])
        return true
      },
    },
  }
}

describe('character presentation adapter', () => {
  it('applies each new generation once and preserves the reducer mode', () => {
    const fixture = target()
    const adapter = new CharacterPresentationAdapter(fixture.target)

    assert.equal(adapter.apply({ owner: 'agent', mode: 'guitar', generation: 1 }), true)
    assert.equal(adapter.apply({ owner: 'agent', mode: 'guitar', generation: 1 }), false)
    assert.equal(adapter.apply({ owner: 'manual', generation: 0 }), false)
    assert.equal(adapter.apply({ owner: 'agent', mode: 'angry', generation: 2 }), true)
    assert.equal(adapter.apply({ owner: 'agent', mode: 'relaxed', generation: 3 }), true)

    assert.deepEqual(fixture.calls, [
      ['apply', 'guitar'],
      ['apply', 'angry'],
      ['apply', 'relaxed'],
    ])
  })

  it('releases the presentation target when ownership returns to manual', () => {
    const fixture = target()
    const adapter = new CharacterPresentationAdapter(fixture.target)

    adapter.apply({ owner: 'agent', mode: 'angry', generation: 1 })

    assert.equal(adapter.apply({ owner: 'manual', generation: 2 }), true)
    assert.deepEqual(fixture.calls, [
      ['apply', 'angry'],
      ['release'],
    ])
  })

  it('does not consume a generation until the presentation target accepts it', () => {
    let ready = false
    let attempts = 0
    const adapter = new CharacterPresentationAdapter({
      applyAgentPresentation() {
        attempts++
        return ready
      },
      releaseAgentPresentation() {
        return true
      },
    })
    const snapshot = { owner: 'agent', mode: 'guitar', generation: 1 } as const

    assert.equal(adapter.apply(snapshot), false)
    ready = true
    assert.equal(adapter.apply(snapshot), true)
    assert.equal(attempts, 2)
  })
})
