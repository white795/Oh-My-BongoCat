/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { GuitarEffectCue, GuitarNote } from './guitarEffectEngine.ts'

import { GUITAR_EFFECT, GuitarEffectEngine } from './guitarEffectEngine.ts'

function press(
  sequence: number,
  parentGeneration: number,
  activity: number,
): GuitarEffectCue {
  return {
    kind: 'press',
    sequence,
    parentGeneration,
    activity,
    burst: 0,
  }
}

describe('guitar effect engine', () => {
  it('preserves the visual note pool without retaining input timing semantics', () => {
    let now = 1_000
    let randomIndex = 0
    const engine = new GuitarEffectEngine(
      () => now,
      () => (randomIndex++ % 10) / 10,
    )
    const notes: GuitarNote[] = []

    engine.activate(4)

    for (let sequence = 1; sequence <= 10; sequence++) {
      const note = engine.consume(press(sequence, 4, 0.05))

      assert.ok(note)
      notes.push(note)
      now += GUITAR_EFFECT.minIntervalMs
    }

    assert.deepEqual(new Set(notes.map(note => note.variant)), new Set([
      'single',
      'double',
      'accent',
      'whole',
      'half',
      'quarter',
      'chord',
      'triplet',
      'sharp',
      'flat',
    ]))
    assert.equal(new Set(notes.map(note => note.color)).size, 10)
    assert.equal(new Set(notes.map(note => note.accentColor)).size, 10)
    assert.ok(notes.every(note => note.durationMs === GUITAR_EFFECT.durationMs))
    assert.ok(
      notes.every(note => !(note.driftX < 0 && note.driftY < 0)),
      'upper-left paths stay excluded because they cross the face',
    )
  })

  it('uses supplied activity for sixteenth-note density instead of rebuilding an input window', () => {
    let now = 2_000
    const engine = new GuitarEffectEngine(() => now, () => 0)
    const variants = []

    engine.activate(5)

    for (let sequence = 1; sequence <= 24; sequence++) {
      variants.push(engine.consume(press(sequence, 5, Math.min(sequence / 20, 1)))?.variant)
      now += 100
    }

    assert.equal(variants.slice(0, 5).includes('sixteenth'), false)
    assert.equal(variants.slice(5, 11).filter(variant => variant === 'sixteenth').length, 1)
    assert.equal(variants.slice(11, 19).filter(variant => variant === 'sixteenth').length, 3)
    assert.equal(variants.slice(19).filter(variant => variant === 'sixteenth').length, 3)

    now += 30_000
    assert.notEqual(
      engine.consume(press(25, 5, 0.05))?.variant,
      'sixteenth',
      'the state-machine activity carried by the cue is the only density input',
    )
  })

  it('plays rest and accent cues immediately and ignores a duplicate sequence', () => {
    const now = 3_000
    const engine = new GuitarEffectEngine(() => now, () => 0)

    engine.activate(6)

    const rest: GuitarEffectCue = {
      kind: 'input-rest',
      sequence: 1,
      parentGeneration: 6,
    }
    const accent: GuitarEffectCue = {
      kind: 'accent',
      sequence: 2,
      parentGeneration: 6,
      strength: 0.9,
    }

    assert.equal(engine.consume(rest)?.variant, 'rest')
    assert.equal(engine.consume(rest), undefined)
    assert.equal(engine.consume(accent)?.variant, 'accent')
    assert.deepEqual(engine.snapshot.map(note => note.variant), ['rest', 'accent'])
  })

  it('rejects stale generations and clears old instances when a new generation activates', () => {
    const now = 4_000
    const engine = new GuitarEffectEngine(() => now, () => 0)

    engine.activate(10)
    assert.equal(engine.consume(press(1, 9, 0.05)), undefined)
    assert.ok(engine.consume(press(1, 10, 0.05)))

    engine.activate(11)
    assert.deepEqual(engine.snapshot, [])
    assert.equal(engine.consume(press(2, 10, 0.05)), undefined)
    assert.ok(engine.consume(press(2, 11, 0.05)))
  })

  it('keeps visual throttling, capacity, removal and lifecycle cleanup inside the engine', () => {
    let now = 5_000
    const engine = new GuitarEffectEngine(() => now, () => 0)

    engine.activate(12)
    const first = engine.consume(press(1, 12, 0.05))!

    now += GUITAR_EFFECT.minIntervalMs - 1
    assert.equal(engine.consume(press(2, 12, 0.1)), undefined)

    for (let sequence = 3; sequence <= GUITAR_EFFECT.maxInstances + 3; sequence++) {
      now += GUITAR_EFFECT.minIntervalMs
      engine.consume(press(sequence, 12, 0.05))
    }

    assert.equal(engine.snapshot.length, GUITAR_EFFECT.maxInstances)
    assert.ok(engine.snapshot.every(note => note.id !== first.id))

    const remaining = engine.snapshot[0]

    engine.remove(remaining.id)
    assert.ok(engine.snapshot.every(note => note.id !== remaining.id))

    engine.deactivate(13)
    assert.deepEqual(engine.snapshot, [])
    assert.equal(engine.consume(press(99, 12, 1)), undefined)
  })

  it('owns effect TTL independently from any page timer', () => {
    let now = 6_000
    const engine = new GuitarEffectEngine(() => now, () => 0)

    engine.activate(14)
    const note = engine.consume(press(1, 14, 0.05))!

    assert.equal(engine.nextDeadlineAt, now + note.durationMs)

    now += note.durationMs - 1
    engine.advance()
    assert.deepEqual(engine.snapshot.map(item => item.id), [note.id])

    now += 1
    engine.advance()
    assert.deepEqual(engine.snapshot, [])
    assert.equal(engine.nextDeadlineAt, undefined)
  })
})
