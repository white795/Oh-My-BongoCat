/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { CALL_RESPONSE_SWAY_MOTIF, CALL_RESPONSE_SWAY_MOTIF_ID } from './callResponseSway.ts'

describe('call-response-sway motif', () => {
  it('nods twice on the left and twice on the right without turning into a heavy accent', () => {
    const motif = CALL_RESPONSE_SWAY_MOTIF

    assert.equal(motif.id, CALL_RESPONSE_SWAY_MOTIF_ID)
    assert.equal(motif.label, 'CALL RESPONSE SWAY')
    assert.equal(motif.homeProfile, 'groove')
    assert.equal(motif.minimumProfile, 'autonomous')
    assert.equal(motif.durationBeats, 4)
    assert.deepEqual(motif.steps, [
      ['down', 1, 0.64],
      ['up', 1, 0.58],
      ['down', 1, 0.68],
      ['up', 1, 0.62],
    ])
    assert.equal(motif.steps.reduce((beats, [, count]) => beats + count, 0), motif.durationBeats)
    const clips: readonly string[] = motif.steps.map(([clip]) => clip)
    assert.ok(!clips.includes('double') && !clips.includes('accent'), 'the four nods should stay rhythmic rather than flashy')

    const headPresses = motif.tracks.head.filter(key => key.y <= -0.28)
    assert.equal(headPresses.length, 4, 'each beat should contain one readable nod')
    const beatWindows = [[0.08, 0.17], [0.33, 0.42], [0.58, 0.67], [0.83, 0.92]]
    headPresses.forEach((key, index) => {
      const [start, end] = beatWindows[index]
      assert.ok(key.at >= start && key.at <= end, `nod ${index + 1} must land inside its beat`)
      assert.ok(Math.abs(key.y) <= 0.46, `nod ${index + 1} must remain below the DRIVE gesture`)
    })
    assert.ok(headPresses.slice(0, 2).every(key => key.x <= -0.24), 'the first pair should nod from the left side')
    assert.ok(headPresses.slice(2).every(key => key.x >= 0.24), 'the second pair should nod from the right side')

    const rebounds = motif.tracks.head.filter(key => key.y >= 0.08)
    assert.ok(rebounds.some(key => key.at > headPresses[0].at && key.at < headPresses[1].at))
    assert.ok(rebounds.some(key => key.at > headPresses[1].at && key.at < headPresses[2].at))
    assert.ok(rebounds.some(key => key.at > headPresses[2].at && key.at < headPresses[3].at))

    const body = motif.tracks.body
    const leftWeight = body.filter(key => key.at < 0.5).reduce((candidate, key) => key.x < candidate.x ? key : candidate)
    const rightWeight = body.filter(key => key.at >= 0.5 && key.at < 0.94).reduce((candidate, key) => key.x > candidate.x ? key : candidate)
    assert.ok(leftWeight.x <= -0.22, 'the torso should support the left pair')
    assert.ok(rightWeight.x >= 0.22, 'the torso should support the right pair')
    assert.ok(rightWeight.x - leftWeight.x <= 0.65, 'the weight transfer should remain secondary to the nods')
    assert.ok(Math.max(...body.map(key => Math.abs(key.y))) <= 0.22, 'the torso must not hide a heavy vertical accent')

    const fretting = motif.tracks.frettingHand
    const questionChord = fretting.filter(key => key.at < 0.5).reduce((candidate, key) => key.x < candidate.x ? key : candidate)
    const answerChord = fretting.filter(key => key.at >= 0.5 && key.at < 0.9).reduce((candidate, key) => key.x > candidate.x ? key : candidate)
    assert.ok(answerChord.x - questionChord.x >= 0.28, 'the answer pair should use a distinct but compact chord position')
    assert.ok(answerChord.x - questionChord.x <= 0.55, 'the chord change must not become a fretboard run')

    for (const [name, keys] of Object.entries(motif.tracks)) {
      let previous = 0
      for (const key of keys) {
        assert.ok(key.at > previous && key.at <= 1, `${name} keys must be ordered`)
        assert.ok(key.at - previous <= 0.18, `${name} must preserve all four beats`)
        previous = key.at
      }
      assert.equal(keys.at(-1)!.at, 1, `${name} must return at the A boundary`)
    }

    assert.ok(Math.abs(body.at(-1)!.x - body[0].x) <= 0.08, 'the body should return directly toward A')
    assert.ok(Math.abs(fretting.at(-1)!.x - fretting[0].x) <= 0.12, 'the chord hand should return directly toward A')
  })
})
