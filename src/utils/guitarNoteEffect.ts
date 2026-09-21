export type GuitarNoteVariant
  = | 'single'
    | 'double'
    | 'accent'
    | 'whole'
    | 'half'
    | 'quarter'
    | 'chord'
    | 'triplet'
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

export const GUITAR_NOTE_EFFECT = {
  minIntervalMs: 70,
  maxNotes: 6,
  durationMs: 820,
  restDelayMs: 1_000,
  activityWindowMs: 3_000,
  sixteenthTiers: [
    { minPresses: 6, every: 4 },
    { minPresses: 12, every: 3 },
    { minPresses: 20, every: 2 },
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

export class GuitarNoteEffect {
  private notes: GuitarNote[] = []
  private noteSequence = 0
  private recentPresses: number[] = []
  private lastInputAt = Number.NEGATIVE_INFINITY
  private lastTriggerAt = Number.NEGATIVE_INFINITY
  private restEmitted = false
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

  public trigger(): GuitarNote | undefined {
    const now = this.now()

    this.recordInput(now)

    if (now - this.lastTriggerAt < GUITAR_NOTE_EFFECT.minIntervalMs) return

    this.lastTriggerAt = now
    const sixteenthCadence = this.getSixteenthCadence()
    const variant = sixteenthCadence && this.recentPresses.length % sixteenthCadence === 0
      ? 'sixteenth'
      : this.pickBasicVariant()

    return this.createNote(variant)
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
    this.lastBasicVariant = undefined

    const variant = this.pickDifferent(REST_NOTE_VARIANTS, this.lastRestVariant)

    this.lastRestVariant = variant

    return this.createNote(variant)
  }

  private createNote(variant: GuitarNoteVariant): GuitarNote {
    const motion = this.pickDifferent(MOTION_PATTERNS, this.lastMotion)
    const palette = this.pickDifferent(NOTE_PALETTES, this.lastPalette)
    const note: GuitarNote = {
      ...motion,
      ...palette,
      id: ++this.noteSequence,
      variant,
      durationMs: GUITAR_NOTE_EFFECT.durationMs,
    }

    this.lastMotion = motion
    this.lastPalette = palette
    this.notes = [...this.notes.slice(-(GUITAR_NOTE_EFFECT.maxNotes - 1)), note]

    return { ...note }
  }

  public remove(id: number) {
    this.notes = this.notes.filter(note => note.id !== id)
  }

  public clear() {
    this.notes = []
    this.noteSequence = 0
    this.recentPresses = []
    this.lastInputAt = Number.NEGATIVE_INFINITY
    this.lastTriggerAt = Number.NEGATIVE_INFINITY
    this.restEmitted = false
    this.lastBasicVariant = undefined
    this.lastRestVariant = undefined
    this.lastMotion = undefined
    this.lastPalette = undefined
  }

  private recordInput(now: number) {
    const windowStart = now - GUITAR_NOTE_EFFECT.activityWindowMs

    this.recentPresses = [...this.recentPresses.filter(timestamp => timestamp >= windowStart), now]
    this.lastInputAt = now
    this.restEmitted = false
  }

  private getSixteenthCadence(): number | undefined {
    for (let index = GUITAR_NOTE_EFFECT.sixteenthTiers.length - 1; index >= 0; index--) {
      const tier = GUITAR_NOTE_EFFECT.sixteenthTiers[index]

      if (this.recentPresses.length >= tier.minPresses) return tier.every
    }
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
