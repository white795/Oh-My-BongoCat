import type { GuitarMotifDefinition } from './types'

export const SUSTAIN_SWAY_MOTIF_ID = 'sustain-sway'

export const SUSTAIN_SWAY_MOTIF = {
  id: SUSTAIN_SWAY_MOTIF_ID,
  label: 'SUSTAIN SWAY',
  homeProfile: 'autonomous',
  minimumProfile: 'autonomous',
  durationBeats: 4,
  steps: [
    ['down', 1, 0.76],
    ['rest', 2, 1],
    ['settle', 1, 1],
  ],
  tracks: {
    // One downstroke opens a long note. The body then carries the motion in
    // one unbroken weight transfer while the hands stop inventing new beats.
    head: [
      { at: 0.05, x: -0.02, y: 0.04 },
      { at: 0.18, x: -0.09, y: -0.16 },
      { at: 0.38, x: -0.11, y: -0.14 },
      { at: 0.6, x: -0.03, y: -0.02 },
      { at: 0.78, x: 0.09, y: 0.15 },
      { at: 0.9, x: 0.05, y: 0.08 },
      { at: 1, x: -0.01, y: 0.04, vx: -0.28, vy: -0.16 },
    ],
    body: [
      { at: 0.05, x: -0.04, y: 0.08 },
      { at: 0.18, x: -0.24, y: -0.12 },
      { at: 0.38, x: -0.3, y: 0.04 },
      { at: 0.6, x: 0, y: 0.12 },
      { at: 0.82, x: 0.28, y: 0.05 },
      { at: 0.94, x: 0.08, y: 0.08 },
      { at: 1, x: -0.02, y: 0.08, vx: -0.42 },
    ],
    leftEar: [
      { at: 0.05, x: -0.02, y: 0.05 },
      { at: 0.2, x: -0.08, y: 0.12 },
      { at: 0.4, x: -0.1, y: 0.16 },
      { at: 0.62, x: 0.01, y: 0.1 },
      { at: 0.82, x: 0.1, y: 0.04 },
      { at: 1, x: -0.01, y: 0.05, vx: -0.26 },
    ],
    rightEar: [
      { at: 0.05, x: 0.02, y: 0.04 },
      { at: 0.2, x: 0.06, y: 0.09 },
      { at: 0.4, x: 0.08, y: 0.13 },
      { at: 0.62, x: -0.01, y: 0.08 },
      { at: 0.82, x: -0.08, y: 0.03 },
      { at: 1, x: 0.01, y: 0.04, vx: 0.22 },
    ],
    frettingHand: [
      { at: 0.04, x: -0.14, y: 0.08 },
      { at: 0.12, x: -0.14, y: -0.2 },
      { at: 0.3, x: -0.14, y: -0.2 },
      { at: 0.5, x: -0.14, y: -0.2 },
      { at: 0.7, x: -0.14, y: -0.2 },
      { at: 0.82, x: -0.14, y: 0.04 },
      { at: 0.94, x: -0.14, y: 0.08 },
      { at: 1, x: -0.14, y: 0.08 },
    ],
  },
} as const satisfies GuitarMotifDefinition
