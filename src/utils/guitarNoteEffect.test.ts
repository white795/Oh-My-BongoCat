/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { GuitarNote } from './guitarNoteEffect.ts'

import { GUITAR_NOTE_EFFECT, GuitarNoteEffect } from './guitarNoteEffect.ts'

describe('guitar note effect scheduling', () => {
  it('randomizes a broad basic-note pool and two-tone palettes without entering the upper-left quadrant', () => {
    let now = 1_000
    let randomIndex = 0
    const effect = new GuitarNoteEffect(
      () => now,
      () => (randomIndex++ % 10) / 10,
    )
    const notes: Array<GuitarNote | undefined> = []

    for (let index = 0; index < 10; index++) {
      notes.push(effect.trigger())
      now += GUITAR_NOTE_EFFECT.activityWindowMs + 1
    }

    assert.deepEqual(new Set(notes.map(note => note?.variant)), new Set([
      'single',
      'double',
      'accent',
      'whole',
      'half',
      'quarter',
      'chord',
      'triplet',
    ]))
    assert.ok(notes.every(note => note?.durationMs === GUITAR_NOTE_EFFECT.durationMs))
    assert.equal(new Set(notes.map(note => note?.color)).size, 10)
    assert.equal(new Set(notes.map(note => note?.accentColor)).size, 10)
    assert.ok(
      notes.every(note => !((note?.driftX ?? 0) < 0 && (note?.driftY ?? 0) < 0)),
      'exclude upper-left paths that cross the face',
    )
    assert.ok(notes.some(note => (note?.driftX ?? 0) > 0 && (note?.driftY ?? 0) < 0), 'include upper-right')
    assert.ok(notes.some(note => (note?.driftX ?? 0) > 0 && (note?.driftY ?? 0) > 0), 'include lower-right')
    assert.ok(notes.some(note => (note?.driftX ?? 0) < 0 && (note?.driftY ?? 0) > 0), 'include lower-left')
    assert.ok(notes.slice(1).every((note, index) => note?.variant !== notes[index]?.variant))
    assert.ok(notes.slice(1).every((note, index) => note?.color !== notes[index]?.color))
    assert.deepEqual(effect.snapshot, effect.snapshot, 'generated notes stay stable between animation frames')
  })

  it('increases sixteenth-note density as keyboard activity grows within three seconds', () => {
    let now = 2_000
    const effect = new GuitarNoteEffect(() => now, () => 0)
    const variants = []

    for (let index = 0; index < 24; index++) {
      variants.push(effect.trigger()?.variant)
      now += 100
    }

    assert.equal(variants.slice(0, 5).includes('sixteenth'), false)
    assert.equal(variants.slice(5, 11).filter(variant => variant === 'sixteenth').length, 1)
    assert.equal(variants.slice(11, 19).filter(variant => variant === 'sixteenth').length, 3)
    assert.equal(variants.slice(19).filter(variant => variant === 'sixteenth').length, 3)

    now += GUITAR_NOTE_EFFECT.activityWindowMs
    assert.notEqual(effect.trigger()?.variant, 'sixteenth', 'activity should decay outside the rolling window')
  })

  it('alternates rest glyphs across silent phrases and restarts from normal intensity', () => {
    let now = 4_000
    const effect = new GuitarNoteEffect(() => now, () => 0)

    effect.trigger()
    now += GUITAR_NOTE_EFFECT.restDelayMs - 1
    assert.equal(effect.triggerRest(), undefined)

    now += 1
    assert.equal(effect.triggerRest()?.variant, 'rest')
    assert.equal(effect.triggerRest(), undefined, 'silence should emit only one rest')

    now += 1
    assert.equal(effect.trigger()?.variant, 'single')

    now += GUITAR_NOTE_EFFECT.restDelayMs
    assert.equal(effect.triggerRest()?.variant, 'eighthRest')
  })

  it('throttles key repeat bursts and keeps at most six live notes', () => {
    let now = 6_000
    const effect = new GuitarNoteEffect(() => now)

    const first = effect.trigger()
    now += GUITAR_NOTE_EFFECT.minIntervalMs - 1
    assert.equal(effect.trigger(), undefined)
    assert.deepEqual(effect.snapshot.map(note => note.id), [first?.id])

    for (let index = 0; index < GUITAR_NOTE_EFFECT.maxNotes; index++) {
      now += GUITAR_NOTE_EFFECT.minIntervalMs
      effect.trigger()
    }

    assert.equal(effect.snapshot.length, GUITAR_NOTE_EFFECT.maxNotes)
    assert.ok(effect.snapshot.every(note => note.id !== first?.id), 'evict the oldest note at capacity')
  })

  it('removes expired notes and resets throttling when the guitar state exits', () => {
    let now = 8_000
    const effect = new GuitarNoteEffect(() => now)
    const first = effect.trigger()!

    effect.remove(first.id)
    assert.deepEqual(effect.snapshot, [])

    now += 1
    effect.trigger()
    effect.clear()
    assert.deepEqual(effect.snapshot, [])
    const restarted = effect.trigger()
    assert.ok(restarted, 'a new guitar session should not inherit the previous throttle window')
    assert.equal(['sixteenth', 'rest', 'eighthRest'].includes(restarted.variant), false)
  })
})
