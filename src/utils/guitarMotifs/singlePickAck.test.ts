/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { SINGLE_PICK_ACK_MOTIF, SINGLE_PICK_ACK_MOTIF_ID } from './singlePickAck.ts'

describe('single-pick-ack motif', () => {
  it('keeps a quiet four-beat carrier and acknowledges input on only the second beat', () => {
    const motif = SINGLE_PICK_ACK_MOTIF

    assert.equal(motif.id, SINGLE_PICK_ACK_MOTIF_ID)
    assert.equal(motif.label, 'SINGLE PICK ACK')
    assert.equal(motif.homeProfile, 'engaged')
    assert.equal(motif.minimumProfile, 'engaged')
    assert.equal(motif.durationBeats, 4)
    assert.deepEqual(motif.steps, [
      ['pick', 1, 0.4],
      ['pick', 1, 0.66],
      ['pick', 1, 0.44],
      ['pick', 1, 0.36],
    ])
    assert.equal(motif.steps.reduce((beats, [, count]) => beats + count, 0), motif.durationBeats)
    assert.ok(motif.steps.every(([clip]) => clip === 'pick'), 'the carrier must keep playing instead of freezing around the acknowledgement')

    const strengths = motif.steps.map(([, , strength]) => strength)
    assert.equal(Math.max(...strengths), strengths[1], 'only beat two should read as the input acknowledgement')
    assert.ok(strengths[1] - Math.max(strengths[0], strengths[2], strengths[3]) >= 0.2)

    const raisedEar = motif.tracks.leftEar.reduce((peak, key) => key.y > peak.y ? key : peak)
    assert.ok(raisedEar.at >= 0.3 && raisedEar.at <= 0.45, 'the ear lift should answer the second-beat pick')
    assert.ok(raisedEar.y >= 0.48, 'the listening ear should be visible without becoming a full-body accent')

    const headReply = motif.tracks.head.reduce((peak, key) => Math.abs(key.y) > Math.abs(peak.y) ? key : peak)
    assert.ok(headReply.at >= 0.55 && headReply.at <= 0.7, 'the small head reply should follow on beat three')
    assert.ok(Math.abs(headReply.y) >= 0.12 && Math.abs(headReply.y) <= 0.2)
    assert.ok(Math.max(...motif.tracks.head.map(key => Math.abs(key.x))) <= 0.1, 'the head response should remain local')

    const bodyRange = Math.max(...motif.tracks.body.map(key => key.x)) - Math.min(...motif.tracks.body.map(key => key.x))
    const frettingRange = Math.max(...motif.tracks.frettingHand.map(key => key.x)) - Math.min(...motif.tracks.frettingHand.map(key => key.x))
    assert.ok(bodyRange <= 0.36, 'one acknowledgement must not become a full-body sweep')
    assert.ok(frettingRange <= 0.2, 'the fretting hand should hold one quiet chord')

    assertOrderedContinuousTracks(motif.tracks)
    assertAExit(motif.tracks)
  })
})

function assertOrderedContinuousTracks(tracks: typeof SINGLE_PICK_ACK_MOTIF.tracks) {
  for (const [name, keys] of Object.entries(tracks)) {
    let previous = 0
    for (const key of keys) {
      assert.ok(key.at > previous && key.at <= 1, `${name} keys must be ordered`)
      assert.ok(key.at - previous <= 0.22, `${name} must retain low-level motion across the carrier`)
      previous = key.at
    }
    assert.equal(keys.at(-1)!.at, 1, `${name} must reach the A boundary`)
  }
}

function assertAExit(tracks: typeof SINGLE_PICK_ACK_MOTIF.tracks) {
  assert.deepEqual(tracks.head.at(-1), { at: 1, x: -0.02, y: 0.06, vx: -0.28 })
  assert.deepEqual(tracks.body.at(-1), { at: 1, x: -0.04, y: 0.14, vx: -0.6 })
  assert.deepEqual(tracks.leftEar.at(-1), { at: 1, x: -0.02, y: 0.07, vx: -0.18 })
  assert.deepEqual(tracks.rightEar.at(-1), { at: 1, x: 0.02, y: 0.06, vx: 0.16 })
  assert.deepEqual(tracks.frettingHand.at(-1), { at: 1, x: -0.12, y: 0.08, vx: -0.4, vy: 0.05 })
}
