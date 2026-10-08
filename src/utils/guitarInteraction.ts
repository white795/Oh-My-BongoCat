export type GuitarInteractionLifecycle = 'inactive' | 'active'
export type GuitarInteractionLevel = 'autonomous' | 'engaged' | 'groove' | 'drive'

export const GUITAR_INTERACTION = {
  sustainedWindowMs: 3_000,
  burstWindowMs: 600,
  releaseDelayMs: 400,
  restDelayMs: 1_000,
  grooveEnterPresses: 6,
  grooveExitPresses: 5,
  driveEnterPresses: 12,
  driveExitPresses: 9,
  burstDrivePresses: 5,
  burstDriveExitPresses: 3,
  maxActivityPresses: 20,
  accentCooldownMs: 1_200,
} as const

export interface GuitarInteractionSnapshot {
  readonly lifecycle: GuitarInteractionLifecycle
  readonly parentGeneration: number | null
  readonly revision: number
  readonly interaction: GuitarInteractionLevel
  readonly activity: number
  readonly burst: number
  readonly releasing: boolean
  readonly lastInputAt: number | undefined
}

interface GuitarInteractionCueBase {
  readonly sequence: number
  readonly parentGeneration: number
}

export type GuitarInteractionCue
  = | GuitarInteractionCueBase & {
    readonly kind: 'press'
    readonly activity: number
    readonly burst: number
  }
  | GuitarInteractionCueBase & {
    readonly kind: 'accent'
    readonly strength: number
  }
  | GuitarInteractionCueBase & {
    readonly kind: 'input-rest'
  }

export interface GuitarInteractionUpdate {
  readonly snapshot: GuitarInteractionSnapshot
  readonly cues: readonly GuitarInteractionCue[]
  readonly nextDeadlineAt: number | undefined
}

/**
 * Converts normalized press edges and monotonic time into presentation intent.
 * It does not choose animation clips, create effects, or retain input identities.
 */
export class GuitarInteractionMachine {
  private current: GuitarInteractionSnapshot = {
    lifecycle: 'inactive',
    parentGeneration: null,
    revision: 0,
    interaction: 'autonomous',
    activity: 0,
    burst: 0,
    releasing: false,
    lastInputAt: undefined,
  }

  private recentPresses: number[] = []
  private cueSequence = 0
  private lastAccentAt = Number.NEGATIVE_INFINITY
  private lastNow = Number.NEGATIVE_INFINITY

  constructor(private readonly now: () => number = () => performance.now()) { }

  public get snapshot(): GuitarInteractionSnapshot {
    return { ...this.current }
  }

  public activate(parentGeneration: number): GuitarInteractionUpdate {
    if (parentGeneration <= this.currentGeneration) return this.result()

    this.readNow()
    this.resetPhrase()
    this.current = {
      lifecycle: 'active',
      parentGeneration,
      revision: this.current.revision + 1,
      interaction: 'autonomous',
      activity: 0,
      burst: 0,
      releasing: false,
      lastInputAt: undefined,
    }

    return this.result()
  }

  public deactivate(parentGeneration: number): GuitarInteractionUpdate {
    if (parentGeneration < this.currentGeneration) return this.result()
    if (
      parentGeneration === this.current.parentGeneration
      && this.current.lifecycle === 'inactive'
    ) {
      return this.result()
    }

    this.resetPhrase()
    this.current = {
      lifecycle: 'inactive',
      parentGeneration,
      revision: this.current.revision + 1,
      interaction: 'autonomous',
      activity: 0,
      burst: 0,
      releasing: false,
      lastInputAt: undefined,
    }

    return this.result()
  }

  public press(parentGeneration: number): GuitarInteractionUpdate {
    if (!this.accepts(parentGeneration)) return this.result()

    const now = this.readNow()
    const previousLastInputAt = this.current.lastInputAt

    if (
      previousLastInputAt !== undefined
      && now - previousLastInputAt >= GUITAR_INTERACTION.restDelayMs
    ) {
      this.resetPhrase()
    }

    const windowStart = now - GUITAR_INTERACTION.sustainedWindowMs

    this.recentPresses = [
      ...this.recentPresses.filter(timestamp => timestamp >= windowStart),
      now,
    ]

    const sustainedPresses = this.recentPresses.length
    const burstStart = now - GUITAR_INTERACTION.burstWindowMs
    const burstPresses = this.recentPresses.filter(timestamp => timestamp >= burstStart).length
    const previousInteraction = previousLastInputAt === undefined
      || now - previousLastInputAt >= GUITAR_INTERACTION.restDelayMs
      ? 'autonomous'
      : this.current.interaction
    const interaction = deriveInteraction(previousInteraction, sustainedPresses, burstPresses)
    const activity = clamp01(sustainedPresses / GUITAR_INTERACTION.maxActivityPresses)
    const burst = clamp01(burstPresses / GUITAR_INTERACTION.burstDrivePresses)

    this.current = {
      lifecycle: 'active',
      parentGeneration,
      revision: this.current.revision + 1,
      interaction,
      activity,
      burst,
      releasing: false,
      lastInputAt: now,
    }

    const cues: GuitarInteractionCue[] = [{
      kind: 'press',
      sequence: ++this.cueSequence,
      parentGeneration,
      activity,
      burst,
    }]
    const accentRequested = (
      burstPresses >= GUITAR_INTERACTION.burstDrivePresses
      || sustainedPresses >= GUITAR_INTERACTION.driveEnterPresses
    ) && now - this.lastAccentAt >= GUITAR_INTERACTION.accentCooldownMs

    if (accentRequested) {
      this.lastAccentAt = now
      cues.push({
        kind: 'accent',
        sequence: ++this.cueSequence,
        parentGeneration,
        strength: Math.max(activity, burst),
      })
    }

    return this.result(cues)
  }

  public advance(parentGeneration: number): GuitarInteractionUpdate {
    if (!this.accepts(parentGeneration) || this.current.lastInputAt === undefined) {
      return this.result()
    }

    const now = this.readNow()
    const elapsed = now - this.current.lastInputAt

    if (elapsed >= GUITAR_INTERACTION.restDelayMs) {
      this.resetPhrase()
      this.current = {
        lifecycle: 'active',
        parentGeneration,
        revision: this.current.revision + 1,
        interaction: 'autonomous',
        activity: 0,
        burst: 0,
        releasing: false,
        lastInputAt: undefined,
      }

      return this.result([{
        kind: 'input-rest',
        sequence: ++this.cueSequence,
        parentGeneration,
      }])
    }

    if (elapsed >= GUITAR_INTERACTION.releaseDelayMs && !this.current.releasing) {
      this.current = {
        ...this.current,
        revision: this.current.revision + 1,
        releasing: true,
      }
    }

    return this.result()
  }

  private get currentGeneration(): number {
    return this.current.parentGeneration ?? Number.NEGATIVE_INFINITY
  }

  private accepts(parentGeneration: number): boolean {
    return this.current.lifecycle === 'active'
      && parentGeneration === this.current.parentGeneration
  }

  private readNow(): number {
    const candidate = this.now()

    if (Number.isFinite(candidate)) this.lastNow = Math.max(this.lastNow, candidate)
    if (!Number.isFinite(this.lastNow)) this.lastNow = 0

    return this.lastNow
  }

  private resetPhrase() {
    this.recentPresses = []
    this.lastAccentAt = Number.NEGATIVE_INFINITY
  }

  private result(cues: readonly GuitarInteractionCue[] = []): GuitarInteractionUpdate {
    return {
      snapshot: this.snapshot,
      cues: cues.map(cue => ({ ...cue })),
      nextDeadlineAt: this.nextDeadlineAt,
    }
  }

  private get nextDeadlineAt(): number | undefined {
    if (this.current.lifecycle !== 'active' || this.current.lastInputAt === undefined) return

    return this.current.lastInputAt + (
      this.current.releasing
        ? GUITAR_INTERACTION.restDelayMs
        : GUITAR_INTERACTION.releaseDelayMs
    )
  }
}

function deriveInteraction(
  previous: GuitarInteractionLevel,
  sustainedPresses: number,
  burstPresses: number,
): GuitarInteractionLevel {
  if (
    sustainedPresses >= GUITAR_INTERACTION.driveEnterPresses
    || burstPresses >= GUITAR_INTERACTION.burstDrivePresses
    || (
      previous === 'drive'
      && (
        sustainedPresses >= GUITAR_INTERACTION.driveExitPresses
        || burstPresses >= GUITAR_INTERACTION.burstDriveExitPresses
      )
    )
  ) {
    return 'drive'
  }

  if (
    sustainedPresses >= GUITAR_INTERACTION.grooveEnterPresses
    || (
      previous === 'groove'
      && sustainedPresses >= GUITAR_INTERACTION.grooveExitPresses
    )
  ) {
    return 'groove'
  }

  return 'engaged'
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}
