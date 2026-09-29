// Compatibility facade: consumers keep one stable import path while each
// Motif owns its action data and tests in an independent module.
export { CALL_RESPONSE_SWAY_MOTIF, CALL_RESPONSE_SWAY_MOTIF_ID } from './guitarMotifs/callResponseSway'
export { FRETBOARD_SLIDE_ACCENT_MOTIF, FRETBOARD_SLIDE_ACCENT_MOTIF_ID } from './guitarMotifs/fretboardSlideAccent'
export { IMMERSED_DOUBLE_NOD_MOTIF, IMMERSED_DOUBLE_NOD_MOTIF_ID } from './guitarMotifs/immersedDoubleNod'
export { LAZY_ARPEGGIO_MOTIF, LAZY_ARPEGGIO_MOTIF_ID } from './guitarMotifs/lazyArpeggio'
export { GUITAR_MOTIF_CATALOG, GUITAR_MOTIF_CONTINUITY_SEQUENCE, GUITAR_MOTIF_PREVIEW, GUITAR_MOTIF_PREVIEW_PHRASE_ID, GUITAR_MOTIF_PREVIEW_SEQUENCE, GUITAR_MOTIF_PREVIEW_SEQUENCES, GUITAR_MOTIFS, type GuitarMotifId } from './guitarMotifs/registry'
export { SINGLE_PICK_ACK_MOTIF, SINGLE_PICK_ACK_MOTIF_ID } from './guitarMotifs/singlePickAck'
export { SUSTAIN_SWAY_MOTIF, SUSTAIN_SWAY_MOTIF_ID } from './guitarMotifs/sustainSway'
export { SYNCOPATED_CHORD_WALK_MOTIF, SYNCOPATED_CHORD_WALK_MOTIF_ID } from './guitarMotifs/syncopatedChordWalk'
export { TUNING_LISTEN_MOTIF, TUNING_LISTEN_MOTIF_ID } from './guitarMotifs/tuningListen'
export { TWO_NOTE_ANSWER_MOTIF, TWO_NOTE_ANSWER_MOTIF_ID } from './guitarMotifs/twoNoteAnswer'
export type { GuitarMotifDefinition, GuitarMotifPreviewSlot, GuitarMotifTrackName } from './guitarMotifs/types'
