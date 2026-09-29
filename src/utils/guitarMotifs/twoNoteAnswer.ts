import type { GuitarMotifDefinition } from './types'

export const TWO_NOTE_ANSWER_MOTIF_ID = 'two-note-answer'

export const TWO_NOTE_ANSWER_MOTIF = {
  id: TWO_NOTE_ANSWER_MOTIF_ID,
  label: 'TWO NOTE ANSWER',
  homeProfile: 'engaged',
  minimumProfile: 'autonomous',
  durationBeats: 4,
  steps: [
    ['pick', 0.5, 0.58],
    ['rest', 0.75, 1],
    ['pick', 0.5, 0.8],
    ['rest', 0.75, 1],
    ['settle', 1.5, 1],
  ],
  tracks: {
    // Both answers use one fret position: press, release, then press deeper.
    // The head acknowledges the stronger second note only after it resolves.
    head: [
      { at: 0.05, x: -0.02, y: 0.05, vx: -0.2 },
      { at: 0.2, x: -0.04, y: 0.02 },
      { at: 0.36, x: 0, y: -0.04 },
      { at: 0.48, x: 0.04, y: 0.06 },
      { at: 0.58, x: 0.1, y: 0.34 },
      { at: 0.72, x: 0.08, y: 0.22 },
      { at: 0.86, x: 0.02, y: 0.1 },
      { at: 1, x: -0.02, y: 0.05, vx: -0.2 },
    ],
    body: [
      { at: 0.05, x: -0.06, y: 0.08, vx: -0.4 },
      { at: 0.12, x: -0.1, y: -0.1 },
      { at: 0.25, x: -0.06, y: 0.08 },
      { at: 0.34, x: 0.02, y: 0.05 },
      { at: 0.42, x: 0.1, y: -0.16 },
      { at: 0.56, x: 0.08, y: 0.14 },
      { at: 0.72, x: 0.04, y: 0.1 },
      { at: 0.86, x: 0, y: 0.08 },
      { at: 1, x: -0.04, y: 0.08, vx: -0.4 },
    ],
    leftEar: [
      { at: 0.06, x: -0.02, y: 0.06, vx: -0.1 },
      { at: 0.14, x: -0.08, y: 0.12 },
      { at: 0.26, x: -0.03, y: 0.04 },
      { at: 0.4, x: 0.04, y: 0.08 },
      { at: 0.56, x: 0.12, y: 0.26 },
      { at: 0.7, x: 0.06, y: 0.12 },
      { at: 0.86, x: 0.01, y: 0.07 },
      { at: 1, x: -0.01, y: 0.06, vx: -0.1 },
    ],
    rightEar: [
      { at: 0.06, x: 0.02, y: 0.05, vx: 0.09 },
      { at: 0.14, x: 0.07, y: 0.1 },
      { at: 0.26, x: 0.03, y: 0.03 },
      { at: 0.4, x: -0.03, y: 0.07 },
      { at: 0.56, x: -0.1, y: 0.22 },
      { at: 0.7, x: -0.05, y: 0.1 },
      { at: 0.86, x: -0.01, y: 0.06 },
      { at: 1, x: 0.01, y: 0.05, vx: 0.09 },
    ],
    frettingHand: [
      { at: 0.03, x: -0.14, y: 0.08 },
      { at: 0.07, x: -0.14, y: -0.2 },
      { at: 0.12, x: -0.14, y: -0.2 },
      { at: 0.2, x: -0.14, y: 0.1 },
      { at: 0.29, x: -0.14, y: 0.08 },
      { at: 0.34, x: -0.14, y: -0.34 },
      { at: 0.43, x: -0.14, y: -0.34 },
      { at: 0.52, x: -0.14, y: 0.12 },
      { at: 0.7, x: -0.14, y: 0.08 },
      { at: 0.86, x: -0.14, y: 0.08 },
      { at: 1, x: -0.14, y: 0.08 },
    ],
  },
} as const satisfies GuitarMotifDefinition
