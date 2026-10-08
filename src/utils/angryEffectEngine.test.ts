/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type {
  AngryEffectCue,
  AngryEffectStateSnapshot,
} from './angryEffectEngine.ts'

import { ANGRY_EFFECT, AngryEffectEngine } from './angryEffectEngine.ts'

function active(
  parentGeneration: number,
  revision: number,
  intensity: 'annoyed' | 'impatient' | 'furious',
): AngryEffectStateSnapshot {
  return {
    lifecycle: 'active',
    parentGeneration,
    revision,
    intensity,
  }
}

function escalation(
  sequence: number,
  parentGeneration: number,
  intensity: 'impatient' | 'furious',
): AngryEffectCue {
  return {
    kind: 'anger-escalated',
    sequence,
    parentGeneration,
    intensity,
  }
}

describe('angry effect engine', () => {
  it('activates from a durable snapshot without rebuilding waiting deadlines', () => {
    const now = 1_000
    const engine = new AngryEffectEngine(() => now)

    assert.equal(engine.applySnapshot(active(4, 1, 'annoyed')), true)
    assert.equal(engine.intensity, 'annoyed')
    assert.deepEqual(engine.snapshot.map(effect => effect.variant), ['stress-arc'])
    assert.equal(
      engine.nextSustainAt,
      now + ANGRY_EFFECT.sustainIntervalsMs.annoyed[0],
    )

    const ids = engine.snapshot.map(effect => effect.id)

    assert.equal(engine.applySnapshot(active(4, 1, 'annoyed')), false)
    assert.deepEqual(engine.snapshot.map(effect => effect.id), ids)
  })

  it('uses snapshots for sustained strength and cues for one-shot escalation only', () => {
    const now = 2_000
    const engine = new AngryEffectEngine(() => now)

    engine.applySnapshot(active(5, 1, 'annoyed'))
    const beforeUpgrade = engine.snapshot.map(effect => effect.id)

    assert.equal(engine.applySnapshot(active(5, 2, 'impatient')), true)
    assert.equal(engine.intensity, 'impatient')
    assert.deepEqual(
      engine.snapshot.map(effect => effect.id),
      beforeUpgrade,
      'a durable update must not synthesize the transient escalation burst',
    )

    const burst = engine.consume(escalation(1, 5, 'impatient'))

    assert.deepEqual(burst.map(effect => effect.variant), [
      'stress-arc',
      'anger-knot',
      'steam-puff',
      'steam-puff',
      'cross-pop',
      'cross-pop',
    ])
    assert.equal(burst.filter(effect => effect.variant === 'cross-pop').length, 2)
    assert.deepEqual(
      new Set(burst.map(effect => effect.anchorRegion)),
      new Set(['crown', 'ear', 'face-side']),
      'an escalation should use the crown, ear and face-side staging areas instead of clustering around both ears',
    )
    assert.equal(
      burst.find(effect => effect.variant === 'anger-knot')?.anchorRegion,
      'crown',
      'the four-arc anger mark should be readable above the head',
    )
    assert.deepEqual(engine.consume(escalation(1, 5, 'impatient')), [])
  })

  it('plays only the final cue after a late wake-up crosses multiple thresholds', () => {
    const now = 30_000
    const engine = new AngryEffectEngine(() => now)

    engine.applySnapshot(active(6, 1, 'annoyed'))
    engine.applySnapshot(active(6, 2, 'furious'))

    const burst = engine.consume(escalation(1, 6, 'furious'))

    assert.ok(burst.length > 0)
    assert.ok(burst.every(effect => effect.intensity === 'furious'))
    assert.ok(burst.some(effect => effect.variant === 'heat-spark'))
    assert.equal(
      engine.snapshot.some(effect => effect.intensity === 'impatient'),
      false,
    )
  })

  it('rejects stale generations and clears all visuals on deactivation', () => {
    let now = 4_000
    const engine = new AngryEffectEngine(() => now)

    engine.applySnapshot(active(10, 1, 'annoyed'))
    const firstGenerationId = engine.snapshot[0].id

    assert.ok(engine.snapshot.length > 0)

    now += 1
    assert.equal(engine.deactivate(11), true)
    assert.equal(engine.snapshot.length, 0)
    assert.equal(engine.nextDeadlineAt, undefined)
    assert.deepEqual(engine.consume(escalation(1, 10, 'furious')), [])
    assert.equal(engine.applySnapshot(active(10, 2, 'furious')), false)

    assert.equal(engine.applySnapshot(active(12, 1, 'furious')), true)
    assert.equal(engine.intensity, 'furious')
    assert.notEqual(
      engine.snapshot[0].id,
      firstGenerationId,
      'DOM keys remain monotonic so a new generation remounts its CSS animation',
    )
  })

  it('emits at most one sustained beat after a delayed advance', () => {
    let now = 5_000
    const engine = new AngryEffectEngine(() => now)

    engine.applySnapshot(active(13, 1, 'furious'))
    const existingIds = new Set(engine.snapshot.map(effect => effect.id))

    now += 60_000
    const emitted = engine.advance()

    assert.ok(emitted.length > 0)
    assert.ok(emitted.length <= ANGRY_EFFECT.maxSustainBurst)
    assert.ok(emitted.every(effect => !existingIds.has(effect.id)))
    assert.equal(
      engine.nextSustainAt,
      now + ANGRY_EFFECT.sustainIntervalsMs.furious[1],
      'missed cadence is rescheduled from now instead of replayed in a loop',
    )
  })

  it('rotates curated sustain phrases instead of repeating mirrored stamps on a fixed beat', () => {
    let now = 8_000
    const engine = new AngryEffectEngine(() => now)

    engine.applySnapshot(active(15, 1, 'impatient'))

    const firstDeadline = engine.nextSustainAt!
    const firstInterval = firstDeadline - now

    now = firstDeadline
    const firstPhrase = engine.advance()
    const secondDeadline = engine.nextSustainAt!
    const secondInterval = secondDeadline - now

    now = secondDeadline
    const secondPhrase = engine.advance()

    const normalizedMotion = (effects: typeof firstPhrase) => effects.map(effect => ({
      variant: effect.variant,
      anchorY: effect.anchorY,
      driftX: Math.abs(effect.driftX),
      driftY: effect.driftY,
      scale: effect.scale,
      delayMs: effect.delayMs,
    }))

    assert.notEqual(firstInterval, secondInterval)
    assert.notDeepEqual(normalizedMotion(firstPhrase), normalizedMotion(secondPhrase))
  })

  it('owns TTL, capacity and deadline cleanup independently from the page', () => {
    let now = 6_000
    const engine = new AngryEffectEngine(() => now)

    engine.applySnapshot(active(14, 1, 'furious'))

    for (let sequence = 1; sequence <= 4; sequence++) {
      engine.consume(escalation(sequence, 14, 'furious'))
    }

    assert.equal(engine.snapshot.length, ANGRY_EFFECT.maxInstances)
    assert.ok(engine.nextDeadlineAt !== undefined)

    now += ANGRY_EFFECT.maxLifetimeMs + 1
    engine.advance()

    assert.ok(
      engine.snapshot.length <= ANGRY_EFFECT.maxSustainBurst,
      'expired visuals are removed before an overdue sustained beat is emitted',
    )

    engine.deactivate(15)
    assert.deepEqual(engine.snapshot, [])
    assert.equal(engine.nextDeadlineAt, undefined)
  })
})
