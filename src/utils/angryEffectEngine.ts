export type AngryEffectIntensity = 'annoyed' | 'impatient' | 'furious'
export type AngryEffectEscalation = Exclude<AngryEffectIntensity, 'annoyed'>
export type AngryEffectVariant
  = | 'stress-arc'
    | 'anger-knot'
    | 'cross-pop'
    | 'steam-puff'
    | 'heat-spark'
export type AngryEffectSide = 'left' | 'right'
export type AngryEffectAnchorRegion = 'crown' | 'ear' | 'face-side'

export type AngryEffectStateSnapshot
  = | {
    readonly lifecycle: 'inactive'
    readonly parentGeneration: number | null
    readonly revision: number
  }
  | {
    readonly lifecycle: 'active'
    readonly parentGeneration: number
    readonly revision: number
    readonly intensity: AngryEffectIntensity
  }

export interface AngryEffectCue {
  readonly kind: 'anger-escalated'
  readonly intensity: AngryEffectEscalation
  readonly sequence: number
  readonly parentGeneration: number
}

export interface AngryEffectInstance {
  readonly id: number
  readonly variant: AngryEffectVariant
  readonly intensity: AngryEffectIntensity
  readonly side: AngryEffectSide
  readonly anchorRegion: AngryEffectAnchorRegion
  readonly color: string
  readonly accentColor: string
  readonly anchorX: number
  readonly anchorY: number
  readonly midDriftX: number
  readonly midDriftY: number
  readonly driftX: number
  readonly driftY: number
  readonly rotation: number
  readonly scale: number
  readonly shape: 0 | 1 | 2
  readonly delayMs: number
  readonly durationMs: number
}

export const ANGRY_EFFECT = {
  maxInstances: 12,
  maxSustainBurst: 6,
  maxLifetimeMs: 1_900,
  sustainIntervalsMs: {
    annoyed: [4_300, 5_200, 4_700],
    impatient: [2_500, 3_100, 2_750],
    furious: [1_450, 1_900, 1_650],
  },
  durationMs: {
    stressArc: 820,
    angerKnot: 940,
    crossPop: 680,
    steamPuff: 1_360,
    heatSpark: 760,
  },
} as const

interface AngryEffectPalette {
  readonly color: string
  readonly accentColor: string
}

interface AngryEffectAnchor {
  readonly x: number
  readonly y: number
}

const ANGRY_EFFECT_ANCHORS: Record<AngryEffectAnchorRegion, {
  readonly leftX: number
  readonly rightX: number
  readonly y: number
}> = {
  'crown': { leftX: 43, rightX: 57, y: 12 },
  'ear': { leftX: 28, rightX: 72, y: 23 },
  'face-side': { leftX: 20, rightX: 80, y: 42 },
}

const ANCHOR_X_JITTER = [0, 3, -2] as const
const ANCHOR_Y_JITTER = [0, 3, -2] as const

const EFFECT_PALETTES: Record<AngryEffectIntensity, AngryEffectPalette> = {
  annoyed: {
    color: '#ff927d',
    accentColor: '#ffd29a',
  },
  impatient: {
    color: '#ff6f59',
    accentColor: '#ffc45e',
  },
  furious: {
    color: '#ff493d',
    accentColor: '#ffad32',
  },
}

const INTENSITY_RANK: Record<AngryEffectIntensity, number> = {
  annoyed: 0,
  impatient: 1,
  furious: 2,
}

/**
 * Presentation-only consumer for the ANGRY child state. Waiting thresholds
 * and escalation decisions remain owned by the upstream state machine.
 */
export class AngryEffectEngine {
  private effects: AngryEffectInstance[] = []
  private readonly expiryById = new Map<number, number>()
  private effectSequence = 0
  private emissionOrdinal = 0
  private sustainOrdinal = 0
  private activeGeneration: number | null = null
  private latestGeneration = Number.NEGATIVE_INFINITY
  private activeRevision = Number.NEGATIVE_INFINITY
  private currentIntensity: AngryEffectIntensity | null = null
  private lastCueSequence = 0
  private sustainDeadlineAt: number | undefined
  private lastNow = Number.NEGATIVE_INFINITY

  constructor(private readonly now: () => number = Date.now) { }

  public get snapshot(): readonly AngryEffectInstance[] {
    return this.effects.map(effect => ({ ...effect }))
  }

  public get intensity(): AngryEffectIntensity | null {
    return this.currentIntensity
  }

  public get nextSustainAt(): number | undefined {
    return this.sustainDeadlineAt
  }

  public get nextDeadlineAt(): number | undefined {
    let next = this.sustainDeadlineAt

    for (const deadline of this.expiryById.values()) {
      if (next === undefined || deadline < next) next = deadline
    }

    return next
  }

  public applySnapshot(snapshot: AngryEffectStateSnapshot): boolean {
    if (snapshot.lifecycle === 'inactive') {
      if (snapshot.parentGeneration === null) return false

      return this.deactivate(snapshot.parentGeneration)
    }

    const { parentGeneration, revision, intensity } = snapshot

    if (
      !Number.isFinite(parentGeneration)
      || !Number.isFinite(revision)
      || parentGeneration < this.latestGeneration
    ) {
      return false
    }

    if (parentGeneration > this.latestGeneration) {
      const now = this.readNow()

      this.latestGeneration = parentGeneration
      this.activeGeneration = parentGeneration
      this.activeRevision = revision
      this.currentIntensity = intensity
      this.resetVisualState()
      this.emitEntry(intensity, now)
      this.scheduleSustain(intensity, now)
      return true
    }

    if (
      this.activeGeneration !== parentGeneration
      || revision <= this.activeRevision
    ) {
      return false
    }

    const now = this.readNow()

    this.activeRevision = revision
    this.currentIntensity = intensity
    this.scheduleSustain(intensity, now)
    return true
  }

  public deactivate(parentGeneration: number): boolean {
    if (!Number.isFinite(parentGeneration) || parentGeneration < this.latestGeneration) return false
    if (this.activeGeneration === null && parentGeneration === this.latestGeneration) return false

    this.latestGeneration = parentGeneration
    this.activeGeneration = null
    this.activeRevision = Number.NEGATIVE_INFINITY
    this.currentIntensity = null
    this.resetVisualState()
    return true
  }

  public consume(cue: AngryEffectCue): readonly AngryEffectInstance[] {
    if (cue.parentGeneration !== this.activeGeneration) return []
    if (!Number.isFinite(cue.sequence) || cue.sequence <= this.lastCueSequence) return []

    this.lastCueSequence = cue.sequence

    if (
      this.currentIntensity !== null
      && INTENSITY_RANK[cue.intensity] < INTENSITY_RANK[this.currentIntensity]
    ) {
      return []
    }

    return this.emitEscalation(cue.intensity, this.readNow())
  }

  public advance(now = this.now()): readonly AngryEffectInstance[] {
    const currentNow = this.readNow(now)
    const expiredIds = new Set<number>()

    for (const [id, deadline] of this.expiryById) {
      if (deadline <= currentNow) expiredIds.add(id)
    }

    if (expiredIds.size > 0) {
      this.effects = this.effects.filter(effect => !expiredIds.has(effect.id))
      for (const id of expiredIds) this.expiryById.delete(id)
    }

    if (
      this.activeGeneration === null
      || this.currentIntensity === null
      || this.sustainDeadlineAt === undefined
      || currentNow < this.sustainDeadlineAt
    ) {
      return []
    }

    const emitted = this.emitSustain(this.currentIntensity, currentNow)

    this.scheduleSustain(this.currentIntensity, currentNow)
    return emitted
  }

  private emitEntry(
    intensity: AngryEffectIntensity,
    now: number,
  ): readonly AngryEffectInstance[] {
    const side = this.nextSide()

    if (intensity === 'annoyed') {
      return [this.createStressArc(intensity, side, 'crown', now, 0, 0.76, 0)]
    }

    if (intensity === 'impatient') {
      return [
        this.createStressArc(intensity, side, 'face-side', now, 0, 0.84, 1),
        this.createSteamPuff(intensity, opposite(side), 'ear', now, 190, 0.76, 0),
      ]
    }

    return [
      this.createStressArc(intensity, side, 'face-side', now, 0, 0.94, 2),
      this.createAngerKnot(intensity, opposite(side), 'crown', now, 100, 0.78, 2),
      this.createSteamPuff(intensity, 'left', 'ear', now, 180, 0.9, 1),
      this.createSteamPuff(intensity, 'right', 'ear', now, 330, 1.04, 2),
      this.createCrossPop(intensity, side, 'face-side', now, 410, 0.62, 0),
      this.createHeatSpark(intensity, opposite(side), 'crown', now, 350, 0.86, 0),
    ]
  }

  private emitEscalation(
    intensity: AngryEffectEscalation,
    now: number,
  ): readonly AngryEffectInstance[] {
    const side = this.nextSide()

    if (intensity === 'impatient') {
      return [
        this.createStressArc(intensity, side, 'ear', now, 0, 0.9, 1),
        this.createAngerKnot(intensity, opposite(side), 'crown', now, 100, 0.78, 1),
        this.createSteamPuff(intensity, side, 'ear', now, 180, 0.8, 0),
        this.createSteamPuff(intensity, opposite(side), 'face-side', now, 360, 0.98, 2),
        this.createCrossPop(intensity, side, 'face-side', now, 480, 0.62, 0),
        this.createCrossPop(intensity, opposite(side), 'crown', now, 620, 0.52, 1),
      ]
    }

    return [
      this.createStressArc(intensity, side, 'face-side', now, 0, 1.02, 2),
      this.createAngerKnot(intensity, opposite(side), 'crown', now, 90, 0.92, 2),
      this.createSteamPuff(intensity, side, 'ear', now, 210, 0.94, 1),
      this.createSteamPuff(intensity, opposite(side), 'face-side', now, 380, 1.12, 2),
      this.createCrossPop(intensity, side, 'crown', now, 400, 0.76, 0),
      this.createCrossPop(intensity, opposite(side), 'face-side', now, 510, 0.64, 1),
      this.createCrossPop(intensity, side, 'crown', now, 620, 0.52, 2),
      this.createHeatSpark(intensity, side, 'face-side', now, 300, 1, 0),
      this.createHeatSpark(intensity, opposite(side), 'ear', now, 440, 0.82, 1),
    ]
  }

  private emitSustain(
    intensity: AngryEffectIntensity,
    now: number,
  ): readonly AngryEffectInstance[] {
    const side = this.nextSide()
    const phrase = this.sustainOrdinal++ % 3 as 0 | 1 | 2

    if (intensity === 'annoyed') {
      if (phrase === 1) {
        return [this.createStressArc(intensity, side, 'crown', now, 0, 0.62, 0)]
      }

      return [
        this.createSteamPuff(
          intensity,
          side,
          phrase === 0 ? 'ear' : 'face-side',
          now,
          0,
          phrase === 0 ? 0.64 : 0.72,
          phrase,
        ),
      ]
    }

    if (intensity === 'impatient') {
      if (phrase === 1) {
        return [
          this.createStressArc(intensity, side, 'crown', now, 0, 0.76, 1),
          this.createSteamPuff(intensity, opposite(side), 'ear', now, 170, 0.78, 2),
          this.createCrossPop(intensity, side, 'face-side', now, 310, 0.54, 0),
          this.createCrossPop(intensity, opposite(side), 'crown', now, 440, 0.46, 1),
        ]
      }

      if (phrase === 2) {
        return [
          this.createAngerKnot(intensity, side, 'crown', now, 0, 0.68, 0),
          this.createSteamPuff(intensity, opposite(side), 'face-side', now, 170, 0.76, 2),
          this.createCrossPop(intensity, side, 'ear', now, 360, 0.48, 2),
        ]
      }

      return [
        this.createSteamPuff(intensity, side, 'ear', now, 0, 0.78, 0),
        this.createSteamPuff(intensity, opposite(side), 'face-side', now, 180, 0.9, 1),
      ]
    }

    if (phrase === 1) {
      return [
        this.createAngerKnot(intensity, side, 'crown', now, 0, 0.86, 2),
        this.createSteamPuff(intensity, opposite(side), 'ear', now, 150, 1.06, 1),
        this.createCrossPop(intensity, side, 'face-side', now, 260, 0.68, 0),
        this.createCrossPop(intensity, opposite(side), 'crown', now, 390, 0.56, 1),
        this.createHeatSpark(intensity, side, 'face-side', now, 250, 0.88, 0),
      ]
    }

    return [
      this.createSteamPuff(intensity, side, 'ear', now, 0, phrase === 0 ? 0.9 : 1.04, phrase),
      this.createSteamPuff(intensity, opposite(side), 'face-side', now, phrase === 0 ? 120 : 240, phrase === 0 ? 1.02 : 0.82, (phrase + 1) % 3 as 0 | 1 | 2),
      this.createCrossPop(intensity, side, 'crown', now, 190, 0.66, phrase),
      this.createCrossPop(intensity, opposite(side), 'face-side', now, 320, 0.54, (phrase + 1) % 3 as 0 | 1 | 2),
      this.createHeatSpark(intensity, side, 'face-side', now, 210, 0.86, phrase),
      this.createHeatSpark(intensity, opposite(side), 'ear', now, 360, 0.68, (phrase + 2) % 3 as 0 | 1 | 2),
    ]
  }

  private createStressArc(
    intensity: AngryEffectIntensity,
    side: AngryEffectSide,
    anchorRegion: AngryEffectAnchorRegion,
    now: number,
    delayMs: number,
    scale: number,
    shape: 0 | 1 | 2,
  ): AngryEffectInstance {
    const outward = side === 'left' ? -1 : 1
    const anchor = resolveAngryEffectAnchor(side, anchorRegion, shape)
    const driftX = [10, 16, 8][shape] * outward

    return this.createEffect({
      variant: 'stress-arc',
      intensity,
      side,
      anchorRegion,
      anchorX: anchor.x,
      anchorY: anchor.y,
      midDriftX: driftX * 0.46,
      midDriftY: [-3, -7, -2][shape],
      driftX,
      driftY: [-8, -13, -6][shape],
      rotation: [8, 14, 5][shape] * outward,
      scale,
      shape,
      delayMs,
      durationMs: ANGRY_EFFECT.durationMs.stressArc + shape * 55,
    }, now)
  }

  private createAngerKnot(
    intensity: AngryEffectIntensity,
    side: AngryEffectSide,
    anchorRegion: AngryEffectAnchorRegion,
    now: number,
    delayMs: number,
    scale: number,
    shape: 0 | 1 | 2,
  ): AngryEffectInstance {
    const outward = side === 'left' ? -1 : 1
    const anchor = resolveAngryEffectAnchor(side, anchorRegion, shape)

    return this.createEffect({
      variant: 'anger-knot',
      intensity,
      side,
      anchorRegion,
      anchorX: anchor.x,
      anchorY: anchor.y,
      midDriftX: [3, 6, 2][shape] * outward,
      midDriftY: [-3, -6, -1][shape],
      driftX: [7, 11, 5][shape] * outward,
      driftY: [-8, -12, -5][shape],
      rotation: [5, 10, 3][shape] * outward,
      scale,
      shape,
      delayMs,
      durationMs: ANGRY_EFFECT.durationMs.angerKnot + shape * 45,
    }, now)
  }

  private createCrossPop(
    intensity: AngryEffectIntensity,
    side: AngryEffectSide,
    anchorRegion: AngryEffectAnchorRegion,
    now: number,
    delayMs: number,
    scale: number,
    shape: 0 | 1 | 2,
  ): AngryEffectInstance {
    const outward = side === 'left' ? -1 : 1
    const anchor = resolveAngryEffectAnchor(side, anchorRegion, shape)

    return this.createEffect({
      variant: 'cross-pop',
      intensity,
      side,
      anchorRegion,
      anchorX: anchor.x,
      anchorY: anchor.y,
      midDriftX: [5, 10, 2][shape] * outward,
      midDriftY: [-5, 2, -9][shape],
      driftX: [15, 24, 10][shape] * outward,
      driftY: [-16, 9, -23][shape],
      rotation: [12, -18, 25][shape] * outward,
      scale,
      shape,
      delayMs,
      durationMs: ANGRY_EFFECT.durationMs.crossPop + [0, 80, -40][shape],
    }, now)
  }

  private createSteamPuff(
    intensity: AngryEffectIntensity,
    side: AngryEffectSide,
    anchorRegion: AngryEffectAnchorRegion,
    now: number,
    delayMs: number,
    scale: number,
    shape: 0 | 1 | 2,
  ): AngryEffectInstance {
    const outward = side === 'left' ? -1 : 1
    const anchor = resolveAngryEffectAnchor(side, anchorRegion, shape)
    const driftX = [27, 39, 32][shape] * outward

    return this.createEffect({
      variant: 'steam-puff',
      intensity,
      side,
      anchorRegion,
      anchorX: anchor.x,
      anchorY: anchor.y,
      midDriftX: [9, 18, 5][shape] * outward,
      midDriftY: [-9, -17, -7][shape],
      driftX,
      driftY: [-35, -29, -46][shape],
      rotation: [9, 16, 6][shape] * outward,
      scale,
      shape,
      delayMs,
      durationMs: ANGRY_EFFECT.durationMs.steamPuff + [0, 90, -70][shape],
    }, now)
  }

  private createHeatSpark(
    intensity: AngryEffectIntensity,
    side: AngryEffectSide,
    anchorRegion: AngryEffectAnchorRegion,
    now: number,
    delayMs: number,
    scale: number,
    shape: 0 | 1 | 2,
  ): AngryEffectInstance {
    const outward = side === 'left' ? -1 : 1
    const anchor = resolveAngryEffectAnchor(side, anchorRegion, shape)

    return this.createEffect({
      variant: 'heat-spark',
      intensity,
      side,
      anchorRegion,
      anchorX: anchor.x,
      anchorY: anchor.y,
      midDriftX: [15, 22, 11][shape] * outward,
      midDriftY: [-10, 2, 8][shape],
      driftX: [36, 46, 31][shape] * outward,
      driftY: [-24, 9, 22][shape],
      rotation: [22, 34, 16][shape] * outward,
      scale,
      shape,
      delayMs,
      durationMs: ANGRY_EFFECT.durationMs.heatSpark + [0, 90, -50][shape],
    }, now)
  }

  private createEffect(
    effect: Omit<AngryEffectInstance, 'id' | 'color' | 'accentColor'>,
    now: number,
  ): AngryEffectInstance {
    const instance: AngryEffectInstance = {
      ...effect,
      ...EFFECT_PALETTES[effect.intensity],
      id: ++this.effectSequence,
    }
    const retained = this.effects.slice(-(ANGRY_EFFECT.maxInstances - 1))
    const retainedIds = new Set(retained.map(item => item.id))

    for (const id of this.expiryById.keys()) {
      if (!retainedIds.has(id)) this.expiryById.delete(id)
    }

    this.effects = [...retained, instance]
    this.expiryById.set(
      instance.id,
      now + instance.delayMs + instance.durationMs,
    )
    return { ...instance }
  }

  private scheduleSustain(intensity: AngryEffectIntensity, now: number) {
    const intervals = ANGRY_EFFECT.sustainIntervalsMs[intensity]

    this.sustainDeadlineAt = now + intervals[this.sustainOrdinal % intervals.length]
  }

  private nextSide(): AngryEffectSide {
    const side = this.emissionOrdinal % 2 === 0 ? 'right' : 'left'

    this.emissionOrdinal++
    return side
  }

  private readNow(candidate = this.now()): number {
    if (Number.isFinite(candidate)) this.lastNow = Math.max(this.lastNow, candidate)
    if (!Number.isFinite(this.lastNow)) this.lastNow = 0

    return this.lastNow
  }

  private resetVisualState() {
    this.effects = []
    this.expiryById.clear()
    this.emissionOrdinal = 0
    this.sustainOrdinal = 0
    this.lastCueSequence = 0
    this.sustainDeadlineAt = undefined
  }
}

function opposite(side: AngryEffectSide): AngryEffectSide {
  return side === 'left' ? 'right' : 'left'
}

function resolveAngryEffectAnchor(
  side: AngryEffectSide,
  region: AngryEffectAnchorRegion,
  shape: 0 | 1 | 2,
): AngryEffectAnchor {
  const anchor = ANGRY_EFFECT_ANCHORS[region]
  const outward = side === 'left' ? -1 : 1

  return {
    x: (side === 'left' ? anchor.leftX : anchor.rightX) + outward * ANCHOR_X_JITTER[shape],
    y: anchor.y + ANCHOR_Y_JITTER[shape],
  }
}
