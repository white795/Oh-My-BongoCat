import type { GuitarMotifDefinition } from './types'

export const LAZY_ARPEGGIO_MOTIF_ID = 'lazy-arpeggio'

export const LAZY_ARPEGGIO_MOTIF = {
  id: LAZY_ARPEGGIO_MOTIF_ID,
  label: 'LAZY ARPEGGIO',
  homeProfile: 'autonomous',
  minimumProfile: 'autonomous',
  durationBeats: 4,
  steps: [
    ['pick', 0.5, 0.34],
    ['rest', 0.5, 1],
    ['pick', 0.5, 0.42],
    ['rest', 0.5, 1],
    ['pick', 0.5, 0.38],
    ['rest', 0.5, 1],
    ['pick', 0.5, 0.46],
    ['rest', 0.5, 1],
  ],
  tracks: {
    // Four small notes each get half a beat to ring. The cat sinks into one
    // relaxed side while watching the strings, then releases through the last
    // two notes without turning the phrase into another left-right sway.
    head: [
      { at: 0.05, x: 0.01, y: 0.04 },
      { at: 0.18, x: 0.03, y: -0.08 },
      { at: 0.32, x: 0.06, y: -0.24 },
      { at: 0.46, x: 0.08, y: -0.44 },
      { at: 0.58, x: 0.09, y: -0.54 },
      { at: 0.7, x: 0.08, y: -0.46 },
      { at: 0.8, x: 0.06, y: -0.31 },
      { at: 0.9, x: 0.03, y: -0.135 },
      { at: 0.965, x: 0.015, y: -0.02 },
      { at: 1, x: 0.01, y: 0.04, vy: -0.2 },
    ],
    body: [
      { at: 0.05, x: 0.02, y: 0.06 },
      { at: 0.2, x: 0.12, y: 0.02 },
      { at: 0.38, x: 0.28, y: -0.08 },
      { at: 0.56, x: 0.36, y: -0.16 },
      { at: 0.7, x: 0.32, y: -0.12 },
      { at: 0.84, x: 0.16, y: 0 },
      { at: 0.94, x: 0.06, y: 0.04 },
      { at: 1, x: 0.03, y: 0.06, vx: 0.12 },
    ],
    leftEar: [
      { at: 0.05, x: -0.01, y: 0.04 },
      { at: 0.22, x: -0.03, y: 0.09 },
      { at: 0.42, x: -0.04, y: 0.16 },
      { at: 0.62, x: -0.03, y: 0.18 },
      { at: 0.8, x: -0.02, y: 0.1 },
      { at: 1, x: -0.01, y: 0.04, vy: -0.06 },
    ],
    rightEar: [
      { at: 0.05, x: 0.01, y: 0.04 },
      { at: 0.22, x: 0.02, y: 0.08 },
      { at: 0.42, x: 0.03, y: 0.13 },
      { at: 0.62, x: 0.03, y: 0.15 },
      { at: 0.8, x: 0.02, y: 0.09 },
      { at: 1, x: 0.01, y: 0.04, vy: -0.05 },
    ],
    frettingHand: [
      { at: 0.05, x: -0.12, y: -0.14 },
      { at: 0.16, x: -0.12, y: -0.14 },
      { at: 0.27, x: -0.12, y: -0.1 },
      { at: 0.36, x: -0.12, y: -0.15 },
      { at: 0.47, x: -0.12, y: -0.11 },
      { at: 0.56, x: -0.12, y: -0.16 },
      { at: 0.67, x: -0.12, y: -0.11 },
      { at: 0.76, x: -0.12, y: -0.15 },
      { at: 0.87, x: -0.12, y: -0.1 },
      { at: 1, x: -0.12, y: -0.13, vy: -0.12 },
    ],
  },
} as const satisfies GuitarMotifDefinition
