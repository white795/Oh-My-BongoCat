/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { SYNCOPATED_CHORD_WALK_MOTIF, SYNCOPATED_CHORD_WALK_MOTIF_ID } from './syncopatedChordWalk.ts'

describe('syncopated-chord-walk motif', () => {
  it('walks three held chord positions through two syncopated gaps and picks up into the loop', () => {
    const motif = SYNCOPATED_CHORD_WALK_MOTIF

    assert.equal(motif.id, SYNCOPATED_CHORD_WALK_MOTIF_ID)
    assert.equal(motif.label, 'SYNCOPATED CHORD WALK')
    assert.equal(motif.homeProfile, 'groove')
    assert.equal(motif.minimumProfile, 'groove')
    assert.equal(motif.durationBeats, 4)
    assert.deepEqual(motif.steps, [
      ['down', 0.5, 0.74],
      ['up', 0.5, 0.64],
      ['rest', 0.5, 1],
      ['down', 0.5, 0.76],
      ['rest', 0.5, 1],
      ['double', 1, 0.82],
      ['settle', 0.5, 1],
    ])
    assert.equal(motif.steps.reduce((beats, [, count]) => beats + count, 0), motif.durationBeats)
    assert.equal(motif.steps.filter(([clip]) => clip === 'rest').length, 2, 'two gaps should expose the chord changes')
    const clips: readonly string[] = motif.steps.map(([clip]) => clip)
    assert.ok(!clips.includes('accent'), 'groove must not turn into an accent')

    const fretting = motif.tracks.frettingHand
    const heldPairs = [[0.03, 0.2], [0.35, 0.49], [0.61, 0.84]].map(([start, end]) => {
      const pair = fretting.filter(key => key.at >= start && key.at <= end)
      assert.equal(pair.length, 2, `the chord at ${start} should land and hold`)
      assert.equal(pair[0].x, pair[1].x)
      assert.equal(pair[0].y, pair[1].y)
      assert.ok(pair[0].y < 0, 'each chord should visibly press into the fretboard')
      return pair[0]
    })
    assert.ok(heldPairs[1].x - heldPairs[0].x >= 0.35, 'the second chord should form a separate middle step')
    assert.ok(heldPairs[2].x - heldPairs[1].x >= 0.35, 'the third chord should form a separate upper step')
    const releases = fretting.filter(key => key.y > 0)
    assert.ok(releases.some(key => key.at > 0.2 && key.at < 0.35), 'the hand should lift before chord two')
    assert.ok(releases.some(key => key.at > 0.49 && key.at < 0.61), 'the hand should lift before chord three')

    const body = motif.tracks.body
    const bodyXs = body.map(key => key.x)
    const bodyYs = body.map(key => key.y)
    assert.ok(Math.min(...bodyXs) <= -0.28 && Math.max(...bodyXs) >= 0.28, 'the torso should support the three chord steps')
    assert.ok(Math.max(...bodyXs) - Math.min(...bodyXs) <= 0.8, 'the torso should remain a stable groove rather than an explosive sweep')
    assert.ok(Math.max(...bodyYs.map(Math.abs)) <= 0.28, 'the chord walk should not hide a vertical accent')

    const head = motif.tracks.head
    const headTravelX = Math.max(...head.map(key => key.x)) - Math.min(...head.map(key => key.x))
    assert.ok(headTravelX <= 0.28, 'the head should only follow the fretboard instead of becoming another nod motif')
    const descent = head.filter(key => key.at >= 0.06 && key.at <= 0.68)
    const lowersContinuously = descent.every((key, index) => index === 0 || key.y <= descent[index - 1].y)
    assert.ok(lowersContinuously, 'the head should lower continuously from chord one instead of dipping once')
    const sustainedLook = head.filter(key => key.at >= 0.5 && key.at <= 0.7 && key.y <= -0.55)
    assert.ok(sustainedLook.length >= 2, 'the head should remain down while checking the later chord positions')
    assert.ok(sustainedLook.at(-1)!.at - sustainedLook[0].at >= 0.14, 'the downward look should be visibly sustained')
    assert.ok(Math.min(...head.map(key => key.y)) >= -0.7, 'the long look should remain below the featured nod range')
    const recovery = head.filter(key => key.at >= 0.68)
    const risesContinuously = recovery.every((key, index) => index === 0 || key.y >= recovery[index - 1].y)
    assert.ok(risesContinuously, 'the head should rise continuously through the end of chord three')
    const verticalSpeeds = head.slice(1).map((key, index) => Math.abs(key.y - head[index].y) / (key.at - head[index].at))
    assert.ok(Math.max(...verticalSpeeds) <= 2.11, 'the long look must not contain a nod-like speed spike')

    for (const [name, keys] of Object.entries(motif.tracks)) {
      let previous = 0
      for (const key of keys) {
        assert.ok(key.at > previous && key.at <= 1, `${name} keys must be ordered`)
        assert.ok(key.at - previous <= 0.25, `${name} must preserve motion through the measure`)
        previous = key.at
      }
      assert.equal(keys.at(-1)!.at, 1, `${name} must reach the A boundary`)
    }

    assert.ok(body.at(-1)!.x > body[0].x, 'the torso boundary should keep travelling toward chord one')
    assert.ok(fretting.at(-1)!.x > fretting[0].x, 'the pickup boundary should keep travelling toward chord one')
  })
})
