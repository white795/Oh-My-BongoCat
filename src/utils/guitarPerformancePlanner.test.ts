/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  GUITAR_CONTINUE_TEMPLATE_ID,
  GUITAR_ESTABLISH_PHRASE_ID,
  GUITAR_INPUT_BASELINE_TEMPLATE_ID,
  GUITAR_INPUT_PHRASE_SEQUENCE,
  GUITAR_SOFT_CADENCE_PHRASE_ID,
  GUITAR_SOFT_CLOSE_TEMPLATE_ID,
  GUITAR_VARIATION_PHRASE_ID,
} from './guitarPerformance.ts'
import { GuitarPerformancePlanner } from './guitarPerformancePlanner.ts'

describe('guitar performance planner', () => {
  it('expands the frozen input baseline into an auditable deterministic score', () => {
    const planner = new GuitarPerformancePlanner()
    const plans = Array.from({ length: 8 }, () => planner.next(GUITAR_INPUT_BASELINE_TEMPLATE_ID))

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
    assert.equal(plans.at(-1)?.role, 'accent-cadence')
    assert.deepEqual(planner.snapshot, plans.at(-1))
  })

  it('restarts from the establish slot when a profile boundary resets the score', () => {
    const planner = new GuitarPerformancePlanner()
    planner.next(GUITAR_INPUT_BASELINE_TEMPLATE_ID)
    planner.next(GUITAR_INPUT_BASELINE_TEMPLATE_ID)
    planner.next(GUITAR_INPUT_BASELINE_TEMPLATE_ID)

    planner.reset()

    assert.equal(planner.snapshot, undefined)
    assert.deepEqual(planner.next(GUITAR_INPUT_BASELINE_TEMPLATE_ID), {
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
      return Array.from({ length: 4 }, () => planner.next(templateId))
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
})
