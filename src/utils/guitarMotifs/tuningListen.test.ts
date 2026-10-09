/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { mapGuitarFrettingPose } from '../guitarPerformance.ts'
import { TUNING_LISTEN_MOTIF, TUNING_LISTEN_MOTIF_ID } from './tuningListen.ts'

describe('tuning-listen motif', () => {
  it('listens between two light picks, adjusts the chord and releases into A', () => {
    const motif = TUNING_LISTEN_MOTIF

    assert.equal(motif.id, TUNING_LISTEN_MOTIF_ID)
    assert.equal(motif.label, 'TUNING LISTEN')
    assert.equal(motif.homeProfile, 'autonomous')
    assert.equal(motif.minimumProfile, 'autonomous')
    assert.equal(motif.durationBeats, 4)
    assert.deepEqual(motif.steps, [
      ['pick', 0.75, 0.38],
      ['rest', 1.25, 1],
      ['pick', 0.75, 0.52],
      ['settle', 1.25, 1],
    ])
    assert.equal(motif.steps.reduce((beats, [, count]) => beats + count, 0), motif.durationBeats)
    assert.equal(motif.steps.filter(([clip]) => clip === 'pick').length, 2, 'tuning should contain exactly two reference notes')

    const listeningHead = motif.tracks.head.filter(key => key.at >= 0.3 && key.at <= 0.64)
    const neckLean = listeningHead.reduce((candidate, key) => key.x < candidate.x ? key : candidate)
    assert.ok(neckLean.x <= -0.58 && neckLean.y <= -0.18, 'the head should form a clear listening silhouette near the neck')
    assert.ok(listeningHead.length >= 4, 'listening should remain readable through the silent beat and confirmation note')
    assert.ok(listeningHead.at(-1)!.at - listeningHead[0].at >= 0.3, 'the listening pose should be held instead of becoming another nod')
    assert.ok(
      listeningHead.some((key, index) => index > 0
        && Math.hypot(key.x - listeningHead[index - 1].x, key.y - listeningHead[index - 1].y) > 0.01),
      'the listening pose must not freeze completely',
    )

    const bodyXs = motif.tracks.body.map(key => key.x)
    const bodyYs = motif.tracks.body.map(key => key.y)
    assert.ok(Math.max(...bodyXs) - Math.min(...bodyXs) <= 0.16, 'the torso should become quiet so the listening silhouette leads')
    assert.ok(Math.max(...bodyYs.map(Math.abs)) <= 0.12, 'tuning should not hide another body accent')

    const leftEarPeak = motif.tracks.leftEar.reduce((peak, key) => key.y > peak.y ? key : peak)
    const rightEarPeak = motif.tracks.rightEar.reduce((peak, key) => key.y > peak.y ? key : peak)
    assert.ok(leftEarPeak.at >= 0.3 && leftEarPeak.at <= 0.58)
    assert.ok(leftEarPeak.y >= 0.75, 'one ear should visibly rise while listening')
    assert.ok(leftEarPeak.y - rightEarPeak.y >= 0.5, 'the listening ear should form an asymmetric silhouette')

    assert.equal(motif.frettingAngleDegrees, -40, 'the tuning adjustment should follow the corrected neck axis')
    const mappedAxis = mapGuitarFrettingPose({ x: 1, y: 0 }, motif.frettingAngleDegrees)
    assert.ok(mappedAxis.x > 0 && mappedAxis.y < 0, 'the tuning hand should move along the visible neck')
    const openingChord = motif.tracks.frettingHand.filter(key => key.at >= 0.03 && key.at <= 0.18)
    assert.equal(openingChord.length, 2, 'the first reference note should start from one held position')
    assert.deepEqual(
      { x: openingChord[1].x, y: openingChord[1].y },
      { x: openingChord[0].x, y: openingChord[0].y },
      'the opening position should be held rather than swept through',
    )
    assert.ok(openingChord[0].y <= -0.14, 'the first reference note should visibly press the string')
    const adjustment = motif.tracks.frettingHand.filter(key => key.at >= 0.22 && key.at <= 0.4)
    assert.ok(adjustment.some(key => key.y >= 0.1), 'the hand should visibly release before adjusting')
    const confirmationChord = motif.tracks.frettingHand.filter(key => key.at >= 0.42 && key.at <= 0.6)
    assert.equal(confirmationChord.length, 2, 'the adjusted position should land and hold through the confirmation note')
    assert.deepEqual(
      { x: confirmationChord[1].x, y: confirmationChord[1].y },
      { x: confirmationChord[0].x, y: confirmationChord[0].y },
      'the confirmation note should use one stable tuned position',
    )
    assert.ok(confirmationChord[0].x >= 0.08 && confirmationChord[0].y <= -0.2, 'the adjusted string position should be visually distinct')
    const allFrettingXs = motif.tracks.frettingHand.map(key => key.x)
    const frettingTravel = Math.max(...allFrettingXs) - Math.min(...allFrettingXs)
    assert.ok(frettingTravel >= 0.3, 'the adjustment should remain visible')
    assert.ok(frettingTravel <= 0.42, 'tuning should remain smaller than a chord walk or neck run')

    for (const [name, keys] of Object.entries(motif.tracks)) {
      let previous = 0
      for (const key of keys) {
        assert.ok(key.at > previous && key.at <= 1, `${name} keys must be ordered`)
        if (name === 'head' || name === 'leftEar' || name === 'rightEar') {
          assert.ok(key.at - previous <= 0.2, `${name} must retain secondary motion while listening`)
        }
        previous = key.at
      }

      const entry = keys[0]
      const exit = keys.at(-1)!
      assert.equal(exit.at, 1, `${name} must reach the measure boundary`)
      assert.ok(Math.abs(exit.x - entry.x) <= 0.04, `${name} must return near its entry x`)
      assert.ok(Math.abs(exit.y - entry.y) <= 0.04, `${name} must return near its entry y`)
    }
  })
})
