import type { GuitarMotifDefinition } from './types'

export const SINGLE_PICK_ACK_MOTIF_ID = 'single-pick-ack'

export const SINGLE_PICK_ACK_MOTIF = {
  id: SINGLE_PICK_ACK_MOTIF_ID,
  label: 'SINGLE PICK ACK',
  homeProfile: 'engaged',
  minimumProfile: 'engaged',
  durationBeats: 4,
  steps: [
    ['pick', 1, 0.4],
    ['pick', 1, 0.66],
    ['pick', 1, 0.44],
    ['pick', 1, 0.36],
  ],
  tracks: {
    // The right hand never stops carrying the quiet pulse. Only beat two gains
    // a visible ear acknowledgement; the small nod deliberately follows later.
    head: [
      { at: 0.05, x: -0.05, y: 0.06, vx: -0.28 },
      { at: 0.18, x: -0.08, y: -0.08 },
      { at: 0.32, x: -0.04, y: 0.07 },
      { at: 0.48, x: 0, y: 0.05 },
      { at: 0.62, x: 0.04, y: -0.16 },
      { at: 0.76, x: 0.08, y: 0.08 },
      { at: 0.88, x: 0.03, y: 0.07 },
      { at: 1, x: -0.02, y: 0.06, vx: -0.28 },
    ],
    body: [
      { at: 0.055, x: -0.08, y: 0.14, vx: -0.6 },
      { at: 0.18, x: -0.18, y: -0.12 },
      { at: 0.34, x: -0.1, y: 0.11 },
      { at: 0.5, x: 0, y: 0.08 },
      { at: 0.65, x: 0.12, y: -0.1 },
      { at: 0.82, x: 0.06, y: 0.1 },
      { at: 1, x: -0.04, y: 0.14, vx: -0.6 },
    ],
    leftEar: [
      { at: 0.06, x: -0.03, y: 0.08, vx: -0.18 },
      { at: 0.18, x: -0.1, y: 0.14 },
      { at: 0.34, x: -0.16, y: 0.52 },
      { at: 0.46, x: -0.08, y: -0.12 },
      { at: 0.62, x: 0.03, y: 0.12 },
      { at: 0.78, x: 0.05, y: -0.05 },
      { at: 0.9, x: 0.01, y: 0.06 },
      { at: 1, x: -0.02, y: 0.07, vx: -0.18 },
    ],
    rightEar: [
      { at: 0.06, x: 0.02, y: 0.06, vx: 0.16 },
      { at: 0.2, x: 0.08, y: 0.1 },
      { at: 0.36, x: 0.1, y: 0.14 },
      { at: 0.5, x: 0.04, y: -0.06 },
      { at: 0.66, x: -0.04, y: 0.08 },
      { at: 0.82, x: -0.03, y: 0.02 },
      { at: 1, x: 0.02, y: 0.06, vx: 0.16 },
    ],
    frettingHand: [
      { at: 0.045, x: -0.25, y: 0.1, vx: -0.4, vy: 0.05 },
      { at: 0.18, x: -0.2, y: -0.08 },
      { at: 0.36, x: -0.16, y: 0.06 },
      { at: 0.54, x: -0.12, y: -0.08 },
      { at: 0.72, x: -0.09, y: 0.08 },
      { at: 0.86, x: -0.08, y: 0.05 },
      { at: 1, x: -0.12, y: 0.08, vx: -0.4, vy: 0.05 },
    ],
  },
} as const satisfies GuitarMotifDefinition
