export type AngryWaitingLifecycle = 'inactive' | 'active'
export type AngryWaitingIntensity = 'annoyed' | 'impatient' | 'furious'
export type AngryWaitingEscalation = Exclude<AngryWaitingIntensity, 'annoyed'>

export const ANGRY_WAITING = {
  impatientAfterMs: 8_000,
  furiousAfterMs: 25_000,
} as const

export type AngryWaitingSnapshot
  = | {
    readonly lifecycle: 'inactive'
    readonly parentGeneration: number | null
    readonly revision: number
  }
  | {
    readonly lifecycle: 'active'
    readonly parentGeneration: number
    readonly revision: number
    readonly intensity: AngryWaitingIntensity
  }

export interface AngryWaitingCue {
  readonly kind: 'anger-escalated'
  readonly intensity: AngryWaitingEscalation
  readonly sequence: number
  readonly parentGeneration: number
}

export interface AngryWaitingUpdate {
  readonly snapshot: AngryWaitingSnapshot
  readonly cues: readonly AngryWaitingCue[]
  readonly nextDeadlineAt: number | undefined
}

/**
 * Converts one continuous parent ANGRY interval and monotonic time into
 * presentation intent. It does not create timers, animations, or effects.
 */
export class AngryWaitingMachine {
  private current: AngryWaitingSnapshot = {
    lifecycle: 'inactive',
    parentGeneration: null,
    revision: 0,
  }

  private activeSince: number | undefined
  private cueSequence = 0
  private lastNow = Number.NEGATIVE_INFINITY

  constructor(private readonly now: () => number = () => performance.now()) { }

  public get snapshot(): AngryWaitingSnapshot {
    return { ...this.current }
  }

  public activate(parentGeneration: number): AngryWaitingUpdate {
    if (parentGeneration <= this.currentGeneration) return this.result()

    this.activeSince = this.readNow()
    this.current = {
      lifecycle: 'active',
      parentGeneration,
      revision: this.current.revision + 1,
      intensity: 'annoyed',
    }

    return this.result()
  }

  public deactivate(parentGeneration: number): AngryWaitingUpdate {
    if (parentGeneration < this.currentGeneration) return this.result()
    if (
      parentGeneration === this.current.parentGeneration
      && this.current.lifecycle === 'inactive'
    ) {
      return this.result()
    }

    this.activeSince = undefined
    this.current = {
      lifecycle: 'inactive',
      parentGeneration,
      revision: this.current.revision + 1,
    }

    return this.result()
  }

  public advance(parentGeneration: number): AngryWaitingUpdate {
    if (
      this.current.lifecycle !== 'active'
      || parentGeneration !== this.current.parentGeneration
      || this.activeSince === undefined
    ) {
      return this.result()
    }

    const intensity = intensityAt(this.readNow() - this.activeSince)
    if (intensity === this.current.intensity) return this.result()
    if (intensity === 'annoyed') return this.result()

    this.current = {
      ...this.current,
      revision: this.current.revision + 1,
      intensity,
    }

    return this.result([{
      kind: 'anger-escalated',
      intensity,
      sequence: ++this.cueSequence,
      parentGeneration,
    }])
  }

  private get currentGeneration(): number {
    return this.current.parentGeneration ?? Number.NEGATIVE_INFINITY
  }

  private readNow(): number {
    const candidate = this.now()

    if (Number.isFinite(candidate)) this.lastNow = Math.max(this.lastNow, candidate)
    if (!Number.isFinite(this.lastNow)) this.lastNow = 0

    return this.lastNow
  }

  private result(cues: readonly AngryWaitingCue[] = []): AngryWaitingUpdate {
    return {
      snapshot: this.snapshot,
      cues: cues.map(cue => ({ ...cue })),
      nextDeadlineAt: this.nextDeadlineAt,
    }
  }

  private get nextDeadlineAt(): number | undefined {
    if (this.current.lifecycle !== 'active' || this.activeSince === undefined) return

    if (this.current.intensity === 'annoyed') {
      return this.activeSince + ANGRY_WAITING.impatientAfterMs
    }
    if (this.current.intensity === 'impatient') {
      return this.activeSince + ANGRY_WAITING.furiousAfterMs
    }
  }
}

function intensityAt(elapsedMs: number): AngryWaitingIntensity {
  if (elapsedMs >= ANGRY_WAITING.furiousAfterMs) return 'furious'
  if (elapsedMs >= ANGRY_WAITING.impatientAfterMs) return 'impatient'

  return 'annoyed'
}
