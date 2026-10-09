import type { GuitarMotifDefinition } from './types'

export const TUNING_LISTEN_MOTIF_ID = 'tuning-listen'

export const TUNING_LISTEN_MOTIF = {
  id: TUNING_LISTEN_MOTIF_ID,
  label: 'TUNING LISTEN',
  homeProfile: 'autonomous',
  minimumProfile: 'autonomous',
  durationBeats: 4,
  frettingAngleDegrees: -40,
  steps: [
    ['pick', 0.75, 0.38],
    ['rest', 1.25, 1],
    ['pick', 0.75, 0.52],
    ['settle', 1.25, 1],
  ],
  tracks: {
    // A short reference note resolves into an asymmetric listening silhouette.
    // The torso becomes quiet while the head and one ear hold attention on the
    // neck; the second note only confirms the fretting-hand adjustment.
    head: [
      { at: 0.04, x: -0.02, y: 0.04 },
      { at: 0.14, x: -0.08, y: 0.1 },
      { at: 0.24, x: -0.38, y: -0.08 },
      { at: 0.32, x: -0.62, y: -0.2 },
      { at: 0.43, x: -0.64, y: -0.21 },
      { at: 0.54, x: -0.61, y: -0.18 },
      { at: 0.64, x: -0.58, y: -0.14 },
      { at: 0.74, x: -0.46, y: 0.02 },
      { at: 0.86, x: -0.22, y: 0.08 },
      { at: 0.94, x: -0.08, y: 0.06 },
      { at: 1, x: -0.01, y: 0.04, vx: -0.24, vy: 0.03 },
    ],
    body: [
      { at: 0.04, x: -0.02, y: 0.06 },
      { at: 0.15, x: -0.06, y: -0.02 },
      { at: 0.3, x: -0.1, y: 0.04 },
      { at: 0.45, x: -0.11, y: 0.05 },
      { at: 0.58, x: -0.09, y: 0.04 },
      { at: 0.72, x: -0.06, y: 0.02 },
      { at: 0.86, x: -0.03, y: 0.04 },
      { at: 1, x: -0.01, y: 0.06, vx: -0.1 },
    ],
    leftEar: [
      { at: 0.05, x: -0.01, y: 0.04 },
      { at: 0.18, x: -0.03, y: 0.1 },
      { at: 0.3, x: -0.1, y: 0.55 },
      { at: 0.38, x: -0.12, y: 0.82 },
      { at: 0.5, x: -0.11, y: 0.78 },
      { at: 0.62, x: -0.08, y: 0.62 },
      { at: 0.74, x: -0.04, y: 0.34 },
      { at: 0.86, x: -0.02, y: 0.14 },
      { at: 1, x: -0.01, y: 0.04, vy: -0.18 },
    ],
    rightEar: [
      { at: 0.05, x: 0.01, y: 0.04 },
      { at: 0.18, x: 0.02, y: 0.07 },
      { at: 0.3, x: 0.03, y: 0.14 },
      { at: 0.4, x: 0.03, y: 0.2 },
      { at: 0.52, x: 0.03, y: 0.18 },
      { at: 0.64, x: 0.02, y: 0.13 },
      { at: 0.76, x: 0.02, y: 0.08 },
      { at: 0.88, x: 0.01, y: 0.05 },
      { at: 1, x: 0.01, y: 0.04, vy: -0.06 },
    ],
    frettingHand: [
      { at: 0.04, x: -0.24, y: -0.16 },
      { at: 0.16, x: -0.24, y: -0.16 },
      { at: 0.26, x: -0.2, y: 0.1 },
      { at: 0.36, x: 0.08, y: 0.13 },
      { at: 0.44, x: 0.1, y: -0.24 },
      { at: 0.58, x: 0.1, y: -0.24 },
      { at: 0.68, x: 0.08, y: -0.16 },
      { at: 0.78, x: -0.02, y: 0.04 },
      { at: 0.9, x: -0.16, y: 0.04 },
      { at: 1, x: -0.22, y: -0.13, vx: -0.36, vy: -0.2 },
    ],
  },
} as const satisfies GuitarMotifDefinition
