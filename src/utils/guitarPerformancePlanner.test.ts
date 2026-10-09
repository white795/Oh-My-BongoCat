/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { GuitarPerformanceIntent } from './guitarPerformance.ts'

import {
  CALL_RESPONSE_SWAY_MOTIF_ID,
  FRETBOARD_SLIDE_ACCENT_MOTIF_ID,
  IMMERSED_DOUBLE_NOD_MOTIF_ID,
  LAZY_ARPEGGIO_MOTIF_ID,
  SUSTAIN_SWAY_MOTIF_ID,
  SYNCOPATED_CHORD_WALK_MOTIF_ID,
  TUNING_LISTEN_MOTIF_ID,
  TWO_NOTE_ANSWER_MOTIF_ID,
} from './guitarMotifs.ts'
import {
  GUITAR_CONTINUE_TEMPLATE_ID,
  GUITAR_ESTABLISH_PHRASE_ID,
  GUITAR_INPUT_BASELINE_TEMPLATE_ID,
  GUITAR_INPUT_PHRASE_SEQUENCE,
  GUITAR_SOFT_CADENCE_PHRASE_ID,
  GUITAR_SOFT_CLOSE_TEMPLATE_ID,
  GUITAR_VARIATION_PHRASE_ID,
} from './guitarPerformance.ts'
import { eligibleGuitarMotifs, guitarCarrierGain, GuitarPerformancePlanner } from './guitarPerformancePlanner.ts'

const GROOVE_INTENT: GuitarPerformanceIntent = {
  profile: 'groove',
  activity: 0.6,
  releasing: false,
}

const PROFILE_ACTIVITY = {
  autonomous: 0,
  engaged: 0.25,
  groove: 0.6,
  drive: 1,
} as const

function intent(profile: GuitarPerformanceIntent['profile']): GuitarPerformanceIntent {
  return { profile, activity: PROFILE_ACTIVITY[profile], releasing: false }
}

function plannedMotifs(profile: GuitarPerformanceIntent['profile'], count: number) {
  const planner = new GuitarPerformancePlanner()
  const motifs = []
  for (let phrase = 0; motifs.length < count && phrase < count * 8; phrase++) {
    const plan = planner.nextPerformance(intent(profile))
    if (plan.kind === 'motif') motifs.push(plan.motifId)
  }
  assert.equal(motifs.length, count)
  return motifs
}

describe('guitar performance planner', () => {
  it('expands the frozen input baseline into an auditable deterministic score', () => {
    const planner = new GuitarPerformancePlanner()
    const plans = Array.from({ length: 8 }, () => planner.next(GUITAR_INPUT_BASELINE_TEMPLATE_ID, GROOVE_INTENT))

    assert.deepEqual(plans.map(plan => plan.phraseId), [
      ...GUITAR_INPUT_PHRASE_SEQUENCE,
      ...GUITAR_INPUT_PHRASE_SEQUENCE,
    ])
    assert.deepEqual(plans.map(plan => plan.slotId), [
      'establish',
      'repeat',
      'variation',
      'ending',
      'establish',
      'repeat',
      'variation',
      'ending',
    ])
    assert.deepEqual(plans.map(plan => plan.templateIteration), [0, 0, 0, 0, 1, 1, 1, 1])
    assert.deepEqual(plans.map(plan => plan.slotIndex), [0, 1, 2, 3, 0, 1, 2, 3])
    assert.ok(plans.every(plan => plan.templateId === GUITAR_INPUT_BASELINE_TEMPLATE_ID))
    assert.ok(plans.every(plan => plan.kind === 'phrase'))
    assert.ok(plans.every(plan => plan.profile === 'groove'))
    assert.ok(plans.every(plan => plan.gain === guitarCarrierGain(GROOVE_INTENT.activity)))
    assert.ok(plans.every(plan => plan.reason === 'template-slot'))
    assert.equal(plans.at(-1)?.role, 'accent-cadence')
    assert.deepEqual(planner.snapshot, plans.at(-1))
  })

  it('restarts from the establish slot when a profile boundary resets the score', () => {
    const planner = new GuitarPerformancePlanner()
    planner.next(GUITAR_INPUT_BASELINE_TEMPLATE_ID, GROOVE_INTENT)
    planner.next(GUITAR_INPUT_BASELINE_TEMPLATE_ID, GROOVE_INTENT)
    planner.next(GUITAR_INPUT_BASELINE_TEMPLATE_ID, GROOVE_INTENT)

    planner.reset()

    assert.equal(planner.snapshot, undefined)
    assert.deepEqual(planner.next(GUITAR_INPUT_BASELINE_TEMPLATE_ID, GROOVE_INTENT), {
      kind: 'phrase',
      profile: 'groove',
      gain: guitarCarrierGain(GROOVE_INTENT.activity),
      reason: 'template-slot',
      templateId: GUITAR_INPUT_BASELINE_TEMPLATE_ID,
      templateIteration: 0,
      slotIndex: 0,
      slotId: 'establish',
      role: 'establish',
      phraseId: GUITAR_INPUT_PHRASE_SEQUENCE[0],
    })
  })

  it('represents continue, soft-close and accent-close as separate auditable templates', () => {
    const phrasesFor = (templateId: Parameters<GuitarPerformancePlanner['next']>[0]) => {
      const planner = new GuitarPerformancePlanner()
      return Array.from({ length: 4 }, () => planner.next(templateId, GROOVE_INTENT))
    }

    const continuation = phrasesFor(GUITAR_CONTINUE_TEMPLATE_ID)
    const softClose = phrasesFor(GUITAR_SOFT_CLOSE_TEMPLATE_ID)
    const accentClose = phrasesFor(GUITAR_INPUT_BASELINE_TEMPLATE_ID)

    assert.deepEqual(continuation.map(plan => plan.phraseId), [
      GUITAR_ESTABLISH_PHRASE_ID,
      GUITAR_ESTABLISH_PHRASE_ID,
      GUITAR_VARIATION_PHRASE_ID,
      GUITAR_ESTABLISH_PHRASE_ID,
    ])
    assert.equal(continuation.at(-1)?.role, 'continuation')

    assert.deepEqual(softClose.map(plan => plan.phraseId), [
      GUITAR_ESTABLISH_PHRASE_ID,
      GUITAR_ESTABLISH_PHRASE_ID,
      GUITAR_ESTABLISH_PHRASE_ID,
      GUITAR_SOFT_CADENCE_PHRASE_ID,
    ])
    assert.equal(softClose.at(-2)?.phraseId, GUITAR_ESTABLISH_PHRASE_ID, 'A may lead directly into a close')
    assert.equal(softClose.at(-1)?.role, 'soft-cadence')
    assert.equal(accentClose.at(-1)?.role, 'accent-cadence')
  })

  it('maps activity monotonically into a bounded carrier gain', () => {
    const inputs = [-1, 0, 0.25, 0.6, 1, 2]
    const gains = inputs.map(guitarCarrierGain)

    assert.deepEqual(gains, [0.6, 0.6, 0.6625, 0.8592, 1, 1])
    assert.ok(gains.every((gain, index) => index === 0 || gain >= gains[index - 1]))
  })

  it('plans preview context with activity gain while keeping the Motif at standard gain', () => {
    const planner = new GuitarPerformancePlanner()
    const context = planner.preview(
      { kind: 'phrase', phraseId: GUITAR_ESTABLISH_PHRASE_ID },
      CALL_RESPONSE_SWAY_MOTIF_ID,
      0,
      GROOVE_INTENT,
    )
    const motif = planner.preview(
      { kind: 'motif' },
      CALL_RESPONSE_SWAY_MOTIF_ID,
      1,
      GROOVE_INTENT,
    )

    assert.deepEqual(context, {
      kind: 'phrase',
      phraseId: GUITAR_ESTABLISH_PHRASE_ID,
      role: 'establish',
      profile: 'groove',
      gain: guitarCarrierGain(GROOVE_INTENT.activity),
      reason: 'preview-context',
      slotIndex: 0,
      slotId: 'preview-0',
    })
    assert.deepEqual(motif, {
      kind: 'motif',
      motifId: CALL_RESPONSE_SWAY_MOTIF_ID,
      role: 'feature',
      profile: 'groove',
      gain: 1,
      reason: 'preview-motif',
      slotIndex: 1,
      slotId: 'preview-1',
    })
    assert.deepEqual(planner.snapshot, motif)
  })

  it('builds cumulative Motif eligibility without leaking high-intensity actions downward', () => {
    assert.deepEqual(eligibleGuitarMotifs('autonomous').map(motif => motif.id), [
      TUNING_LISTEN_MOTIF_ID,
      LAZY_ARPEGGIO_MOTIF_ID,
      SUSTAIN_SWAY_MOTIF_ID,
      TWO_NOTE_ANSWER_MOTIF_ID,
      CALL_RESPONSE_SWAY_MOTIF_ID,
    ])
    assert.deepEqual(eligibleGuitarMotifs('engaged').map(motif => motif.id), [
      TUNING_LISTEN_MOTIF_ID,
      LAZY_ARPEGGIO_MOTIF_ID,
      SUSTAIN_SWAY_MOTIF_ID,
      TWO_NOTE_ANSWER_MOTIF_ID,
      CALL_RESPONSE_SWAY_MOTIF_ID,
    ])
    assert.deepEqual(eligibleGuitarMotifs('groove').map(motif => motif.id), [
      TUNING_LISTEN_MOTIF_ID,
      LAZY_ARPEGGIO_MOTIF_ID,
      SUSTAIN_SWAY_MOTIF_ID,
      TWO_NOTE_ANSWER_MOTIF_ID,
      SYNCOPATED_CHORD_WALK_MOTIF_ID,
      CALL_RESPONSE_SWAY_MOTIF_ID,
    ])
    assert.deepEqual(eligibleGuitarMotifs('drive').map(motif => motif.id), [
      TUNING_LISTEN_MOTIF_ID,
      LAZY_ARPEGGIO_MOTIF_ID,
      SUSTAIN_SWAY_MOTIF_ID,
      TWO_NOTE_ANSWER_MOTIF_ID,
      SYNCOPATED_CHORD_WALK_MOTIF_ID,
      CALL_RESPONSE_SWAY_MOTIF_ID,
      IMMERSED_DOUBLE_NOD_MOTIF_ID,
      FRETBOARD_SLIDE_ACCENT_MOTIF_ID,
    ])
  })

  it('alternates home and supporting Motifs deterministically within each profile', () => {
    assert.deepEqual(plannedMotifs('autonomous', 8), [
      TUNING_LISTEN_MOTIF_ID,
      TWO_NOTE_ANSWER_MOTIF_ID,
      LAZY_ARPEGGIO_MOTIF_ID,
      CALL_RESPONSE_SWAY_MOTIF_ID,
      SUSTAIN_SWAY_MOTIF_ID,
      TWO_NOTE_ANSWER_MOTIF_ID,
      TUNING_LISTEN_MOTIF_ID,
      CALL_RESPONSE_SWAY_MOTIF_ID,
    ])
    assert.deepEqual(plannedMotifs('engaged', 8), [
      TWO_NOTE_ANSWER_MOTIF_ID,
      TUNING_LISTEN_MOTIF_ID,
      TWO_NOTE_ANSWER_MOTIF_ID,
      LAZY_ARPEGGIO_MOTIF_ID,
      TWO_NOTE_ANSWER_MOTIF_ID,
      SUSTAIN_SWAY_MOTIF_ID,
      TWO_NOTE_ANSWER_MOTIF_ID,
      CALL_RESPONSE_SWAY_MOTIF_ID,
    ])
    assert.deepEqual(plannedMotifs('groove', 8), [
      SYNCOPATED_CHORD_WALK_MOTIF_ID,
      TUNING_LISTEN_MOTIF_ID,
      CALL_RESPONSE_SWAY_MOTIF_ID,
      LAZY_ARPEGGIO_MOTIF_ID,
      SYNCOPATED_CHORD_WALK_MOTIF_ID,
      SUSTAIN_SWAY_MOTIF_ID,
      CALL_RESPONSE_SWAY_MOTIF_ID,
      TWO_NOTE_ANSWER_MOTIF_ID,
    ])
    assert.deepEqual(plannedMotifs('drive', 8), [
      IMMERSED_DOUBLE_NOD_MOTIF_ID,
      TUNING_LISTEN_MOTIF_ID,
      FRETBOARD_SLIDE_ACCENT_MOTIF_ID,
      LAZY_ARPEGGIO_MOTIF_ID,
      IMMERSED_DOUBLE_NOD_MOTIF_ID,
      SUSTAIN_SWAY_MOTIF_ID,
      FRETBOARD_SLIDE_ACCENT_MOTIF_ID,
      TWO_NOTE_ANSWER_MOTIF_ID,
    ])
  })

  it('records whether a Motif was selected as the current-tier lead or cumulative support', () => {
    const planner = new GuitarPerformancePlanner()
    const motifPlans = []
    for (let phrase = 0; motifPlans.length < 4; phrase++) {
      const plan = planner.nextPerformance(intent('drive'))
      if (plan.kind === 'motif') motifPlans.push(plan)
    }

    assert.deepEqual(motifPlans.map(plan => plan.reason), [
      'performance-home-motif',
      'performance-support-motif',
      'performance-home-motif',
      'performance-support-motif',
    ])
  })

  it('uses an A A Motif A block normally and preserves the special A A A-prime Motif lead-in', () => {
    const autonomous = new GuitarPerformancePlanner()
    const normalBlock = Array.from({ length: 4 }, () => autonomous.nextPerformance(intent('autonomous')))
    assert.deepEqual(normalBlock.map(plan => plan.kind === 'motif' ? plan.motifId : plan.phraseId), [
      GUITAR_ESTABLISH_PHRASE_ID,
      GUITAR_ESTABLISH_PHRASE_ID,
      TUNING_LISTEN_MOTIF_ID,
      GUITAR_ESTABLISH_PHRASE_ID,
    ])
    assert.deepEqual(normalBlock.map(plan => plan.slotId), ['establish', 'repeat', 'feature', 'recovery'])

    const drive = new GuitarPerformancePlanner()
    const specialBlock = Array.from({ length: 4 }, () => drive.nextPerformance(intent('drive')))
    assert.deepEqual(specialBlock.map(plan => plan.kind === 'motif' ? plan.motifId : plan.phraseId), [
      GUITAR_ESTABLISH_PHRASE_ID,
      GUITAR_ESTABLISH_PHRASE_ID,
      GUITAR_VARIATION_PHRASE_ID,
      IMMERSED_DOUBLE_NOD_MOTIF_ID,
    ])
    assert.deepEqual(specialBlock.map(plan => plan.slotId), ['establish', 'repeat', 'lead-in', 'feature'])
  })

  it('cancels a queued DRIVE Motif when the intent drops before the feature boundary', () => {
    const planner = new GuitarPerformancePlanner()
    assert.equal(planner.nextPerformance(intent('drive')).phraseId, GUITAR_ESTABLISH_PHRASE_ID)
    assert.equal(planner.nextPerformance(intent('drive')).phraseId, GUITAR_ESTABLISH_PHRASE_ID)
    assert.equal(planner.nextPerformance(intent('drive')).phraseId, GUITAR_VARIATION_PHRASE_ID)

    const afterDrop = Array.from({ length: 4 }, () => planner.nextPerformance(intent('autonomous')))
    assert.deepEqual(afterDrop.map(plan => plan.kind === 'motif' ? plan.motifId : plan.phraseId), [
      GUITAR_ESTABLISH_PHRASE_ID,
      GUITAR_ESTABLISH_PHRASE_ID,
      TUNING_LISTEN_MOTIF_ID,
      GUITAR_ESTABLISH_PHRASE_ID,
    ])
    assert.ok(afterDrop.every(plan => plan.profile === 'autonomous'))
  })

  it('replaces a queued Motif with one SoftCadence and then holds A while releasing', () => {
    const planner = new GuitarPerformancePlanner()
    planner.nextPerformance(intent('drive'))
    planner.nextPerformance(intent('drive'))

    const cadence = planner.nextPerformance({
      profile: 'drive',
      activity: 0.7,
      releasing: true,
    })
    assert.equal(cadence.kind, 'phrase')
    assert.equal(cadence.phraseId, GUITAR_SOFT_CADENCE_PHRASE_ID)
    assert.equal(cadence.role, 'soft-cadence')
    assert.equal(cadence.reason, 'performance-release-cadence')
    assert.equal(cadence.gain, guitarCarrierGain(0.7))

    const firstHold = planner.nextPerformance({
      profile: 'drive',
      activity: 0.35,
      releasing: true,
    })
    const secondHold = planner.nextPerformance({
      profile: 'drive',
      activity: 0.1,
      releasing: true,
    })
    for (const hold of [firstHold, secondHold]) {
      assert.equal(hold.kind, 'phrase')
      assert.equal(hold.phraseId, GUITAR_ESTABLISH_PHRASE_ID)
      assert.equal(hold.role, 'continuation')
      assert.equal(hold.reason, 'performance-release-hold')
    }
    assert.equal(firstHold.gain, guitarCarrierGain(0.35))
    assert.equal(secondHold.gain, guitarCarrierGain(0.1))
  })

  it('does not replay the release cadence on a profile drop and restarts from A when release ends', () => {
    const planner = new GuitarPerformancePlanner()
    planner.nextPerformance(intent('drive'))

    const cadence = planner.nextPerformance({
      profile: 'drive',
      activity: 0.8,
      releasing: true,
    })
    assert.equal(cadence.reason, 'performance-release-cadence')

    const afterDrop = planner.nextPerformance({
      profile: 'autonomous',
      activity: 0.15,
      releasing: true,
    })
    assert.equal(afterDrop.profile, 'autonomous')
    assert.equal(afterDrop.phraseId, GUITAR_ESTABLISH_PHRASE_ID)
    assert.equal(afterDrop.reason, 'performance-release-hold')

    const resumed = planner.nextPerformance(intent('autonomous'))
    assert.equal(resumed.phraseId, GUITAR_ESTABLISH_PHRASE_ID)
    assert.equal(resumed.reason, 'performance-establish')
    assert.equal(resumed.slotIndex, 0)
  })
})
