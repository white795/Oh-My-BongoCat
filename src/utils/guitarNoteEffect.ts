import type { GuitarNote } from './guitarEffectEngine'

import { GUITAR_EFFECT, GuitarEffectEngine } from './guitarEffectEngine'

export type { GuitarNote, GuitarNoteVariant } from './guitarEffectEngine'

export const GUITAR_NOTE_EFFECT = {
  minIntervalMs: GUITAR_EFFECT.minIntervalMs,
  maxNotes: GUITAR_EFFECT.maxInstances,
  durationMs: GUITAR_EFFECT.durationMs,
  restDelayMs: 1_000,
  activityWindowMs: 3_000,
  sixteenthTiers: [
    { minPresses: 6, every: 4 },
    { minPresses: 12, every: 3 },
    { minPresses: 20, every: 2 },
  ],
} as const

/**
 * Temporary POC adapter. It preserves the already accepted keyboard preview
 * until the state-machine bus is merged; production effect behavior lives in
 * GuitarEffectEngine and must not add new input semantics here.
 */
export class GuitarNoteEffect {
  private readonly engine: GuitarEffectEngine
  private parentGeneration = 1
  private cueSequence = 0
  private recentPresses: number[] = []
  private lastInputAt = Number.NEGATIVE_INFINITY
  private restEmitted = false

  constructor(
    private readonly now: () => number = Date.now,
    random: () => number = Math.random,
  ) {
    this.engine = new GuitarEffectEngine(now, random)
    this.engine.activate(this.parentGeneration)
  }

  public get snapshot(): readonly GuitarNote[] {
    return this.engine.snapshot
  }

  public trigger(): GuitarNote | undefined {
    const now = this.now()

    this.recordInput(now)

    return this.engine.consume({
      kind: 'press',
      sequence: ++this.cueSequence,
      parentGeneration: this.parentGeneration,
      activity: Math.min(this.recentPresses.length / 20, 1),
      burst: 0,
    })
  }

  public triggerRest(): GuitarNote | undefined {
    const now = this.now()

    if (
      this.restEmitted
      || !Number.isFinite(this.lastInputAt)
      || now - this.lastInputAt < GUITAR_NOTE_EFFECT.restDelayMs
    ) {
      return
    }

    this.restEmitted = true
    this.recentPresses = []

    return this.engine.consume({
      kind: 'input-rest',
      sequence: ++this.cueSequence,
      parentGeneration: this.parentGeneration,
    })
  }

  public remove(id: number) {
    this.engine.remove(id)
  }

  public clear() {
    this.engine.deactivate(this.parentGeneration)
    this.engine.activate(++this.parentGeneration)
    this.cueSequence = 0
    this.recentPresses = []
    this.lastInputAt = Number.NEGATIVE_INFINITY
    this.restEmitted = false
  }

  private recordInput(now: number) {
    const windowStart = now - GUITAR_NOTE_EFFECT.activityWindowMs

    this.recentPresses = [...this.recentPresses.filter(timestamp => timestamp >= windowStart), now]
    this.lastInputAt = now
    this.restEmitted = false
  }
}
