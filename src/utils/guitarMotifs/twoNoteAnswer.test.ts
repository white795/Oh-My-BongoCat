/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { TWO_NOTE_ANSWER_MOTIF, TWO_NOTE_ANSWER_MOTIF_ID } from './twoNoteAnswer.ts'

describe('two-note-answer motif', () => {
  it('answers with two held presses at one fret and lifts the head after the stronger note', () => {
    const motif = TWO_NOTE_ANSWER_MOTIF

    assert.equal(motif.id, TWO_NOTE_ANSWER_MOTIF_ID)
    assert.equal(motif.label, 'TWO NOTE ANSWER')
    assert.equal(motif.homeProfile, 'engaged')
    assert.equal(motif.minimumProfile, 'autonomous')
    assert.equal(motif.durationBeats, 4)
    assert.deepEqual(motif.steps, [
      ['pick', 0.5, 0.58],
      ['rest', 0.75, 1],
      ['pick', 0.5, 0.8],
      ['rest', 0.75, 1],
      ['settle', 1.5, 1],
    ])
    assert.equal(motif.steps.reduce((beats, [, count]) => beats + count, 0), motif.durationBeats)
    const picks = motif.steps.filter(([clip]) => clip === 'pick')
    assert.equal(picks.length, 2, 'only the two answer notes should be picked')
    assert.ok(picks[1][2] - picks[0][2] >= 0.2, 'the second answer should be clearly stronger')

    const fretting = motif.tracks.frettingHand
    const firstPress = fretting.filter(key => key.at >= 0.06 && key.at <= 0.13)
    const secondPress = fretting.filter(key => key.at >= 0.33 && key.at <= 0.44)
    assert.equal(firstPress.length, 2, 'the first note should press and hold once')
    assert.equal(secondPress.length, 2, 'the second note should press and hold once')
    assert.deepEqual({ x: firstPress[0].x, y: firstPress[0].y }, { x: firstPress[1].x, y: firstPress[1].y })
    assert.deepEqual({ x: secondPress[0].x, y: secondPress[0].y }, { x: secondPress[1].x, y: secondPress[1].y })
    assert.equal(firstPress[0].x, secondPress[0].x, 'both answers should use the same fret position')
    assert.ok(secondPress[0].y <= firstPress[0].y - 0.1, 'the second press should be visibly deeper')
    const frettingRange = Math.max(...fretting.map(key => key.x)) - Math.min(...fretting.map(key => key.x))
    assert.ok(frettingRange <= 0.03, 'the two-note answer must not walk along the fretboard')

    const headLift = motif.tracks.head.reduce((peak, key) => key.y > peak.y ? key : peak)
    assert.ok(headLift.at >= 0.5 && headLift.at <= 0.65, 'the head should lift only after both notes have answered')
    assert.ok(headLift.y >= 0.3 && headLift.y <= 0.4)

    const maxBodyX = Math.max(...motif.tracks.body.map(key => Math.abs(key.x)))
    const maxBodyY = Math.max(...motif.tracks.body.map(key => Math.abs(key.y)))
    assert.ok(maxBodyX <= 0.32 && maxBodyY <= 0.28, 'the body may participate but must not perform a heavy sweep')

    assertOrderedContinuousTracks(motif.tracks)
    assertLoopExit(motif.tracks)
  })
})

function assertOrderedContinuousTracks(tracks: typeof TWO_NOTE_ANSWER_MOTIF.tracks) {
  for (const [name, keys] of Object.entries(tracks)) {
    let previous = 0
    for (const key of keys) {
      assert.ok(key.at > previous && key.at <= 1, `${name} keys must be ordered`)
      assert.ok(key.at - previous <= 0.22, `${name} must remain alive between the two short notes`)
      previous = key.at
    }
    assert.equal(keys.at(-1)!.at, 1, `${name} must reach the A boundary`)
  }
}

function assertLoopExit(tracks: typeof TWO_NOTE_ANSWER_MOTIF.tracks) {
  for (const [name, keys] of Object.entries(tracks)) {
    const first = keys[0]
    const last = keys.at(-1)!
    assert.ok(Math.abs(last.x - first.x) <= 0.03, `${name} should return to its loop-side X pose`)
    assert.ok(Math.abs(last.y - first.y) <= 0.03, `${name} should return to its loop-side Y pose`)
  }
}
