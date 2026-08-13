/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { ActivityBuffer, InputActivityEdges } from './inputStatistics.ts'

describe('input statistics event semantics', () => {
  it('counts one keyboard activity per press edge and ignores repeat presses', () => {
    const edges = new InputActivityEdges()

    assert.equal(edges.handle('KeyboardPress', 'KeyA'), 'keyboard')
    assert.equal(edges.handle('KeyboardPress', 'KeyA'), undefined)
    assert.equal(edges.handle('KeyboardRelease', 'KeyA'), undefined)
    assert.equal(edges.handle('KeyboardPress', 'KeyA'), 'keyboard')
  })

  it('can recover a key whose release event was lost', () => {
    const edges = new InputActivityEdges()

    assert.equal(edges.handle('KeyboardPress', 'MetaLeft'), 'keyboard')
    assert.equal(edges.handle('KeyboardPress', 'MetaLeft'), undefined)

    edges.releaseKey('MetaLeft')

    assert.equal(edges.handle('KeyboardPress', 'MetaLeft'), 'keyboard')
  })

  it('counts mouse presses but not releases or movement', () => {
    const edges = new InputActivityEdges()

    assert.equal(edges.handle('MousePress', 'Left'), 'mouse')
    assert.equal(edges.handle('MouseRelease', 'Left'), undefined)
    assert.equal(edges.handle('MouseMove', ''), undefined)
  })

  it('buffers multiple events without storing key or button values', () => {
    const buffer = new ActivityBuffer()

    buffer.record('keyboard', new Date(2026, 7, 12, 23, 59, 59))
    buffer.record('keyboard', new Date(2026, 7, 12, 23, 59, 59))
    buffer.record('mouse', new Date(2026, 7, 13, 0, 0, 1))

    assert.deepEqual(buffer.drain(), {
      '2026-08-12': { keyboard: 2, mouse: 0, controller: 0 },
      '2026-08-13': { keyboard: 0, mouse: 1, controller: 0 },
    })
    assert.equal(buffer.empty, true)
  })
})
