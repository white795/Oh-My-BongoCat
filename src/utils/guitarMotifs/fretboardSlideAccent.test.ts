/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { mapGuitarFrettingPose } from '../guitarPerformance.ts'
import { FRETBOARD_SLIDE_ACCENT_MOTIF, FRETBOARD_SLIDE_ACCENT_MOTIF_ID } from './fretboardSlideAccent.ts'

describe('fretboard-slide-accent motif', () => {
  it('authors a left-leaning fast riff, heavy right accent and slow recovery', () => {
    const motif = FRETBOARD_SLIDE_ACCENT_MOTIF

    assert.equal(motif.id, FRETBOARD_SLIDE_ACCENT_MOTIF_ID)
    assert.equal(motif.label, 'FRETBOARD SLIDE ACCENT')
    assert.equal(motif.homeProfile, 'drive')
    assert.equal(motif.minimumProfile, 'drive')
    assert.equal(motif.durationBeats, 4)
    assert.deepEqual(motif.steps, [
      ['pick', 0.5, 0.58],
      ['double', 0.5, 0.72],
      ['double', 0.5, 0.78],
      ['double', 0.5, 0.84],
      ['accent', 0.75, 1.12],
      ['settle', 1.25, 1],
    ])
    assert.equal(motif.steps.reduce((beats, [, count]) => beats + count, 0), motif.durationBeats)
    assert.equal(motif.steps.filter(([clip]) => clip === 'double').length, 3, 'the middle passage should read as a fast riff')

    const fretting = motif.tracks.frettingHand
    const frettingXs = fretting.map(key => key.x)
    const press = fretting.reduce((candidate, key) => key.y < candidate.y ? key : candidate)
    const riffKeys = fretting.filter(key => key.at >= 0.16 && key.at <= 0.62)
    const riffDirections = riffKeys.slice(1).map((key, index) => Math.sign(key.x - riffKeys[index].x))
    const directionChanges = riffDirections.slice(1)
      .filter((direction, index) => direction !== riffDirections[index])
    assert.ok(Math.max(...frettingXs) - Math.min(...frettingXs) >= 0.7, 'the fretting run must visibly traverse the neck')
    assert.ok(directionChanges.length >= 3, 'the fretting hand should perform several quick position changes')
    assert.ok(press.at >= 0.56 && press.at <= 0.7, 'the hand should press before the heavy right sweep')
    assert.ok(press.y <= -0.26, 'the landing should visibly press the chord')
    assert.ok(Math.abs(fretting.at(-1)!.x - fretting[0].x) <= 0.15, 'the loop should return near its entry position')
    assert.equal(motif.frettingAngleDegrees, -40, 'the isolated riff should follow the corrected neck direction')
    const mappedAxis = mapGuitarFrettingPose({ x: 1, y: 0 }, motif.frettingAngleDegrees)
    assert.ok(mappedAxis.x > 0 && mappedAxis.y < 0, 'the corrected local axis should run down-right/up-left')

    const range = (values: number[]) => Math.max(...values) - Math.min(...values)
    const leftLean = motif.tracks.body.reduce((candidate, key) => key.x < candidate.x ? key : candidate)
    const rightAccent = motif.tracks.body.reduce((candidate, key) => key.x > candidate.x ? key : candidate)
    assert.ok(leftLean.at <= 0.25 && leftLean.x <= -0.45, 'the body should establish a clear left lean before the riff')
    assert.ok(
      rightAccent.at >= 0.62 && rightAccent.at <= 0.78
      && rightAccent.x >= 0.46 && rightAccent.y <= -0.44,
      'the body should answer with one clearly heavier rightward accent',
    )
    assert.ok(Math.abs(motif.tracks.body.at(-1)!.x) <= 0.04, 'the body should recover close to center')
    assert.ok(1 - rightAccent.at >= 0.2, 'the right accent must leave enough time for a slow recovery')
    assert.ok(range(motif.tracks.head.map(key => key.y)) < 0.65, 'the head should follow rather than lead the riff')

    for (const [name, keys] of Object.entries(motif.tracks)) {
      let previous = 0
      for (const key of keys) {
        assert.ok(key.at > previous && key.at <= 1, `${name} keys must be ordered`)
        assert.ok(key.at - previous <= 0.2, `${name} must not leave an unplanned empty beat`)
        previous = key.at
      }
      assert.equal(keys.at(-1)!.at, 1, `${name} must reach the measure boundary`)
    }
  })
})
