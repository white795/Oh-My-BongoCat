import type { GuitarMotifDefinition } from './types'

export const SYNCOPATED_CHORD_WALK_MOTIF_ID = 'syncopated-chord-walk'

export const SYNCOPATED_CHORD_WALK_MOTIF = {
  id: SYNCOPATED_CHORD_WALK_MOTIF_ID,
  label: 'SYNCOPATED CHORD WALK',
  homeProfile: 'groove',
  minimumProfile: 'groove',
  durationBeats: 4,
  frettingAngleDegrees: -40,
  steps: [
    ['down', 0.5, 0.74],
    ['up', 0.5, 0.64],
    ['rest', 0.5, 1],
    ['down', 0.5, 0.76],
    ['rest', 0.5, 1],
    ['double', 1, 0.82],
    ['settle', 0.5, 1],
  ],
  tracks: {
    // The fretting hand is the protagonist. Head and torso only follow the
    // three held chord steps; they do not add another nod or accent gesture.
    head: [
      { at: 0.06, x: -0.06, y: 0.05, vx: -0.35 },
      { at: 0.2, x: -0.1, y: -0.1 },
      { at: 0.36, x: -0.04, y: -0.32 },
      { at: 0.52, x: 0.04, y: -0.58 },
      { at: 0.68, x: 0.1, y: -0.62 },
      { at: 0.8, x: 0.1, y: -0.37 },
      { at: 0.9, x: 0.05, y: -0.16 },
      { at: 1, x: -0.02, y: 0.05, vx: -0.35 },
    ],
    body: [
      { at: 0.05, x: -0.16, y: 0.08, vx: -1.5, vy: 0.1 },
      { at: 0.12, x: -0.3, y: -0.08 },
      { at: 0.22, x: -0.3, y: -0.08 },
      { at: 0.33, x: -0.1, y: 0.06 },
      { at: 0.42, x: 0, y: -0.06 },
      { at: 0.5, x: 0, y: -0.06 },
      { at: 0.6, x: 0.15, y: 0.05 },
      { at: 0.69, x: 0.3, y: -0.08 },
      { at: 0.84, x: 0.3, y: -0.08 },
      { at: 0.91, x: 0.18, y: 0.05 },
      { at: 1, x: -0.08, y: 0.07, vx: -1.5, vy: 0.1 },
    ],
    leftEar: [
      { at: 0.07, x: -0.02, y: 0.06, vx: -0.1 },
      { at: 0.18, x: -0.08, y: 0.12 },
      { at: 0.25, x: -0.05, y: 0.04 },
      { at: 0.4, x: 0.01, y: 0.08 },
      { at: 0.5, x: 0.03, y: 0.04 },
      { at: 0.67, x: 0.08, y: 0.12 },
      { at: 0.82, x: 0.08, y: 0.12 },
      { at: 0.91, x: 0.02, y: 0.05 },
      { at: 1, x: -0.01, y: 0.06, vx: -0.1 },
    ],
    rightEar: [
      { at: 0.075, x: 0.02, y: 0.05, vx: 0.09 },
      { at: 0.185, x: 0.07, y: 0.1 },
      { at: 0.255, x: 0.04, y: 0.03 },
      { at: 0.405, x: -0.01, y: 0.07 },
      { at: 0.505, x: -0.02, y: 0.03 },
      { at: 0.675, x: -0.07, y: 0.1 },
      { at: 0.825, x: -0.07, y: 0.1 },
      { at: 0.915, x: -0.02, y: 0.04 },
      { at: 1, x: 0.01, y: 0.05, vx: 0.09 },
    ],
    // Repeated poses deliberately hold each chord. The two positive-Y keys
    // lift the hand during the silent offbeats before the next chord lands.
    frettingHand: [
      { at: 0.04, x: -0.46, y: -0.14 },
      { at: 0.2, x: -0.46, y: -0.14 },
      { at: 0.28, x: -0.4, y: 0.07 },
      { at: 0.36, x: 0, y: -0.15 },
      { at: 0.49, x: 0, y: -0.15 },
      { at: 0.55, x: 0.05, y: 0.07 },
      { at: 0.62, x: 0.46, y: -0.18 },
      { at: 0.84, x: 0.46, y: -0.18 },
      { at: 0.89, x: 0.3, y: 0.06 },
      { at: 0.95, x: -0.1, y: 0.02 },
      { at: 1, x: -0.34, y: -0.06, vx: -2.4, vy: -1 },
    ],
  },
} as const satisfies GuitarMotifDefinition
