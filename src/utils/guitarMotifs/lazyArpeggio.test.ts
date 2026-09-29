/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { LAZY_ARPEGGIO_MOTIF, LAZY_ARPEGGIO_MOTIF_ID } from './lazyArpeggio.ts'

describe('lazy-arpeggio motif', () => {
  it('plays four gentle notes over one slow body arc while holding the chord', () => {
    const motif = LAZY_ARPEGGIO_MOTIF

    assert.equal(motif.id, LAZY_ARPEGGIO_MOTIF_ID)
    assert.equal(motif.label, 'LAZY ARPEGGIO')
    assert.equal(motif.homeProfile, 'autonomous')
    assert.equal(motif.minimumProfile, 'autonomous')
    assert.equal(motif.durationBeats, 4)
    assert.deepEqual(motif.steps, [
      ['pick', 0.5, 0.34],
      ['rest', 0.5, 1],
      ['pick', 0.5, 0.42],
      ['rest', 0.5, 1],
      ['pick', 0.5, 0.38],
      ['rest', 0.5, 1],
      ['pick', 0.5, 0.46],
      ['rest', 0.5, 1],
    ])
    assert.equal(motif.steps.reduce((beats, [, count]) => beats + count, 0), motif.durationBeats)
    assert.equal(motif.steps.filter(([clip]) => clip === 'pick').length, 4, 'the arpeggio should contain four individual notes')
    assert.equal(motif.steps.filter(([clip]) => clip === 'rest').length, 4, 'each note should have room to ring')
    assert.ok(motif.steps.every(([clip]) => clip === 'pick' || clip === 'rest'), 'the arpeggio must not introduce a sweep or accent')

    const body = motif.tracks.body
    const bodyMaximumIndex = body.reduce(
      (candidate, key, index) => key.x > body[candidate].x ? index : candidate,
      0,
    )
    assert.ok(bodyMaximumIndex > 0 && bodyMaximumIndex < body.length - 1, 'the slow arc needs one interior turning point')
    for (let index = 1; index <= bodyMaximumIndex; index += 1) {
      assert.ok(body[index].x >= body[index - 1].x, 'the first half should sink continuously into one lazy side')
    }
    for (let index = bodyMaximumIndex + 1; index < body.length; index += 1) {
      assert.ok(body[index].x <= body[index - 1].x, 'the second half should continuously release from the arc')
    }
    assert.ok(body[bodyMaximumIndex].x >= 0.32, 'the single-sided lazy lean should remain visible at autonomous intensity')
    assert.ok(Math.min(...body.map(key => key.x)) >= -0.02, 'the body should not cross into a generic left-right sway')
    assert.ok(Math.max(...body.map(key => Math.abs(key.y))) <= 0.2, 'the lazy arc should not hide a body accent')

    const fretting = motif.tracks.frettingHand
    const frettingXs = fretting.map(key => key.x)
    const frettingYs = fretting.map(key => key.y)
    assert.ok(Math.max(...frettingXs) - Math.min(...frettingXs) <= 0.02, 'the fretting hand should keep exactly one chord position')
    assert.ok(Math.max(...frettingYs) - Math.min(...frettingYs) >= 0.04, 'the held chord should still show pressure changes')
    assert.ok(Math.max(...frettingYs) - Math.min(...frettingYs) <= 0.08, 'pressure changes should stay subtle')

    const head = motif.tracks.head
    const headTravelX = Math.max(...head.map(key => key.x)) - Math.min(...head.map(key => key.x))
    assert.ok(headTravelX <= 0.18, 'the head should look down instead of repeating the tuning side lean')
    const sustainedFocus = head.filter(key => key.at >= 0.42 && key.at <= 0.72 && key.y <= -0.4)
    assert.ok(sustainedFocus.length >= 3, 'the cat should keep watching the strings through the middle notes')
    assert.ok(sustainedFocus.at(-1)!.at - sustainedFocus[0].at >= 0.2, 'the downward focus should be a held look, not a nod')
    assert.ok(Math.min(...head.map(key => key.y)) <= -0.5, 'the downward focus should remain readable')
    const verticalSpeeds = head.slice(1).map((key, index) => Math.abs(key.y - head[index].y) / (key.at - head[index].at))
    assert.ok(Math.max(...verticalSpeeds) <= 1.8, 'the lazy look should not contain a nod-like speed spike')

    assert.ok(Math.max(...motif.tracks.leftEar.map(key => key.y)) <= 0.22, 'ears should stay secondary after tuning-listen')
    assert.ok(Math.max(...motif.tracks.rightEar.map(key => key.y)) <= 0.22, 'ears should stay secondary after tuning-listen')

    for (const [name, keys] of Object.entries(motif.tracks)) {
      let previous = 0
      for (const key of keys) {
        assert.ok(key.at > previous && key.at <= 1, `${name} keys must be ordered`)
        assert.ok(key.at - previous <= 0.22, `${name} must keep the lazy phrase alive`)
        previous = key.at
      }

      const entry = keys[0]
      const exit = keys.at(-1)!
      assert.equal(exit.at, 1, `${name} must reach the measure boundary`)
      assert.ok(Math.abs(exit.x - entry.x) <= 0.03, `${name} must return near its entry x`)
      assert.ok(Math.abs(exit.y - entry.y) <= 0.03, `${name} must return near its entry y`)
    }
  })
})
