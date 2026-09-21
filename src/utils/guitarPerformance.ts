export interface HandPose { x: number, y: number }
export type GuitarMode = 'gentle' | 'groove' | 'accent' | 'release'
export type GuitarClip = 'pick' | 'down' | 'up' | 'double' | 'accent' | 'settle' | 'rest'

interface ClipKey extends HandPose {
  at: number
  vx?: number
  vy?: number
}

export interface GuitarPhrase {
  id: string
  mode: GuitarMode
  // [clip, beats, strength]; rhythm belongs to the phrase, not to random frame noise.
  steps: ReadonlyArray<readonly [GuitarClip, number, number]>
  // Normalized timeline across the WHOLE phrase; short hand clips cannot restart it.
  head: readonly ClipKey[]
}

export const GUITAR_PERFORMANCE = {
  enterMs: 360,
  exitMs: 240,
  maxFrameMs: 100,
  travelX: 17,
  travelY: 7,
  accentCooldown: 6,
  accentChance: 0.45,
  tempoStep: 6,
  energyStep: 0.18,
} as const

// Head angles also deform the torso, but NOT the guitar/hands. Tune their alignment visually.
// Positive X deforms this model more strongly than negative X, hence unequal limits.
export const GUITAR_HEAD = {
  left: 28,
  right: 26,
  lift: 24,
  press: 28,
  minimumWeight: 0.35,
} as const

// Normalized authored poses. These are coupled hands/guitar channels, not individual fingers.
// vx/vy are tangents in normalized clip time; omitted tangents settle at the key.
export const GUITAR_CLIPS: Record<GuitarClip, readonly ClipKey[]> = {
  pick: [
    { at: 0.22, x: -0.32, y: 0.1 },
    { at: 0.42, x: 0.28, y: -0.15, vx: 0.7 },
    { at: 1, x: -0.08, y: 0.04 },
  ],
  down: [
    { at: 0.2, x: -0.72, y: 0.24 },
    { at: 0.46, x: 0.82, y: -0.3, vx: 0.45, vy: -0.1 },
    { at: 1, x: 0.45, y: -0.08, vx: -0.18 },
  ],
  up: [
    { at: 0.18, x: 0.52, y: -0.12 },
    { at: 0.55, x: -0.68, y: 0.2, vx: -0.35 },
    { at: 1, x: -0.3, y: 0.07, vx: 0.15 },
  ],
  double: [
    { at: 0.16, x: -0.35, y: 0.07 },
    { at: 0.3, x: 0.5, y: -0.2 },
    { at: 0.54, x: -0.4, y: 0.16 },
    { at: 0.72, x: 0.62, y: -0.24, vx: 0.25 },
    { at: 1, x: 0.18, y: -0.02 },
  ],
  accent: [
    { at: 0.3, x: -0.95, y: 0.32 },
    { at: 0.5, x: 1, y: -0.38, vx: 0.65 },
    { at: 0.68, x: 0.68, y: -0.42 },
    { at: 1, x: 0.3, y: -0.06 },
  ],
  settle: [{ at: 1, x: -0.12, y: 0.08 }],
  rest: [{ at: 1, x: 0, y: 0 }], // Hold the actual preceding pose, not the origin.
}

export const GUITAR_MODES: Record<GuitarMode, {
  phrases: readonly [number, number]
  bpm: readonly [number, number]
  energy: readonly [number, number]
}> = {
  gentle: { phrases: [2, 4], bpm: [80, 94], energy: [0.55, 0.72] },
  groove: { phrases: [2, 3], bpm: [90, 108], energy: [0.75, 0.94] },
  accent: { phrases: [1, 1], bpm: [94, 110], energy: [0.96, 1.08] },
  release: { phrases: [1, 1], bpm: [78, 88], energy: [0.48, 0.62] },
}

// Head motion has its own dynamics: gentle/release phrases settle and hold while
// the hands play; groove phrases mix small gestures with one livelier phrase.
// Accents drop in 0.4 beat, land 0.06 beat after the hand peak, hold briefly, then
// recover slowly. Repeated poses deliberately leave space instead of adding sway.
export const GUITAR_PHRASES: readonly GuitarPhrase[] = [
  { id: 'soft-picks', mode: 'gentle', steps: [
    ['pick', 1, 0.8],
    ['pick', 0.5, 0.65],
    ['rest', 0.5, 1],
    ['down', 1, 0.7],
    ['up', 0.5, 0.6],
    ['settle', 0.5, 1],
  ], head: [
    { at: 0.2, x: -0.1, y: 0.05 },
    { at: 0.35, x: -0.12, y: 0.03 },
    { at: 0.65, x: -0.12, y: 0.03 },
    { at: 1, x: -0.07, y: 0.06 },
  ] },
  { id: 'offbeat-picks', mode: 'gentle', steps: [
    ['pick', 0.75, 0.75],
    ['rest', 0.25, 1],
    ['pick', 0.5, 0.6],
    ['up', 0.5, 0.6],
    ['double', 1, 0.7],
    ['settle', 1, 1],
  ], head: [
    { at: 0.2, x: 0.12, y: 0.04 },
    { at: 0.38, x: 0.15, y: 0.02 },
    { at: 0.82, x: 0.15, y: 0.02 },
    { at: 1, x: 0.1, y: 0.04 },
  ] },
  { id: 'call-response', mode: 'gentle', steps: [
    ['down', 1, 0.75],
    ['pick', 0.5, 0.65],
    ['rest', 0.5, 1],
    ['up', 1, 0.7],
    ['pick', 0.5, 0.55],
    ['rest', 0.5, 1],
  ], head: [
    { at: 0.25, x: -0.15, y: 0.08 },
    { at: 0.47, x: -0.15, y: 0.08 },
    { at: 0.7, x: -0.1, y: -0.08 },
    { at: 1, x: -0.08, y: 0.04 },
  ] },
  { id: 'open-strum', mode: 'groove', steps: [
    ['down', 1, 1],
    ['up', 0.5, 0.75],
    ['down', 0.5, 0.85],
    ['rest', 0.5, 1],
    ['double', 1, 0.8],
    ['settle', 0.5, 1],
  ], head: [
    { at: 0.16, x: -0.25, y: 0.1 },
    { at: 0.32, x: -0.38, y: 0.5 },
    { at: 0.46, x: -0.3, y: -0.5 }, // Downstroke at beat 1.73; a moderate nod at 1.84.
    { at: 0.7, x: 0.3, y: 0.18 },
    { at: 0.86, x: 0.3, y: 0.18 },
    { at: 1, x: 0.26, y: 0.16 },
  ] },
  { id: 'rolling-strum', mode: 'groove', steps: [
    ['double', 1, 0.85],
    ['up', 0.5, 0.6],
    ['pick', 0.5, 0.55],
    ['down', 1, 1],
    ['up', 0.5, 0.75],
    ['rest', 0.5, 1],
  ], head: [
    { at: 0.18, x: -0.25, y: 0.12 },
    { at: 0.46, x: -0.85, y: 0.85 },
    { at: 0.655, x: -0.7, y: -0.85 }, // Downstroke at beat 2.46; press at 2.62.
    { at: 0.88, x: 0.6, y: 0.35 },
    { at: 1, x: 0.6, y: 0.35 },
  ] },
  { id: 'syncopated-strum', mode: 'groove', steps: [
    ['down', 0.75, 0.9],
    ['rest', 0.25, 1],
    ['up', 0.5, 0.65],
    ['double', 1, 0.85],
    ['down', 1, 0.8],
    ['settle', 0.5, 1],
  ], head: [
    { at: 0.18, x: 0.12, y: 0.05 },
    { at: 0.6, x: 0.12, y: 0.05 },
    { at: 0.68, x: 0.16, y: 0.22 },
    { at: 0.77, x: 0.17, y: -0.25 }, // Downstroke at beat 2.96; only a small acknowledgement.
    { at: 0.9, x: 0.12, y: 0.04 },
    { at: 1, x: 0.12, y: 0.04 },
  ] },
  { id: 'accent-answer', mode: 'accent', steps: [
    ['down', 0.75, 0.8],
    ['up', 0.75, 0.65],
    ['accent', 1, 1],
    ['rest', 0.5, 1],
    ['settle', 1, 1],
  ], head: [
    { at: 0.18, x: -0.25, y: 0.12 },
    { at: 0.415, x: -0.35, y: 1 },
    { at: 0.515, x: -0.27, y: -1 }, // Accent at beat 2; a fast drop lands at 2.06.
    { at: 0.555, x: -0.27, y: -1 }, // Let the downbeat land before recovering.
    { at: 0.82, x: 0.3, y: 0.12 },
    { at: 1, x: 0.3, y: 0.12 },
  ] },
  { id: 'accent-flourish', mode: 'accent', steps: [
    ['double', 1, 0.8],
    ['accent', 1, 1],
    ['up', 0.75, 0.6],
    ['rest', 0.25, 1],
    ['settle', 1, 1],
  ], head: [
    { at: 0.12, x: 0.25, y: 0.18 },
    { at: 0.29, x: 0.35, y: 1 },
    { at: 0.39, x: 0.27, y: -1 }, // Accent at beat 1.5; a fast drop lands at 1.56.
    { at: 0.43, x: 0.27, y: -1 },
    { at: 0.72, x: -0.25, y: 0.08 },
    { at: 1, x: -0.25, y: 0.08 },
  ] },
  { id: 'soft-landing', mode: 'release', steps: [
    ['pick', 1, 0.5],
    ['settle', 0.5, 1],
    ['rest', 0.5, 1],
  ], head: [
    { at: 0.45, x: 0.08, y: -0.03 },
    { at: 0.7, x: 0.03, y: 0.02 },
    { at: 1, x: 0.03, y: 0.02 },
  ] },
  { id: 'held-landing', mode: 'release', steps: [
    ['up', 0.75, 0.4],
    ['settle', 0.75, 1],
    ['rest', 0.5, 1],
  ], head: [
    { at: 0.42, x: -0.05, y: 0 },
    { at: 1, x: -0.05, y: 0 },
  ] },
]
