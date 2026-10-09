import type { GuitarMotifDefinition, GuitarMotifPreviewSlot } from './types'

import { GUITAR_ESTABLISH_PHRASE_ID, GUITAR_VARIATION_PHRASE_ID } from '../guitarPerformance'
import { CALL_RESPONSE_SWAY_MOTIF, CALL_RESPONSE_SWAY_MOTIF_ID } from './callResponseSway'
import { FRETBOARD_SLIDE_ACCENT_MOTIF, FRETBOARD_SLIDE_ACCENT_MOTIF_ID } from './fretboardSlideAccent'
import { IMMERSED_DOUBLE_NOD_MOTIF, IMMERSED_DOUBLE_NOD_MOTIF_ID } from './immersedDoubleNod'
import { LAZY_ARPEGGIO_MOTIF, LAZY_ARPEGGIO_MOTIF_ID } from './lazyArpeggio'
import { SINGLE_PICK_ACK_MOTIF, SINGLE_PICK_ACK_MOTIF_ID } from './singlePickAck'
import { SUSTAIN_SWAY_MOTIF, SUSTAIN_SWAY_MOTIF_ID } from './sustainSway'
import { SYNCOPATED_CHORD_WALK_MOTIF, SYNCOPATED_CHORD_WALK_MOTIF_ID } from './syncopatedChordWalk'
import { TUNING_LISTEN_MOTIF, TUNING_LISTEN_MOTIF_ID } from './tuningListen'
import { TWO_NOTE_ANSWER_MOTIF, TWO_NOTE_ANSWER_MOTIF_ID } from './twoNoteAnswer'

export const GUITAR_MOTIF_PREVIEW_PHRASE_ID = 'motif-preview'

export const GUITAR_MOTIF_PREVIEW = {
  leadInBeats: 0,
  loopBeats: 4,
} as const

// Development-only score: establish a predictable groove before inserting
// the Motif, then loop back to A so both boundaries can be reviewed together.
export const GUITAR_MOTIF_PREVIEW_SEQUENCE = [
  { kind: 'phrase', phraseId: GUITAR_ESTABLISH_PHRASE_ID },
  { kind: 'phrase', phraseId: GUITAR_ESTABLISH_PHRASE_ID },
  { kind: 'phrase', phraseId: GUITAR_VARIATION_PHRASE_ID },
  { kind: 'motif' },
] as const satisfies readonly GuitarMotifPreviewSlot[]

// Default development score for accepted actions: one established phrase
// provides a known entry pose, the Motif plays once, and the loop returns to A.
export const GUITAR_MOTIF_CONTINUITY_SEQUENCE = [
  { kind: 'phrase', phraseId: GUITAR_ESTABLISH_PHRASE_ID },
  { kind: 'motif' },
] as const satisfies readonly GuitarMotifPreviewSlot[]

export const GUITAR_MOTIFS = {
  [TUNING_LISTEN_MOTIF_ID]: TUNING_LISTEN_MOTIF,
  [LAZY_ARPEGGIO_MOTIF_ID]: LAZY_ARPEGGIO_MOTIF,
  [SUSTAIN_SWAY_MOTIF_ID]: SUSTAIN_SWAY_MOTIF,
  [SINGLE_PICK_ACK_MOTIF_ID]: SINGLE_PICK_ACK_MOTIF,
  [TWO_NOTE_ANSWER_MOTIF_ID]: TWO_NOTE_ANSWER_MOTIF,
  [SYNCOPATED_CHORD_WALK_MOTIF_ID]: SYNCOPATED_CHORD_WALK_MOTIF,
  [CALL_RESPONSE_SWAY_MOTIF_ID]: CALL_RESPONSE_SWAY_MOTIF,
  [IMMERSED_DOUBLE_NOD_MOTIF_ID]: IMMERSED_DOUBLE_NOD_MOTIF,
  [FRETBOARD_SLIDE_ACCENT_MOTIF_ID]: FRETBOARD_SLIDE_ACCENT_MOTIF,
} as const satisfies Record<string, GuitarMotifDefinition>

export type GuitarMotifId = keyof typeof GUITAR_MOTIFS

export const GUITAR_MOTIF_CATALOG = [
  GUITAR_MOTIFS[TUNING_LISTEN_MOTIF_ID],
  GUITAR_MOTIFS[LAZY_ARPEGGIO_MOTIF_ID],
  GUITAR_MOTIFS[SUSTAIN_SWAY_MOTIF_ID],
  GUITAR_MOTIFS[TWO_NOTE_ANSWER_MOTIF_ID],
  GUITAR_MOTIFS[SYNCOPATED_CHORD_WALK_MOTIF_ID],
  GUITAR_MOTIFS[CALL_RESPONSE_SWAY_MOTIF_ID],
  GUITAR_MOTIFS[IMMERSED_DOUBLE_NOD_MOTIF_ID],
  GUITAR_MOTIFS[FRETBOARD_SLIDE_ACCENT_MOTIF_ID],
] as const satisfies readonly GuitarMotifDefinition[]

// Accepted actions use an A/Motif score for continuity review. The first
// accepted Motif keeps its already-validated A/A/A-prime lead-in, while the
// deferred single-pick experiment remains reachable from the console only.
export const GUITAR_MOTIF_PREVIEW_SEQUENCES: Record<GuitarMotifId, readonly GuitarMotifPreviewSlot[]> = {
  [TUNING_LISTEN_MOTIF_ID]: GUITAR_MOTIF_CONTINUITY_SEQUENCE,
  [LAZY_ARPEGGIO_MOTIF_ID]: GUITAR_MOTIF_CONTINUITY_SEQUENCE,
  [SUSTAIN_SWAY_MOTIF_ID]: GUITAR_MOTIF_CONTINUITY_SEQUENCE,
  [SINGLE_PICK_ACK_MOTIF_ID]: [{ kind: 'motif' }],
  [TWO_NOTE_ANSWER_MOTIF_ID]: GUITAR_MOTIF_CONTINUITY_SEQUENCE,
  [SYNCOPATED_CHORD_WALK_MOTIF_ID]: GUITAR_MOTIF_CONTINUITY_SEQUENCE,
  [CALL_RESPONSE_SWAY_MOTIF_ID]: GUITAR_MOTIF_CONTINUITY_SEQUENCE,
  [IMMERSED_DOUBLE_NOD_MOTIF_ID]: GUITAR_MOTIF_PREVIEW_SEQUENCE,
  [FRETBOARD_SLIDE_ACCENT_MOTIF_ID]: GUITAR_MOTIF_CONTINUITY_SEQUENCE,
}
