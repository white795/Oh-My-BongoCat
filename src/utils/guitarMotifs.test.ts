/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { FRETBOARD_SLIDE_ACCENT_MOTIF, FRETBOARD_SLIDE_ACCENT_MOTIF_ID, GUITAR_MOTIF_CATALOG, GUITAR_MOTIF_CONTINUITY_SEQUENCE, GUITAR_MOTIF_PREVIEW_SEQUENCE, GUITAR_MOTIF_PREVIEW_SEQUENCES, GUITAR_MOTIFS, IMMERSED_DOUBLE_NOD_MOTIF, IMMERSED_DOUBLE_NOD_MOTIF_ID, SINGLE_PICK_ACK_MOTIF_ID, SUSTAIN_SWAY_MOTIF, SUSTAIN_SWAY_MOTIF_ID } from './guitarMotifs.ts'
import { GUITAR_ESTABLISH_PHRASE_ID, GUITAR_VARIATION_PHRASE_ID } from './guitarPerformance.ts'

describe('guitar motif registry', () => {
  it('registers each standalone action without copying its definition', () => {
    assert.equal(GUITAR_MOTIFS[IMMERSED_DOUBLE_NOD_MOTIF_ID], IMMERSED_DOUBLE_NOD_MOTIF)
    assert.equal(GUITAR_MOTIFS[FRETBOARD_SLIDE_ACCENT_MOTIF_ID], FRETBOARD_SLIDE_ACCENT_MOTIF)
    assert.equal(GUITAR_MOTIFS[SUSTAIN_SWAY_MOTIF_ID], SUSTAIN_SWAY_MOTIF)
  })

  it('freezes the eight accepted actions with separate home and minimum profiles', () => {
    assert.deepEqual(
      GUITAR_MOTIF_CATALOG.map(({ id, label, homeProfile, minimumProfile }) => ({ id, label, homeProfile, minimumProfile })),
      [
        { id: 'tuning-listen', label: 'TUNING LISTEN', homeProfile: 'autonomous', minimumProfile: 'autonomous' },
        { id: 'lazy-arpeggio', label: 'LAZY ARPEGGIO', homeProfile: 'autonomous', minimumProfile: 'autonomous' },
        { id: 'sustain-sway', label: 'SUSTAIN SWAY', homeProfile: 'autonomous', minimumProfile: 'autonomous' },
        { id: 'two-note-answer', label: 'TWO NOTE ANSWER', homeProfile: 'engaged', minimumProfile: 'autonomous' },
        { id: 'syncopated-chord-walk', label: 'SYNCOPATED CHORD WALK', homeProfile: 'groove', minimumProfile: 'groove' },
        { id: 'call-response-sway', label: 'CALL RESPONSE SWAY', homeProfile: 'groove', minimumProfile: 'autonomous' },
        { id: 'immersed-double-nod', label: 'IMMERSED DOUBLE NOD', homeProfile: 'drive', minimumProfile: 'drive' },
        { id: 'fretboard-slide-accent', label: 'FRETBOARD SLIDE ACCENT', homeProfile: 'drive', minimumProfile: 'drive' },
      ],
    )
    assert.equal(GUITAR_MOTIF_CATALOG.length, 8)
    assert.equal(GUITAR_MOTIF_CATALOG.map(motif => String(motif.id)).includes(SINGLE_PICK_ACK_MOTIF_ID), false)
  })

  it('keeps the accepted nod inside its deterministic continuity score', () => {
    assert.deepEqual(GUITAR_MOTIF_PREVIEW_SEQUENCE, [
      { kind: 'phrase', phraseId: GUITAR_ESTABLISH_PHRASE_ID },
      { kind: 'phrase', phraseId: GUITAR_ESTABLISH_PHRASE_ID },
      { kind: 'phrase', phraseId: GUITAR_VARIATION_PHRASE_ID },
      { kind: 'motif' },
    ])
    assert.equal(GUITAR_MOTIF_PREVIEW_SEQUENCES[IMMERSED_DOUBLE_NOD_MOTIF_ID], GUITAR_MOTIF_PREVIEW_SEQUENCE)
  })

  it('places every other accepted action between A phrases for continuity review', () => {
    assert.deepEqual(GUITAR_MOTIF_CONTINUITY_SEQUENCE, [
      { kind: 'phrase', phraseId: GUITAR_ESTABLISH_PHRASE_ID },
      { kind: 'motif' },
    ])

    for (const motif of GUITAR_MOTIF_CATALOG) {
      if (motif.id === IMMERSED_DOUBLE_NOD_MOTIF_ID) continue
      assert.equal(
        GUITAR_MOTIF_PREVIEW_SEQUENCES[motif.id],
        GUITAR_MOTIF_CONTINUITY_SEQUENCE,
        `${motif.id} should use the shared A/Motif continuity score`,
      )
    }
  })

  it('keeps the deferred single-pick experiment available only as an isolated console preview', () => {
    assert.deepEqual(GUITAR_MOTIF_PREVIEW_SEQUENCES[SINGLE_PICK_ACK_MOTIF_ID], [{ kind: 'motif' }])
  })
})
