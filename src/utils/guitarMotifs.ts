import type { GuitarKey, GuitarPhrase } from './guitarPerformance'

import { GUITAR_ESTABLISH_PHRASE_ID, GUITAR_VARIATION_PHRASE_ID } from './guitarPerformance'

export const IMMERSED_DOUBLE_NOD_MOTIF_ID = 'immersed-double-nod'
export const GUITAR_MOTIF_PREVIEW_PHRASE_ID = 'motif-preview'

export type GuitarMotifTrackName = 'head' | 'body' | 'leftEar' | 'rightEar' | 'frettingHand'

export interface GuitarMotifDefinition {
  id: string
  durationBeats: number
  steps: GuitarPhrase['steps']
  tracks: Record<GuitarMotifTrackName, readonly GuitarKey[]>
}

export const GUITAR_MOTIF_PREVIEW = {
  leadInBeats: 0,
  loopBeats: 4,
} as const

export type GuitarMotifPreviewSlot
  = | { kind: 'phrase', phraseId: string }
    | { kind: 'motif' }

// Development-only score: establish a predictable groove before inserting
// the Motif, then loop back to A so both boundaries can be reviewed together.
export const GUITAR_MOTIF_PREVIEW_SEQUENCE = [
  { kind: 'phrase', phraseId: GUITAR_ESTABLISH_PHRASE_ID },
  { kind: 'phrase', phraseId: GUITAR_ESTABLISH_PHRASE_ID },
  { kind: 'phrase', phraseId: GUITAR_VARIATION_PHRASE_ID },
  { kind: 'motif' },
] as const satisfies readonly GuitarMotifPreviewSlot[]

export const GUITAR_MOTIFS = {
  [IMMERSED_DOUBLE_NOD_MOTIF_ID]: {
    id: IMMERSED_DOUBLE_NOD_MOTIF_ID,
    durationBeats: 4,
    steps: [
      ['down', 1, 0.72],
      ['up', 1, 0.68],
      ['accent', 1, 1],
      ['up', 1, 0.72],
    ],
    tracks: {
      head: [
        { at: 0.045, x: 0.01, y: 0.26 },
        { at: 0.12, x: 0, y: -0.76 },
        { at: 0.205, x: -0.01, y: 0.18 },
        { at: 0.295, x: 0.01, y: 0.25 },
        { at: 0.37, x: 0, y: -0.74 },
        { at: 0.46, x: -0.01, y: 0.17 },
        { at: 0.55, x: 0.01, y: 0.34 },
        { at: 0.625, x: 0, y: -0.92 },
        { at: 0.715, x: -0.01, y: 0.22 },
        { at: 0.8, x: 0.01, y: 0.25 },
        { at: 0.88, x: 0, y: -0.78 },
        { at: 1, x: 0, y: 0, vy: 4.2 },
      ],
      body: [
        { at: 0.06, x: 0.01, y: 0.08 },
        { at: 0.135, x: 0, y: -0.31 },
        { at: 0.225, x: -0.01, y: 0.06 },
        { at: 0.31, x: 0.01, y: 0.08 },
        { at: 0.385, x: 0, y: -0.3 },
        { at: 0.475, x: -0.01, y: 0.05 },
        { at: 0.565, x: 0.01, y: 0.12 },
        { at: 0.64, x: 0, y: -0.4 },
        { at: 0.73, x: -0.01, y: 0.08 },
        { at: 0.815, x: 0.01, y: 0.08 },
        { at: 0.895, x: 0, y: -0.32 },
        { at: 1, x: 0, y: 0, vy: 1.9 },
      ],
      leftEar: [
        { at: 0.07, x: -0.01, y: -0.12 },
        { at: 0.155, x: -0.02, y: 0.42 },
        { at: 0.23, x: 0.01, y: -0.14 },
        { at: 0.32, x: -0.01, y: -0.11 },
        { at: 0.405, x: -0.02, y: 0.4 },
        { at: 0.48, x: 0.01, y: -0.13 },
        { at: 0.58, x: -0.01, y: -0.14 },
        { at: 0.66, x: -0.02, y: 0.56 },
        { at: 0.74, x: 0.01, y: -0.16 },
        { at: 0.83, x: -0.01, y: -0.11 },
        { at: 0.915, x: -0.02, y: 0.43 },
        { at: 1, x: 0, y: 0, vy: -2 },
      ],
      rightEar: [
        { at: 0.07, x: 0.01, y: -0.1 },
        { at: 0.16, x: 0.02, y: 0.39 },
        { at: 0.235, x: -0.01, y: -0.13 },
        { at: 0.32, x: 0.01, y: -0.1 },
        { at: 0.41, x: 0.02, y: 0.37 },
        { at: 0.485, x: -0.01, y: -0.12 },
        { at: 0.58, x: 0.01, y: -0.13 },
        { at: 0.665, x: 0.02, y: 0.52 },
        { at: 0.745, x: -0.01, y: -0.15 },
        { at: 0.83, x: 0.01, y: -0.1 },
        { at: 0.92, x: 0.02, y: 0.4 },
        { at: 1, x: 0, y: 0, vy: -1.9 },
      ],
      frettingHand: [
        { at: 0.045, x: -0.2, y: 0.08, vx: -0.35, vy: 0.04 },
        { at: 0.18, x: -0.08, y: -0.1 },
        { at: 0.295, x: 0.06, y: 0.08 },
        { at: 0.43, x: 0.16, y: -0.11 },
        { at: 0.52, x: 0.38, y: 0.14 },
        { at: 0.59, x: 0.2, y: -0.24 },
        { at: 0.69, x: 0.12, y: -0.18 },
        { at: 0.78, x: -0.05, y: 0.08 },
        { at: 0.84, x: -0.18, y: 0.1 },
        { at: 0.92, x: -0.28, y: -0.1 },
        { at: 1, x: -0.18, y: 0.06, vx: -0.35, vy: 0.04 },
      ],
    },
  },
} as const satisfies Record<string, GuitarMotifDefinition>

export type GuitarMotifId = keyof typeof GUITAR_MOTIFS
