export type GuitarNoteVariant
  = | 'single'
    | 'double'
    | 'accent'
    | 'whole'
    | 'half'
    | 'quarter'
    | 'chord'
    | 'triplet'
    | 'sharp'
    | 'flat'
    | 'sixteenth'
    | 'rest'
    | 'eighthRest'

export interface GuitarNote {
  id: number
  variant: GuitarNoteVariant
  color: string
  accentColor: string
  offsetX: number
  midDriftX: number
  midDriftY: number
  driftX: number
  driftY: number
  rotation: number
  scale: number
  durationMs: number
}

interface GuitarEffectCueBase {
  readonly sequence: number
  readonly parentGeneration: number
}

/**
 * Structural subset of the guitar state-machine output consumed by effects.
 * It intentionally contains no input timestamps or lifecycle deadlines.
 */
export type GuitarEffectCue
  = | GuitarEffectCueBase & {
    readonly kind: 'press'
    readonly activity: number
    readonly burst: number
  }
  | GuitarEffectCueBase & {
    readonly kind: 'accent'
    readonly strength: number
  }
  | GuitarEffectCueBase & {
    readonly kind: 'input-rest'
  }

export const GUITAR_EFFECT = {
  minIntervalMs: 70,
  maxInstances: 6,
  durationMs: 820,
  sixteenthActivityTiers: [
    { minActivity: 0.3, every: 4 },
    { minActivity: 0.6, every: 3 },
    { minActivity: 1, every: 2 },
  ],
} as const

const BASIC_NOTE_VARIANTS: readonly GuitarNoteVariant[] = [
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
]

const REST_NOTE_VARIANTS: readonly GuitarNoteVariant[] = ['rest', 'eighthRest']

interface NotePalette {
  color: string
  accentColor: string
}

const NOTE_PALETTES: readonly NotePalette[] = [
  { color: '#6ee7ff', accentColor: '#b5fff1' },
  { color: '#75b8ff', accentColor: '#c9d7ff' },
  { color: '#8ff0c7', accentColor: '#d4ff9f' },
  { color: '#c8f28b', accentColor: '#fff3a0' },
  { color: '#ffe082', accentColor: '#ffb878' },
  { color: '#ffb07c', accentColor: '#ff8f9c' },
  { color: '#ff8fa8', accentColor: '#ffd0ea' },
  { color: '#ff91d0', accentColor: '#d9a8ff' },
  { color: '#c7a6ff', accentColor: '#91c4ff' },
  { color: '#d4f1ff', accentColor: '#f0b6ff' },
]

type GuitarNoteMotion = Omit<GuitarNote, 'id' | 'variant' | 'color' | 'accentColor' | 'durationMs'>

const MOTION_PATTERNS: readonly GuitarNoteMotion[] = [
  { offsetX: 2, midDriftX: 30, midDriftY: -18, driftX: 72, driftY: -46, rotation: 12, scale: 0.94 },
  { offsetX: 4, midDriftX: 42, midDriftY: -8, driftX: 94, driftY: -20, rotation: 15, scale: 1 },
  { offsetX: 4, midDriftX: 33, midDriftY: 17, driftX: 78, driftY: 44, rotation: 11, scale: 1.06 },
  { offsetX: 6, midDriftX: 27, midDriftY: 26, driftX: 66, driftY: 62, rotation: 8, scale: 1.02 },
  { offsetX: -4, midDriftX: -30, midDriftY: 18, driftX: -72, driftY: 48, rotation: -12, scale: 0.98 },
  { offsetX: -6, midDriftX: -42, midDriftY: 10, driftX: -92, driftY: 28, rotation: -15, scale: 0.96 },
  { offsetX: 2, midDriftX: 44, midDriftY: 2, driftX: 98, driftY: 8, rotation: 6, scale: 1 },
]

/**
 * Cue-driven guitar effect consumer. Input density and silence semantics are
 * supplied by the state machine; this class only owns visual instances.
 */
export class GuitarEffectEngine {
  private notes: GuitarNote[] = []
  private readonly expiryById = new Map<number, number>()
  private noteSequence = 0
  private activeGeneration: number | null = null
  private latestGeneration = Number.NEGATIVE_INFINITY
  private lastCueSequence = 0
  private pressOrdinal = 0
  private lastTriggerAt = Number.NEGATIVE_INFINITY
  private lastBasicVariant: GuitarNoteVariant | undefined
  private lastRestVariant: GuitarNoteVariant | undefined
  private lastMotion: GuitarNoteMotion | undefined
  private lastPalette: NotePalette | undefined

  constructor(
    private readonly now: () => number = Date.now,
    private readonly random: () => number = Math.random,
  ) { }

  public get snapshot(): readonly GuitarNote[] {
    return this.notes.map(note => ({ ...note }))
  }

  public get nextDeadlineAt(): number | undefined {
    let next: number | undefined

    for (const deadline of this.expiryById.values()) {
      if (next === undefined || deadline < next) next = deadline
    }

    return next
  }

  public activate(parentGeneration: number) {
    if (!Number.isFinite(parentGeneration)) return
    if (this.activeGeneration === parentGeneration) return
    if (parentGeneration <= this.latestGeneration) return

    this.latestGeneration = parentGeneration
    this.activeGeneration = parentGeneration
    this.resetVisualState()
  }

  public deactivate(parentGeneration: number) {
    if (!Number.isFinite(parentGeneration) || parentGeneration < this.latestGeneration) return

    this.latestGeneration = parentGeneration
    this.activeGeneration = null
    this.resetVisualState()
  }

  public consume(cue: GuitarEffectCue): GuitarNote | undefined {
    if (cue.parentGeneration !== this.activeGeneration) return
    if (!Number.isFinite(cue.sequence) || cue.sequence <= this.lastCueSequence) return

    this.lastCueSequence = cue.sequence

    switch (cue.kind) {
      case 'press':
        return this.consumePress(cue.activity)
      case 'accent':
        return this.createNote('accent')
      case 'input-rest':
        return this.consumeRest()
    }
  }

  public remove(id: number) {
    this.notes = this.notes.filter(note => note.id !== id)
    this.expiryById.delete(id)
  }

  public advance(now = this.now()) {
    if (!Number.isFinite(now)) return

    const expiredIds = new Set<number>()

    for (const [id, deadline] of this.expiryById) {
      if (deadline <= now) expiredIds.add(id)
    }

    if (expiredIds.size === 0) return

    this.notes = this.notes.filter(note => !expiredIds.has(note.id))
    for (const id of expiredIds) this.expiryById.delete(id)
  }

  private consumePress(activity: number): GuitarNote | undefined {
    const now = this.now()

    this.pressOrdinal++

    if (now - this.lastTriggerAt < GUITAR_EFFECT.minIntervalMs) return

    this.lastTriggerAt = now

    const sixteenthCadence = this.getSixteenthCadence(activity)
    const variant = sixteenthCadence && this.pressOrdinal % sixteenthCadence === 0
      ? 'sixteenth'
      : this.pickBasicVariant()

    return this.createNote(variant, now)
  }

  private consumeRest(): GuitarNote {
    this.pressOrdinal = 0
    this.lastBasicVariant = undefined

    const variant = this.pickDifferent(REST_NOTE_VARIANTS, this.lastRestVariant)

    this.lastRestVariant = variant

    return this.createNote(variant)
  }

  private createNote(variant: GuitarNoteVariant, createdAt = this.now()): GuitarNote {
    const motion = this.pickDifferent(MOTION_PATTERNS, this.lastMotion)
    const palette = this.pickDifferent(NOTE_PALETTES, this.lastPalette)
    const note: GuitarNote = {
      ...motion,
      ...palette,
      id: ++this.noteSequence,
      variant,
      durationMs: GUITAR_EFFECT.durationMs,
    }

    this.lastMotion = motion
    this.lastPalette = palette
    const evicted = this.notes.slice(0, -(GUITAR_EFFECT.maxInstances - 1))

    for (const item of evicted) this.expiryById.delete(item.id)

    this.notes = [...this.notes.slice(-(GUITAR_EFFECT.maxInstances - 1)), note]
    this.expiryById.set(note.id, createdAt + note.durationMs)

    return { ...note }
  }

  private getSixteenthCadence(activity: number): number | undefined {
    const normalizedActivity = Number.isFinite(activity)
      ? Math.min(Math.max(activity, 0), 1)
      : 0

    for (let index = GUITAR_EFFECT.sixteenthActivityTiers.length - 1; index >= 0; index--) {
      const tier = GUITAR_EFFECT.sixteenthActivityTiers[index]

      if (normalizedActivity >= tier.minActivity) return tier.every
    }
  }

  private resetVisualState() {
    this.notes = []
    this.expiryById.clear()
    this.lastCueSequence = 0
    this.pressOrdinal = 0
    this.lastTriggerAt = Number.NEGATIVE_INFINITY
    this.lastBasicVariant = undefined
    this.lastRestVariant = undefined
    this.lastMotion = undefined
    this.lastPalette = undefined
  }

  private pickBasicVariant(): GuitarNoteVariant {
    const variant = this.pickDifferent(BASIC_NOTE_VARIANTS, this.lastBasicVariant)

    this.lastBasicVariant = variant

    return variant
  }

  private pickDifferent<T>(values: readonly T[], previous: T | undefined): T {
    const candidate = this.pick(values)

    if (values.length === 1 || candidate !== previous) return candidate

    return values[(values.indexOf(candidate) + 1) % values.length]
  }

  private pick<T>(values: readonly T[]): T {
    const random = this.random()
    const normalized = Number.isFinite(random) ? Math.min(Math.max(random, 0), 0.999_999) : 0

    return values[Math.floor(normalized * values.length)]
  }
}
