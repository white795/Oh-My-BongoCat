export interface HandPose { x: number, y: number }
export type GuitarMode = 'gentle' | 'groove' | 'accent' | 'release'
export type GuitarClip = 'pick' | 'down' | 'up' | 'double' | 'accent' | 'settle' | 'rest'
export type GuitarPerformanceProfile = 'autonomous' | 'engaged' | 'groove' | 'drive'
export type GuitarHeadAction = 'left-right-double-nod'

export const GUITAR_ESTABLISH_PHRASE_ID = 'steady-groove'
export const GUITAR_VARIATION_PHRASE_ID = 'steady-groove-variation'
export const GUITAR_FILL_PHRASE_ID = 'steady-groove-fill'
export const GUITAR_SOFT_CADENCE_PHRASE_ID = 'steady-groove-soft-cadence'

export type GuitarTemplatePhraseRole = 'establish' | 'repeat' | 'variation'
  | 'continuation' | 'soft-cadence' | 'accent-cadence'
export type GuitarTemplateEnding = 'continue' | 'soft-close' | 'accent-close'

export interface GuitarTemplateSlot {
  id: string
  role: GuitarTemplatePhraseRole
  candidates: readonly string[]
}

export interface GuitarPerformanceTemplate {
  id: string
  ending: GuitarTemplateEnding
  slots: readonly GuitarTemplateSlot[]
}

export const GUITAR_INPUT_BASELINE_TEMPLATE_ID = 'input-accent-close-baseline'
export const GUITAR_CONTINUE_TEMPLATE_ID = 'input-continue-baseline'
export const GUITAR_SOFT_CLOSE_TEMPLATE_ID = 'input-soft-close-baseline'
export const GUITAR_PERFORMANCE_TEMPLATES = {
  [GUITAR_INPUT_BASELINE_TEMPLATE_ID]: {
    id: GUITAR_INPUT_BASELINE_TEMPLATE_ID,
    ending: 'accent-close',
    slots: [
      { id: 'establish', role: 'establish', candidates: [GUITAR_ESTABLISH_PHRASE_ID] },
      { id: 'repeat', role: 'repeat', candidates: [GUITAR_ESTABLISH_PHRASE_ID] },
      { id: 'variation', role: 'variation', candidates: [GUITAR_VARIATION_PHRASE_ID] },
      { id: 'ending', role: 'accent-cadence', candidates: [GUITAR_FILL_PHRASE_ID] },
    ],
  },
  [GUITAR_CONTINUE_TEMPLATE_ID]: {
    id: GUITAR_CONTINUE_TEMPLATE_ID,
    ending: 'continue',
    slots: [
      { id: 'establish', role: 'establish', candidates: [GUITAR_ESTABLISH_PHRASE_ID] },
      { id: 'repeat', role: 'repeat', candidates: [GUITAR_ESTABLISH_PHRASE_ID] },
      { id: 'variation', role: 'variation', candidates: [GUITAR_VARIATION_PHRASE_ID] },
      { id: 'continuation', role: 'continuation', candidates: [GUITAR_ESTABLISH_PHRASE_ID] },
    ],
  },
  [GUITAR_SOFT_CLOSE_TEMPLATE_ID]: {
    id: GUITAR_SOFT_CLOSE_TEMPLATE_ID,
    ending: 'soft-close',
    slots: [
      { id: 'establish', role: 'establish', candidates: [GUITAR_ESTABLISH_PHRASE_ID] },
      { id: 'repeat', role: 'repeat', candidates: [GUITAR_ESTABLISH_PHRASE_ID] },
      { id: 'lead-in', role: 'repeat', candidates: [GUITAR_ESTABLISH_PHRASE_ID] },
      { id: 'ending', role: 'soft-cadence', candidates: [GUITAR_SOFT_CADENCE_PHRASE_ID] },
    ],
  },
} as const satisfies Record<string, GuitarPerformanceTemplate>

export type GuitarPerformanceTemplateId = keyof typeof GUITAR_PERFORMANCE_TEMPLATES
export const GUITAR_INPUT_PHRASE_SEQUENCE: readonly string[]
  = GUITAR_PERFORMANCE_TEMPLATES[GUITAR_INPUT_BASELINE_TEMPLATE_ID].slots
    .map(slot => slot.candidates[0])

export interface GuitarPerformanceIntent {
  profile: GuitarPerformanceProfile
  activity: number
  releasing: boolean
}

export interface GuitarKey extends HandPose {
  at: number
  vx?: number
  vy?: number
}

export interface GuitarHeadActionDefinition {
  parts: readonly (readonly GuitarKey[])[]
  cooldownPhrases: number
}

export interface GuitarPhrase {
  id: string
  mode: GuitarMode
  ensemble: GuitarEnsemble
  profiles?: readonly GuitarPerformanceProfile[]
  // [clip, beats, strength]; rhythm belongs to the phrase, not to random frame noise.
  steps: ReadonlyArray<readonly [GuitarClip, number, number]>
  // Normalized timeline across the WHOLE phrase; short hand clips cannot restart it.
  head: readonly GuitarKey[]
}

export type GuitarEnsemble = 'quiet-left' | 'quiet-right' | 'groove-left' | 'groove-right'
  | 'steady-groove' | 'steady-groove-variation' | 'steady-groove-fill' | 'steady-groove-soft-cadence'
  | 'accent-left' | 'accent-right' | 'release'

export interface GuitarEnsembleMotion {
  body: readonly GuitarKey[]
  frettingHand: readonly GuitarKey[]
  guitar: readonly GuitarKey[]
  leftEar: readonly GuitarKey[]
  rightEar: readonly GuitarKey[]
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

export const GUITAR_STRUM = {
  // The strings run down-right at roughly 40° in screen space. The primary
  // picking direction is therefore the perpendicular up-right/down-left axis.
  angleDegrees: -50,
} as const

export const GUITAR_FRETTING = {
  // Chord changes travel along the same down-right axis as the guitar neck.
  // The local Y axis remains available for the smaller press/release motion.
  angleDegrees: 40,
} as const

function rotatePose(pose: HandPose, angleDegrees: number): HandPose {
  const radians = angleDegrees * Math.PI / 180
  const cosine = Math.cos(radians)
  const sine = Math.sin(radians)

  return {
    x: pose.x * cosine - pose.y * sine,
    y: pose.x * sine + pose.y * cosine,
  }
}

export function mapGuitarStrumPose(pose: HandPose): HandPose {
  return rotatePose(pose, GUITAR_STRUM.angleDegrees)
}

export function mapGuitarFrettingPose(pose: HandPose, angleDegrees: number = GUITAR_FRETTING.angleDegrees): HandPose {
  return rotatePose(pose, angleDegrees)
}

// Head angles also deform the torso, but NOT the guitar/hands. Tune their alignment visually.
// Positive X deforms this model more strongly than negative X, hence unequal limits.
export const GUITAR_HEAD = {
  left: 28,
  right: 26,
  lift: 24,
  press: 28,
  minimumWeight: 0.35,
} as const

// Optional phrase-long gestures are selected only at phrase boundaries. They
// replace the phrase's local head track for one phrase while the body remains
// the shared movement base, so authored gestures never fight another head writer.
export const GUITAR_HEAD_ACTIONS: Record<GuitarHeadAction, GuitarHeadActionDefinition> = {
  'left-right-double-nod': {
    cooldownPhrases: 3,
    parts: [
      [
        { at: 0.18, x: -0.2, y: 0.08 },
        { at: 0.32, x: -0.52, y: 0.32 },
        { at: 0.43, x: -0.56, y: -0.38 },
        { at: 0.55, x: -0.53, y: 0.26 },
        { at: 0.66, x: -0.52, y: -0.32 },
        { at: 0.79, x: -0.4, y: 0.18 },
        { at: 0.9, x: -0.18, y: 0.1 },
        { at: 1, x: 0.04, y: 0.06, vx: 0.32 },
      ],
      [
        { at: 0.18, x: 0.22, y: 0.1 },
        { at: 0.31, x: 0.52, y: 0.32 },
        { at: 0.42, x: 0.56, y: -0.38 },
        { at: 0.54, x: 0.53, y: 0.26 },
        { at: 0.65, x: 0.52, y: -0.32 },
        { at: 0.78, x: 0.4, y: 0.18 },
        { at: 0.9, x: 0.2, y: 0.1 },
        { at: 1, x: 0.05, y: 0.04 },
      ],
    ],
  },
}

export const GUITAR_ENSEMBLE_SCALES = {
  body: { x: 32, y: 30 },
  frettingHand: { x: 32, y: 22 },
  guitar: { x: 14, y: 10 },
  leftEar: { x: 0.72, y: 0.58 },
  rightEar: { x: 0.72, y: 0.58 },
  minimumWeight: 0.45,
} as const

// Live2D exposes these parts as independent parameter pairs even though they
// form visual parent/child groups. Compose the missing hierarchy at runtime:
// the head rides the torso, and both hands ride the moving instrument.
export const GUITAR_KINEMATIC_COUPLING = {
  bodyToHead: { x: 0.45, y: 0.22 },
  guitarToStrummingHand: { x: 1, y: 1 },
  guitarToFrettingHand: { x: 1, y: 1 },
} as const

// Normalized authored poses. These are coupled hands/guitar channels, not individual fingers.
// vx/vy are tangents in normalized clip time; omitted tangents settle at the key.
export const GUITAR_CLIPS: Record<GuitarClip, readonly GuitarKey[]> = {
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

export const GUITAR_PERFORMANCE_PROFILES: Record<GuitarPerformanceProfile, {
  phraseModes: readonly GuitarMode[]
  establishPhraseId?: string
  performanceTemplateId?: GuitarPerformanceTemplateId
  bpm: readonly [number, number]
  energy: readonly [number, number]
  bodyGain: number
  headActionChance: number
}> = {
  // Autonomous keeps the existing authored arc: quiet passages, groove,
  // occasional accents and a release phrase all share one continuous timeline.
  autonomous: {
    phraseModes: ['gentle', 'groove', 'accent', 'release'],
    bpm: [78, 110],
    energy: [0.48, 1.08],
    bodyGain: 1,
    headActionChance: 0,
  },
  // Input profiles share one deterministic A A A' Fill sentence. Only tuning/body
  // gain differ; transient cues and blending come later.
  engaged: {
    phraseModes: ['groove'],
    establishPhraseId: GUITAR_ESTABLISH_PHRASE_ID,
    performanceTemplateId: GUITAR_INPUT_BASELINE_TEMPLATE_ID,
    bpm: [88, 98],
    energy: [0.62, 0.78],
    bodyGain: 1,
    headActionChance: 0,
  },
  groove: {
    phraseModes: ['groove'],
    establishPhraseId: GUITAR_ESTABLISH_PHRASE_ID,
    performanceTemplateId: GUITAR_INPUT_BASELINE_TEMPLATE_ID,
    bpm: [98, 112],
    energy: [0.82, 0.98],
    bodyGain: 1,
    headActionChance: 0,
  },
  drive: {
    phraseModes: ['groove'],
    establishPhraseId: GUITAR_ESTABLISH_PHRASE_ID,
    performanceTemplateId: GUITAR_INPUT_BASELINE_TEMPLATE_ID,
    bpm: [112, 126],
    energy: [1, 1.12],
    bodyGain: 1.28,
    headActionChance: 0,
  },
}

// The right hand keeps the beat through GUITAR_CLIPS. These phrase-long tracks
// add weight transfer, fretting changes and delayed instrument/ear reactions.
// Repeated keys are deliberate holds, not missing motion.
export const GUITAR_ENSEMBLE_MOTIONS: Record<GuitarEnsemble, GuitarEnsembleMotion> = {
  // The first deliberate performance sentence: one four-beat cause-and-response
  // timeline shared by every input profile. Chord preparation leads the stroke;
  // instrument, torso, head and ears answer in that order. The final poses and
  // tangents deliberately flow back into the opening preparation on the next A.
  'steady-groove': {
    body: [
      { at: 0.055, x: -0.08, y: 0.14, vx: -0.6 },
      { at: 0.16, x: -0.55, y: -0.5 },
      { at: 0.325, x: -0.2, y: 0.12 },
      { at: 0.55, x: 0.08, y: 0.08 },
      { at: 0.67, x: 0.22, y: 0.2 },
      { at: 0.755, x: 0.55, y: -0.52 },
      { at: 0.8875, x: 0.16, y: 0.12 },
      { at: 1, x: -0.04, y: 0.14, vx: -0.6 },
    ],
    frettingHand: [
      { at: 0.045, x: -0.25, y: 0.1, vx: -0.4, vy: 0.05 },
      { at: 0.275, x: -0.05, y: -0.18 },
      { at: 0.4125, x: 0.12, y: 0.1 },
      { at: 0.655, x: 0.28, y: -0.2 },
      { at: 0.8375, x: 0.1, y: 0.12 },
      { at: 1, x: -0.12, y: 0.08, vx: -0.4, vy: 0.05 },
    ],
    guitar: [
      { at: 0.07, x: 0.04, y: -0.03, vx: 0.35, vy: 0.05 },
      { at: 0.145, x: 0.25, y: 0.2 },
      { at: 0.3125, x: 0.1, y: -0.06 },
      { at: 0.44, x: 0.14, y: -0.08 },
      { at: 0.55, x: -0.03, y: 0 },
      { at: 0.675, x: -0.1, y: -0.1 },
      { at: 0.74, x: -0.28, y: 0.22 },
      { at: 0.875, x: -0.08, y: -0.04 },
      { at: 1, x: 0.02, y: -0.02, vx: 0.35, vy: 0.05 },
    ],
    leftEar: [
      { at: 0.08, x: -0.03, y: 0.08, vx: -0.18 },
      { at: 0.195, x: -0.26, y: 0.24 },
      { at: 0.36, x: -0.08, y: -0.1 },
      { at: 0.58, x: 0.02, y: 0.06 },
      { at: 0.7, x: 0.05, y: 0.1 },
      { at: 0.795, x: 0.28, y: 0.26 },
      { at: 0.91, x: 0.08, y: -0.08 },
      { at: 1, x: -0.02, y: 0.07, vx: -0.18 },
    ],
    rightEar: [
      { at: 0.085, x: 0.02, y: 0.06, vx: 0.16 },
      { at: 0.205, x: 0.22, y: 0.2 },
      { at: 0.37, x: 0.07, y: -0.08 },
      { at: 0.59, x: -0.02, y: 0.05 },
      { at: 0.705, x: -0.04, y: 0.08 },
      { at: 0.805, x: -0.24, y: 0.22 },
      { at: 0.92, x: -0.07, y: -0.06 },
      { at: 1, x: 0.02, y: 0.06, vx: 0.16 },
    ],
  },
  // A' preserves A's entrance and boundary, then replaces only its second half
  // with a prepared chord shift and a denser double stroke. The response still
  // travels from instrument to torso, head and ears instead of moving in unison.
  'steady-groove-variation': {
    body: [
      { at: 0.055, x: -0.08, y: 0.14, vx: -0.6 },
      { at: 0.16, x: -0.55, y: -0.5 },
      { at: 0.325, x: -0.2, y: 0.12 },
      { at: 0.535, x: 0.15, y: 0.2 },
      { at: 0.675, x: 0.62, y: -0.58 },
      { at: 0.79, x: 0.28, y: 0.22 },
      { at: 0.89, x: 0.12, y: 0.12 },
      { at: 1, x: -0.04, y: 0.14, vx: -0.6 },
    ],
    frettingHand: [
      { at: 0.045, x: -0.25, y: 0.1, vx: -0.4, vy: 0.05 },
      { at: 0.275, x: -0.05, y: -0.18 },
      { at: 0.4125, x: 0.12, y: 0.1 },
      { at: 0.515, x: 0.42, y: -0.26 },
      { at: 0.7, x: 0.18, y: 0.18 },
      { at: 0.81, x: -0.05, y: -0.12 },
      { at: 0.9, x: 0.08, y: 0.1 },
      { at: 1, x: -0.12, y: 0.08, vx: -0.4, vy: 0.05 },
    ],
    guitar: [
      { at: 0.07, x: 0.04, y: -0.03, vx: 0.35, vy: 0.05 },
      { at: 0.145, x: 0.25, y: 0.2 },
      { at: 0.3125, x: 0.1, y: -0.06 },
      { at: 0.44, x: 0.14, y: -0.08 },
      { at: 0.545, x: -0.12, y: -0.12 },
      { at: 0.65, x: -0.38, y: 0.28 },
      { at: 0.76, x: 0.24, y: -0.18 },
      { at: 0.84, x: -0.12, y: 0.14 },
      { at: 0.91, x: -0.05, y: -0.03 },
      { at: 1, x: 0.02, y: -0.02, vx: 0.35, vy: 0.05 },
    ],
    leftEar: [
      { at: 0.08, x: -0.03, y: 0.08, vx: -0.18 },
      { at: 0.195, x: -0.26, y: 0.24 },
      { at: 0.36, x: -0.08, y: -0.1 },
      { at: 0.575, x: 0.02, y: 0.06 },
      { at: 0.745, x: 0.34, y: 0.3 },
      { at: 0.82, x: -0.1, y: -0.1 },
      { at: 0.92, x: 0.06, y: -0.06 },
      { at: 1, x: -0.02, y: 0.07, vx: -0.18 },
    ],
    rightEar: [
      { at: 0.085, x: 0.02, y: 0.06, vx: 0.16 },
      { at: 0.205, x: 0.22, y: 0.2 },
      { at: 0.37, x: 0.07, y: -0.08 },
      { at: 0.58, x: -0.02, y: 0.05 },
      { at: 0.755, x: -0.3, y: 0.26 },
      { at: 0.83, x: 0.08, y: -0.08 },
      { at: 0.925, x: -0.05, y: -0.05 },
      { at: 1, x: 0.02, y: 0.06, vx: 0.16 },
    ],
  },
  // The fourth sentence closes the cycle instead of adding another variation:
  // one prepared accent transfers through the body, then every major channel
  // deliberately settles before a short pickup restores A's shared boundary.
  'steady-groove-fill': {
    body: [
      { at: 0.055, x: -0.08, y: 0.14, vx: -0.6 },
      { at: 0.14, x: -0.12, y: 0.22 },
      { at: 0.28, x: -0.22, y: 0.18 },
      { at: 0.49, x: -0.4, y: -0.72 },
      { at: 0.59, x: -0.18, y: 0.12 },
      { at: 0.65, x: -0.1, y: 0.08 },
      { at: 0.72, x: -0.1, y: 0.08 },
      { at: 0.84, x: 0.02, y: 0.14 },
      { at: 1, x: -0.04, y: 0.14, vx: -0.6 },
    ],
    frettingHand: [
      { at: 0.045, x: -0.25, y: 0.1, vx: -0.4, vy: 0.05 },
      { at: 0.18, x: -0.28, y: -0.12 },
      { at: 0.315, x: -0.38, y: 0.32 },
      { at: 0.5, x: -0.42, y: -0.24 },
      { at: 0.62, x: -0.18, y: 0.08 },
      { at: 0.69, x: -0.18, y: 0.08 },
      { at: 0.82, x: -0.14, y: 0.12 },
      { at: 1, x: -0.12, y: 0.08, vx: -0.4, vy: 0.05 },
    ],
    guitar: [
      { at: 0.07, x: 0.04, y: -0.03, vx: 0.35, vy: 0.05 },
      { at: 0.17, x: 0.08, y: 0.18 },
      { at: 0.33, x: -0.02, y: -0.16 },
      { at: 0.475, x: -0.14, y: 0.48 },
      { at: 0.58, x: -0.1, y: -0.1 },
      { at: 0.65, x: -0.04, y: 0 },
      { at: 0.71, x: -0.04, y: 0 },
      { at: 0.83, x: -0.04, y: -0.04 },
      { at: 1, x: 0.02, y: -0.02, vx: 0.35, vy: 0.05 },
    ],
    leftEar: [
      { at: 0.08, x: -0.03, y: 0.08, vx: -0.18 },
      { at: 0.19, x: 0.18, y: 0.16 },
      { at: 0.36, x: -0.22, y: 0.22 },
      { at: 0.54, x: 0.42, y: -0.35 },
      { at: 0.63, x: 0.12, y: 0.08 },
      { at: 0.68, x: 0.04, y: 0.04 },
      { at: 0.75, x: 0.02, y: 0.035 },
      { at: 0.85, x: -0.03, y: 0.08 },
      { at: 1, x: -0.02, y: 0.07, vx: -0.18 },
    ],
    rightEar: [
      { at: 0.085, x: 0.02, y: 0.06, vx: 0.16 },
      { at: 0.2, x: -0.15, y: 0.14 },
      { at: 0.37, x: 0.18, y: 0.18 },
      { at: 0.55, x: -0.38, y: -0.3 },
      { at: 0.64, x: -0.1, y: 0.07 },
      { at: 0.69, x: -0.03, y: 0.04 },
      { at: 0.76, x: -0.015, y: 0.035 },
      { at: 0.85, x: 0.03, y: 0.07 },
      { at: 1, x: 0.02, y: 0.06, vx: 0.16 },
    ],
  },
  // A quiet close shares A's boundaries but replaces the strong accent with a
  // decrescendo and a short breath. Secondary channels keep a small residual
  // motion so the pause reads as phrasing rather than a frozen frame.
  'steady-groove-soft-cadence': {
    body: [
      { at: 0.055, x: -0.08, y: 0.14, vx: -0.6 },
      { at: 0.18, x: -0.14, y: 0.06 },
      { at: 0.36, x: -0.1, y: 0.09 },
      { at: 0.54, x: -0.06, y: 0.07 },
      { at: 0.7, x: -0.03, y: 0.08 },
      { at: 0.82, x: 0, y: 0.09 },
      { at: 0.9, x: 0.02, y: 0.11 },
      { at: 1, x: -0.04, y: 0.14, vx: -0.6 },
    ],
    frettingHand: [
      { at: 0.045, x: -0.25, y: 0.1, vx: -0.4, vy: 0.05 },
      { at: 0.22, x: -0.18, y: 0.02 },
      { at: 0.42, x: -0.1, y: 0.04 },
      { at: 0.62, x: -0.06, y: 0.06 },
      { at: 0.78, x: -0.05, y: 0.07 },
      { at: 0.88, x: -0.07, y: 0.09 },
      { at: 1, x: -0.12, y: 0.08, vx: -0.4, vy: 0.05 },
    ],
    guitar: [
      { at: 0.07, x: 0.04, y: -0.03, vx: 0.35, vy: 0.05 },
      { at: 0.18, x: 0.09, y: 0.04 },
      { at: 0.38, x: 0.04, y: 0 },
      { at: 0.58, x: -0.02, y: 0.03 },
      { at: 0.74, x: -0.01, y: 0.01 },
      { at: 0.86, x: 0, y: -0.01 },
      { at: 1, x: 0.02, y: -0.02, vx: 0.35, vy: 0.05 },
    ],
    leftEar: [
      { at: 0.08, x: -0.03, y: 0.08, vx: -0.18 },
      { at: 0.2, x: -0.1, y: 0.13 },
      { at: 0.4, x: -0.04, y: 0.04 },
      { at: 0.6, x: 0.02, y: 0.09 },
      { at: 0.76, x: 0.01, y: 0.06 },
      { at: 0.88, x: 0, y: 0.07 },
      { at: 1, x: -0.02, y: 0.07, vx: -0.18 },
    ],
    rightEar: [
      { at: 0.085, x: 0.02, y: 0.06, vx: 0.16 },
      { at: 0.21, x: 0.09, y: 0.11 },
      { at: 0.41, x: 0.03, y: 0.03 },
      { at: 0.61, x: -0.02, y: 0.07 },
      { at: 0.77, x: -0.01, y: 0.05 },
      { at: 0.89, x: 0.01, y: 0.06 },
      { at: 1, x: 0.02, y: 0.06, vx: 0.16 },
    ],
  },
  'quiet-left': {
    body: [
      { at: 0.22, x: -0.12, y: 0.08 },
      { at: 0.52, x: -0.16, y: 0.04 },
      { at: 0.78, x: -0.14, y: 0.04 },
      { at: 1, x: -0.08, y: 0.06 },
    ],
    frettingHand: [
      { at: 0.3, x: -0.16, y: 0.08 },
      { at: 0.72, x: -0.12, y: 0.04 },
      { at: 1, x: -0.08, y: 0.05 },
    ],
    guitar: [
      { at: 0.24, x: 0.12, y: -0.05 },
      { at: 0.6, x: 0.08, y: 0.02 },
      { at: 1, x: 0.04, y: 0 },
    ],
    leftEar: [
      { at: 0.28, x: -0.1, y: 0.12 },
      { at: 0.72, x: -0.08, y: 0.08 },
      { at: 1, x: -0.04, y: 0.06 },
    ],
    rightEar: [
      { at: 0.28, x: 0.06, y: 0.08 },
      { at: 0.72, x: 0.05, y: 0.06 },
      { at: 1, x: 0.03, y: 0.04 },
    ],
  },
  'quiet-right': {
    body: [
      { at: 0.2, x: 0.1, y: 0.06 },
      { at: 0.48, x: 0.15, y: 0.03 },
      { at: 0.8, x: 0.15, y: 0.03 },
      { at: 1, x: 0.09, y: 0.05 },
    ],
    frettingHand: [
      { at: 0.26, x: 0.08, y: 0.05 },
      { at: 0.58, x: 0.18, y: -0.06 },
      { at: 0.82, x: 0.18, y: -0.06 },
      { at: 1, x: 0.1, y: 0.03 },
    ],
    guitar: [
      { at: 0.24, x: -0.1, y: -0.04 },
      { at: 0.62, x: -0.07, y: 0.02 },
      { at: 1, x: -0.03, y: 0 },
    ],
    leftEar: [
      { at: 0.3, x: -0.05, y: 0.07 },
      { at: 0.75, x: -0.04, y: 0.05 },
      { at: 1, x: -0.02, y: 0.03 },
    ],
    rightEar: [
      { at: 0.3, x: 0.1, y: 0.11 },
      { at: 0.75, x: 0.08, y: 0.08 },
      { at: 1, x: 0.04, y: 0.05 },
    ],
  },
  'groove-left': {
    body: [
      { at: 0.18, x: -0.18, y: 0.1 },
      { at: 0.42, x: -0.52, y: 0.38 },
      { at: 0.58, x: -0.36, y: -0.32 },
      { at: 0.82, x: 0.22, y: 0.14 },
      { at: 1, x: 0.18, y: 0.1 },
    ],
    frettingHand: [
      { at: 0.25, x: -0.25, y: 0.12 },
      { at: 0.5, x: -0.05, y: -0.18 },
      { at: 0.75, x: 0.18, y: 0.1 },
      { at: 1, x: 0.06, y: 0.04 },
    ],
    guitar: [
      { at: 0.2, x: 0.25, y: -0.05 },
      { at: 0.45, x: 0.55, y: -0.3 },
      { at: 0.6, x: 0.35, y: 0.28 },
      { at: 0.85, x: -0.18, y: -0.08 },
      { at: 1, x: -0.1, y: 0 },
    ],
    leftEar: [
      { at: 0.22, x: -0.18, y: 0.2 },
      { at: 0.46, x: -0.4, y: 0.34 },
      { at: 0.62, x: -0.18, y: -0.2 },
      { at: 1, x: 0.08, y: 0.05 },
    ],
    rightEar: [
      { at: 0.22, x: 0.12, y: 0.14 },
      { at: 0.46, x: 0.3, y: 0.26 },
      { at: 0.62, x: 0.14, y: -0.14 },
      { at: 1, x: -0.06, y: 0.04 },
    ],
  },
  'groove-right': {
    body: [
      { at: 0.16, x: 0.16, y: 0.08 },
      { at: 0.4, x: 0.48, y: 0.34 },
      { at: 0.57, x: 0.3, y: -0.3 },
      { at: 0.8, x: -0.24, y: 0.16 },
      { at: 1, x: -0.16, y: 0.08 },
    ],
    frettingHand: [
      { at: 0.22, x: 0.2, y: 0.1 },
      { at: 0.48, x: -0.12, y: -0.16 },
      { at: 0.72, x: -0.24, y: 0.12 },
      { at: 1, x: -0.05, y: 0.03 },
    ],
    guitar: [
      { at: 0.18, x: -0.2, y: -0.04 },
      { at: 0.43, x: -0.5, y: -0.28 },
      { at: 0.59, x: -0.3, y: 0.26 },
      { at: 0.83, x: 0.2, y: -0.06 },
      { at: 1, x: 0.1, y: 0 },
    ],
    leftEar: [
      { at: 0.2, x: -0.1, y: 0.12 },
      { at: 0.44, x: -0.28, y: 0.24 },
      { at: 0.61, x: -0.12, y: -0.15 },
      { at: 1, x: 0.05, y: 0.04 },
    ],
    rightEar: [
      { at: 0.2, x: 0.18, y: 0.18 },
      { at: 0.44, x: 0.4, y: 0.32 },
      { at: 0.61, x: 0.18, y: -0.2 },
      { at: 1, x: -0.08, y: 0.05 },
    ],
  },
  'accent-left': {
    body: [
      { at: 0.16, x: -0.15, y: 0.1 },
      { at: 0.38, x: -0.35, y: 0.6 },
      { at: 0.5, x: -0.48, y: -1 },
      { at: 0.58, x: -0.48, y: -1 },
      { at: 0.82, x: 0.22, y: 0.08 },
      { at: 1, x: 0.15, y: 0.05 },
    ],
    frettingHand: [
      { at: 0.25, x: -0.2, y: 0.1 },
      { at: 0.43, x: -0.35, y: 0.25 },
      { at: 0.55, x: 0.25, y: -0.25 },
      { at: 0.72, x: 0.1, y: 0.05 },
      { at: 1, x: 0.06, y: 0.03 },
    ],
    guitar: [
      { at: 0.2, x: 0.15, y: -0.1 },
      { at: 0.4, x: 0.35, y: -0.5 },
      { at: 0.51, x: 0.6, y: 0.9 },
      { at: 0.6, x: 0.5, y: 0.7 },
      { at: 0.85, x: -0.15, y: 0 },
      { at: 1, x: -0.08, y: 0 },
    ],
    leftEar: [
      { at: 0.22, x: -0.18, y: 0.2 },
      { at: 0.4, x: -0.5, y: 0.65 },
      { at: 0.52, x: 0.5, y: -0.55 },
      { at: 0.62, x: 0.5, y: -0.55 },
      { at: 1, x: -0.04, y: 0.05 },
    ],
    rightEar: [
      { at: 0.22, x: 0.14, y: 0.16 },
      { at: 0.4, x: 0.42, y: 0.55 },
      { at: 0.52, x: -0.42, y: -0.48 },
      { at: 0.62, x: -0.42, y: -0.48 },
      { at: 1, x: 0.03, y: 0.04 },
    ],
  },
  'accent-right': {
    body: [
      { at: 0.14, x: 0.14, y: 0.12 },
      { at: 0.34, x: 0.32, y: 0.58 },
      { at: 0.46, x: 0.44, y: -1 },
      { at: 0.54, x: 0.44, y: -1 },
      { at: 0.8, x: -0.2, y: 0.08 },
      { at: 1, x: -0.14, y: 0.04 },
    ],
    frettingHand: [
      { at: 0.2, x: 0.16, y: 0.08 },
      { at: 0.36, x: 0.32, y: 0.22 },
      { at: 0.49, x: -0.28, y: -0.22 },
      { at: 0.68, x: -0.1, y: 0.04 },
      { at: 1, x: -0.05, y: 0.02 },
    ],
    guitar: [
      { at: 0.18, x: -0.14, y: -0.08 },
      { at: 0.36, x: -0.32, y: -0.48 },
      { at: 0.47, x: -0.58, y: 0.88 },
      { at: 0.56, x: -0.48, y: 0.68 },
      { at: 0.83, x: 0.14, y: 0 },
      { at: 1, x: 0.07, y: 0 },
    ],
    leftEar: [
      { at: 0.2, x: -0.12, y: 0.15 },
      { at: 0.36, x: -0.4, y: 0.52 },
      { at: 0.48, x: 0.4, y: -0.46 },
      { at: 0.58, x: 0.4, y: -0.46 },
      { at: 1, x: -0.03, y: 0.04 },
    ],
    rightEar: [
      { at: 0.2, x: 0.18, y: 0.2 },
      { at: 0.36, x: 0.52, y: 0.64 },
      { at: 0.48, x: -0.5, y: -0.55 },
      { at: 0.58, x: -0.5, y: -0.55 },
      { at: 1, x: 0.04, y: 0.05 },
    ],
  },
  'release': {
    body: [
      { at: 0.3, x: 0.08, y: -0.04 },
      { at: 0.62, x: 0.03, y: 0.02 },
      { at: 1, x: 0.03, y: 0.02 },
    ],
    frettingHand: [
      { at: 0.28, x: -0.08, y: 0.04 },
      { at: 0.64, x: -0.03, y: 0.02 },
      { at: 1, x: -0.03, y: 0.02 },
    ],
    guitar: [
      { at: 0.32, x: 0.08, y: -0.04 },
      { at: 0.68, x: 0.02, y: 0 },
      { at: 1, x: 0.02, y: 0 },
    ],
    leftEar: [
      { at: 0.34, x: -0.06, y: 0.05 },
      { at: 0.7, x: -0.02, y: 0.02 },
      { at: 1, x: -0.02, y: 0.02 },
    ],
    rightEar: [
      { at: 0.34, x: 0.06, y: 0.05 },
      { at: 0.7, x: 0.02, y: 0.02 },
      { at: 1, x: 0.02, y: 0.02 },
    ],
  },
}

// Head motion has its own dynamics: gentle/release phrases settle and hold while
// the hands play; groove phrases mix small gestures with one livelier phrase.
// Accents drop in 0.4 beat, land 0.06 beat after the hand peak, hold briefly, then
// recover slowly. Repeated poses deliberately leave space instead of adding sway.
export const GUITAR_PHRASES: readonly GuitarPhrase[] = [
  {
    id: GUITAR_ESTABLISH_PHRASE_ID,
    mode: 'groove',
    ensemble: 'steady-groove',
    profiles: ['engaged', 'groove', 'drive'],
    steps: [
      ['down', 1, 1],
      ['up', 0.5, 0.72],
      ['pick', 0.5, 0.62],
      ['rest', 0.5, 1],
      ['down', 0.75, 0.92],
      ['up', 0.75, 0.68],
    ],
    head: [
      { at: 0.05, x: -0.05, y: 0.06, vx: -0.28 },
      { at: 0.18, x: -0.14, y: -0.16 },
      { at: 0.3375, x: -0.08, y: 0.07 },
      { at: 0.55, x: 0.02, y: 0.05 },
      { at: 0.67, x: 0.08, y: 0.12 },
      { at: 0.78, x: 0.14, y: -0.18 },
      { at: 0.895, x: 0.06, y: 0.06 },
      { at: 1, x: -0.02, y: 0.06, vx: -0.28 },
    ],
  },
  {
    id: GUITAR_VARIATION_PHRASE_ID,
    mode: 'groove',
    ensemble: 'steady-groove-variation',
    profiles: ['engaged', 'groove', 'drive'],
    steps: [
      ['down', 1, 1],
      ['up', 0.5, 0.72],
      ['pick', 0.5, 0.62],
      ['rest', 0.25, 1],
      ['double', 1, 0.86],
      ['up', 0.75, 0.68],
    ],
    head: [
      { at: 0.05, x: -0.05, y: 0.06, vx: -0.28 },
      { at: 0.18, x: -0.14, y: -0.16 },
      { at: 0.3375, x: -0.08, y: 0.07 },
      { at: 0.55, x: 0.02, y: 0.05 },
      { at: 0.68, x: 0.16, y: 0.16 },
      { at: 0.73, x: 0.18, y: -0.23 },
      { at: 0.84, x: 0.1, y: 0.08 },
      { at: 0.92, x: 0.04, y: 0.06 },
      { at: 1, x: -0.02, y: 0.06, vx: -0.28 },
    ],
  },
  {
    id: GUITAR_FILL_PHRASE_ID,
    mode: 'groove',
    ensemble: 'steady-groove-fill',
    profiles: ['engaged', 'groove', 'drive'],
    steps: [
      ['double', 1, 0.9],
      ['up', 0.5, 0.7],
      ['accent', 0.75, 0.96],
      ['rest', 0.25, 1],
      ['settle', 0.75, 1],
      ['up', 0.75, 0.68],
    ],
    head: [
      { at: 0.05, x: -0.05, y: 0.06, vx: -0.28 },
      { at: 0.16, x: 0.06, y: 0.1 },
      { at: 0.34, x: -0.08, y: 0.22 },
      { at: 0.515, x: -0.12, y: -0.42 },
      { at: 0.61, x: -0.08, y: 0.1 },
      { at: 0.66, x: -0.05, y: 0.05 },
      { at: 0.73, x: -0.05, y: 0.05 },
      { at: 0.84, x: 0.01, y: 0.08 },
      { at: 1, x: -0.02, y: 0.06, vx: -0.28 },
    ],
  },
  {
    id: GUITAR_SOFT_CADENCE_PHRASE_ID,
    mode: 'groove',
    ensemble: 'steady-groove-soft-cadence',
    profiles: ['engaged', 'groove', 'drive'],
    steps: [
      ['pick', 0.75, 0.58],
      ['up', 0.5, 0.46],
      ['pick', 0.5, 0.34],
      ['settle', 0.75, 1],
      ['rest', 0.75, 1],
      ['up', 0.75, 0.68],
    ],
    head: [
      { at: 0.05, x: -0.05, y: 0.06, vx: -0.28 },
      { at: 0.18, x: -0.08, y: -0.04 },
      { at: 0.38, x: -0.04, y: 0.03 },
      { at: 0.58, x: 0.03, y: 0.05 },
      { at: 0.74, x: 0.04, y: 0.04 },
      { at: 0.88, x: 0.01, y: 0.06 },
      { at: 1, x: -0.02, y: 0.06, vx: -0.28 },
    ],
  },
  { id: 'soft-picks', mode: 'gentle', ensemble: 'quiet-left', steps: [
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
  { id: 'offbeat-picks', mode: 'gentle', ensemble: 'quiet-right', steps: [
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
  { id: 'call-response', mode: 'gentle', ensemble: 'quiet-left', steps: [
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
  { id: 'open-strum', mode: 'groove', ensemble: 'groove-left', steps: [
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
  { id: 'rolling-strum', mode: 'groove', ensemble: 'groove-right', steps: [
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
    { at: 0.86, x: 0.48, y: 0.28 },
    { at: 1, x: 0.16, y: 0.08 },
  ] },
  { id: 'syncopated-strum', mode: 'groove', ensemble: 'groove-left', steps: [
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
  { id: 'accent-answer', mode: 'accent', ensemble: 'accent-left', steps: [
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
  { id: 'accent-flourish', mode: 'accent', ensemble: 'accent-right', steps: [
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
  { id: 'soft-landing', mode: 'release', ensemble: 'release', steps: [
    ['pick', 1, 0.5],
    ['settle', 0.5, 1],
    ['rest', 0.5, 1],
  ], head: [
    { at: 0.45, x: 0.08, y: -0.03 },
    { at: 0.7, x: 0.03, y: 0.02 },
    { at: 1, x: 0.03, y: 0.02 },
  ] },
  { id: 'held-landing', mode: 'release', ensemble: 'release', steps: [
    ['up', 0.75, 0.4],
    ['settle', 0.75, 1],
    ['rest', 0.5, 1],
  ], head: [
    { at: 0.42, x: -0.05, y: 0 },
    { at: 1, x: -0.05, y: 0 },
  ] },
]
