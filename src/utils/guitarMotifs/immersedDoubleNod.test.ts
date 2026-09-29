/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { GUITAR_MOTIF_PREVIEW } from '../guitarMotifs.ts'
import { IMMERSED_DOUBLE_NOD_MOTIF, IMMERSED_DOUBLE_NOD_MOTIF_ID } from './immersedDoubleNod.ts'

describe('immersed-double-nod motif', () => {
  it('authors a coordinated light-light-heavy-light four-beat gesture', () => {
    const motif = IMMERSED_DOUBLE_NOD_MOTIF

    assert.equal(motif.id, IMMERSED_DOUBLE_NOD_MOTIF_ID)
    assert.equal(motif.label, 'IMMERSED DOUBLE NOD')
    assert.equal(motif.homeProfile, 'drive')
    assert.equal(motif.minimumProfile, 'drive')
    assert.equal(motif.durationBeats, 4)
    assert.equal(GUITAR_MOTIF_PREVIEW.leadInBeats, 0)
    assert.equal(GUITAR_MOTIF_PREVIEW.loopBeats, motif.durationBeats)
    assert.deepEqual(motif.steps, [
      ['down', 1, 0.72],
      ['up', 1, 0.68],
      ['accent', 1, 1],
      ['up', 1, 0.72],
    ])
    assert.equal(motif.steps.reduce((beats, [, count]) => beats + count, 0), motif.durationBeats)
    assert.deepEqual(Object.keys(motif.tracks), ['head', 'body', 'leftEar', 'rightEar', 'frettingHand'])

    for (const [name, keys] of Object.entries(motif.tracks)) {
      let previous = 0
      for (const key of keys) {
        assert.ok(key.at > previous && key.at <= 1, `${name} keys must be ordered`)
        assert.ok(key.at - previous <= 0.22, `${name} must keep moving instead of leaving an empty beat`)
        if (name !== 'frettingHand') {
          assert.ok(Math.abs(key.x) <= 0.03, `${name} must not turn the vertical nod into a side sway`)
        }
        previous = key.at
      }
      const exit = keys.at(-1)!
      assert.equal(exit.at, 1, `${name} must end at the measure boundary`)
      if (name !== 'frettingHand') {
        assert.deepEqual({ x: exit.x, y: exit.y }, { x: 0, y: 0 }, `${name} must return to a neutral exit`)
      }
    }

    const headPresses = motif.tracks.head.filter(key => key.y <= -0.45)
    assert.equal(headPresses.length, 4)
    const beatWindows = [[0.08, 0.18], [0.33, 0.43], [0.58, 0.68], [0.83, 0.93]]
    headPresses.forEach((key, index) => {
      const [start, end] = beatWindows[index]
      assert.ok(key.at >= start && key.at <= end, `nod ${index + 1} must land inside its beat window`)
    })
    const weights = headPresses.map(key => Math.abs(key.y))
    assert.ok(weights[2] >= 0.9, 'the third beat should keep the accepted heavy nod')
    for (const index of [0, 1, 3]) {
      assert.ok(weights[index] >= 0.7, `light beat ${index + 1} should remain substantial`)
      assert.ok(weights[index] < weights[2], `light beat ${index + 1} must remain below the heavy beat`)
      assert.ok(weights[2] - weights[index] <= 0.2, `light beat ${index + 1} should be only slightly lighter`)
    }

    const bodyPresses = motif.tracks.body.filter(key => key.y <= -0.15)
    assert.equal(bodyPresses.length, 4)
    bodyPresses.forEach((key, index) => {
      assert.ok(key.at > headPresses[index].at, `the body should follow nod ${index + 1}`)
      assert.ok(key.at - headPresses[index].at <= 0.025, `the body should lean with nod ${index + 1}`)
    })
    const bodyWeights = bodyPresses.map(key => Math.abs(key.y))
    assert.ok(bodyWeights[2] > Math.max(bodyWeights[0], bodyWeights[1], bodyWeights[3]))

    const leftEarPeak = motif.tracks.leftEar.reduce((peak, key) => Math.abs(key.y) > Math.abs(peak.y) ? key : peak)
    const rightEarPeak = motif.tracks.rightEar.reduce((peak, key) => Math.abs(key.y) > Math.abs(peak.y) ? key : peak)
    assert.ok(leftEarPeak.at > headPresses[2].at && leftEarPeak.at < headPresses[3].at)
    assert.ok(rightEarPeak.at > headPresses[2].at && rightEarPeak.at < headPresses[3].at)

    const frettingPreparation = motif.tracks.frettingHand.reduce((peak, key) => key.x > peak.x ? key : peak)
    const frettingPress = motif.tracks.frettingHand.reduce((peak, key) => key.y < peak.y ? key : peak)
    assert.ok(frettingPreparation.at < headPresses[2].at, 'the large chord change should prepare the heavy beat')
    assert.ok(frettingPress.at < headPresses[2].at, 'the fretting hand should press before the heavy stroke lands')
    assert.ok(frettingPreparation.x >= 0.35)
    assert.ok(frettingPress.y <= -0.2)
    assert.ok(Math.abs(motif.tracks.frettingHand.at(-1)!.x - motif.tracks.frettingHand[0].x) <= 0.03)
    assert.ok(Math.abs(motif.tracks.frettingHand.at(-1)!.y - motif.tracks.frettingHand[0].y) <= 0.03)
    const exitVelocity = (keys: readonly { at: number, vy?: number }[]) => keys.at(-1)?.vy ?? 0
    assert.ok(exitVelocity(motif.tracks.head) > 0, 'the head should keep rebounding into the next measure')
    assert.ok(exitVelocity(motif.tracks.body) > 0, 'the body should keep releasing into the next measure')
    assert.ok(exitVelocity(motif.tracks.leftEar) < 0, 'the left ear should keep settling into the next measure')
    assert.ok(exitVelocity(motif.tracks.rightEar) < 0, 'the right ear should keep settling into the next measure')
  })
})
