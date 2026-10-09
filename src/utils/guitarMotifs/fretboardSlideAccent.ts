import type { GuitarMotifDefinition } from './types'

export const FRETBOARD_SLIDE_ACCENT_MOTIF_ID = 'fretboard-slide-accent'

export const FRETBOARD_SLIDE_ACCENT_MOTIF = {
  id: FRETBOARD_SLIDE_ACCENT_MOTIF_ID,
  label: 'FRETBOARD SLIDE ACCENT',
  homeProfile: 'drive',
  minimumProfile: 'drive',
  durationBeats: 4,
  // The large isolated motion exposed the model-space Y direction: this
  // Motif needs the mirrored neck axis while accepted baseline phrases keep
  // their existing +40° mapping unchanged.
  frettingAngleDegrees: -40,
  steps: [
    ['pick', 0.5, 0.58],
    ['double', 0.5, 0.72],
    ['double', 0.5, 0.78],
    ['double', 0.5, 0.84],
    ['accent', 0.75, 1.12],
    ['settle', 1.25, 1],
  ],
  tracks: {
    // Establish a left lean, let both hands run a short fast riff, answer it
    // with one rightward accent, then spend the final beat recovering.
    head: [
      { at: 0.05, x: -0.04, y: 0.06, vx: -0.2 },
      { at: 0.18, x: -0.16, y: 0.08 },
      { at: 0.34, x: -0.18, y: -0.06 },
      { at: 0.5, x: -0.14, y: 0.07 },
      { at: 0.62, x: 0.04, y: 0.15 },
      { at: 0.69, x: 0.16, y: -0.3 },
      { at: 0.8, x: 0.12, y: -0.05 },
      { at: 0.92, x: 0.04, y: 0.08 },
      { at: 1, x: -0.01, y: 0.05, vx: -0.18 },
    ],
    body: [
      { at: 0.04, x: -0.08, y: 0.08, vx: -0.5 },
      { at: 0.14, x: -0.46, y: 0.02 },
      { at: 0.22, x: -0.52, y: -0.12 },
      { at: 0.38, x: -0.5, y: 0.06 },
      { at: 0.52, x: -0.46, y: -0.1 },
      { at: 0.59, x: -0.18, y: 0.14 },
      { at: 0.65, x: 0.5, y: -0.48 },
      { at: 0.72, x: 0.39, y: -0.3 },
      { at: 0.82, x: 0.18, y: 0.02 },
      { at: 0.92, x: 0.06, y: 0.07 },
      { at: 1, x: -0.02, y: 0.08, vx: -0.5 },
    ],
    leftEar: [
      { at: 0.06, x: -0.03, y: 0.06, vx: -0.16 },
      { at: 0.2, x: -0.16, y: 0.17 },
      { at: 0.38, x: -0.1, y: -0.07 },
      { at: 0.54, x: -0.08, y: 0.1 },
      { at: 0.69, x: 0.2, y: 0.4 },
      { at: 0.78, x: -0.05, y: -0.12 },
      { at: 0.9, x: 0.02, y: 0.08 },
      { at: 1, x: -0.01, y: 0.06, vx: -0.16 },
    ],
    rightEar: [
      { at: 0.06, x: 0.03, y: 0.05, vx: 0.15 },
      { at: 0.2, x: 0.14, y: 0.15 },
      { at: 0.38, x: 0.09, y: -0.06 },
      { at: 0.54, x: 0.07, y: 0.09 },
      { at: 0.695, x: -0.18, y: 0.37 },
      { at: 0.785, x: 0.05, y: -0.11 },
      { at: 0.9, x: -0.02, y: 0.07 },
      { at: 1, x: 0.01, y: 0.05, vx: 0.15 },
    ],
    frettingHand: [
      { at: 0.04, x: -0.2, y: 0.08, vx: -0.5, vy: 0.04 },
      { at: 0.16, x: -0.34, y: 0.1 },
      { at: 0.22, x: 0.2, y: -0.08 },
      { at: 0.29, x: -0.28, y: -0.14 },
      { at: 0.36, x: 0.34, y: -0.08 },
      { at: 0.43, x: -0.16, y: -0.16 },
      { at: 0.5, x: 0.42, y: -0.1 },
      { at: 0.57, x: 0.14, y: -0.18 },
      { at: 0.61, x: 0.46, y: -0.3 },
      { at: 0.7, x: 0.34, y: -0.18 },
      { at: 0.8, x: 0.18, y: 0.04 },
      { at: 0.9, x: 0, y: 0.1 },
      { at: 1, x: -0.12, y: 0.08, vx: -0.5, vy: 0.04 },
    ],
  },
} as const satisfies GuitarMotifDefinition
