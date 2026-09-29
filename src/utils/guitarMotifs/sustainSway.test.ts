/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { SUSTAIN_SWAY_MOTIF, SUSTAIN_SWAY_MOTIF_ID } from './sustainSway.ts'

describe('sustain-sway motif', () => {
  it('strikes once, holds one chord and breathes through the sustained note', () => {
    const motif = SUSTAIN_SWAY_MOTIF

    assert.equal(motif.id, SUSTAIN_SWAY_MOTIF_ID)
    assert.equal(motif.label, 'SUSTAIN SWAY')
    assert.equal(motif.homeProfile, 'autonomous')
    assert.equal(motif.minimumProfile, 'autonomous')
    assert.equal(motif.durationBeats, 4)
    assert.deepEqual(motif.steps, [
      ['down', 1, 0.76],
      ['rest', 2, 1],
      ['settle', 1, 1],
    ])
    assert.equal(motif.steps.reduce((beats, [, count]) => beats + count, 0), motif.durationBeats)
    assert.equal(motif.steps.filter(([clip]) => clip === 'down').length, 1, 'the sustained note should have one attack')

    const fretting = motif.tracks.frettingHand
    const heldChord = fretting.filter(key => key.at >= 0.12 && key.at <= 0.7)
    assert.ok(heldChord.length >= 4, 'the fretting hand should visibly hold the chord through the long note')
    assert.ok(heldChord.every(key => key.x === heldChord[0].x && key.y === heldChord[0].y))
    assert.ok(heldChord[0].y <= -0.16, 'the held chord should stay pressed rather than hovering')

    const bodyBreath = motif.tracks.body.filter(key => key.at >= 0.38 && key.at <= 0.82)
    assert.ok(
      bodyBreath.every((key, index) => index === 0 || key.x > bodyBreath[index - 1].x),
      'the sustained section should contain one slow weight transfer rather than beat pulses',
    )
    assert.ok(bodyBreath.at(-1)!.x - bodyBreath[0].x >= 0.5, 'the slow sway should remain visible')
    assert.ok(Math.max(...motif.tracks.body.map(key => Math.abs(key.y))) <= 0.2, 'the body must not hide another accent')

    const head = motif.tracks.head
    const headTravelY = Math.max(...head.map(key => key.y)) - Math.min(...head.map(key => key.y))
    assert.ok(headTravelY >= 0.24 && headTravelY <= 0.36, 'the head should breathe without becoming a featured gesture')

    for (const [name, keys] of Object.entries(motif.tracks)) {
      let previous = 0
      for (const key of keys) {
        assert.ok(key.at > previous && key.at <= 1, `${name} keys must be ordered`)
        assert.ok(key.at - previous <= 0.25, `${name} must keep the long note alive`)
        previous = key.at
      }

      const entry = keys[0]
      const exit = keys.at(-1)!
      assert.equal(exit.at, 1, `${name} must reach the loop boundary`)
      assert.ok(Math.abs(exit.x - entry.x) <= 0.03, `${name} must return near its entry x`)
      assert.ok(Math.abs(exit.y - entry.y) <= 0.03, `${name} must return near its entry y`)
    }
  })
})
