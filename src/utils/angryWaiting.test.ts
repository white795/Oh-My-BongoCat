/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { ANGRY_WAITING, AngryWaitingMachine } from './angryWaiting.ts'

describe('angry waiting state machine', () => {
  it('starts annoyed and exposes only the first escalation deadline', () => {
    const now = 1_000
    const machine = new AngryWaitingMachine(() => now)

    const ignored = machine.advance(1)

    assert.equal(ignored.snapshot.lifecycle, 'inactive')
    assert.equal(ignored.snapshot.revision, 0)
    assert.deepEqual(ignored.cues, [])
    assert.equal(ignored.nextDeadlineAt, undefined)

    const activated = machine.activate(1)

    assert.deepEqual(activated.snapshot, {
      lifecycle: 'active',
      parentGeneration: 1,
      revision: 1,
      intensity: 'annoyed',
    })
    assert.deepEqual(activated.cues, [])
    assert.equal(activated.nextDeadlineAt, now + ANGRY_WAITING.impatientAfterMs)
  })

  it('escalates once at each threshold without repeating cues', () => {
    let now = 2_000
    const machine = new AngryWaitingMachine(() => now)

    machine.activate(2)

    now += ANGRY_WAITING.impatientAfterMs - 1
    const held = machine.advance(2)
    assert.equal(held.snapshot.lifecycle, 'active')
    assert.equal(held.snapshot.intensity, 'annoyed')
    assert.equal(held.snapshot.revision, 1)
    assert.deepEqual(held.cues, [])

    now += 1
    const impatient = machine.advance(2)
    assert.equal(impatient.snapshot.lifecycle, 'active')
    assert.equal(impatient.snapshot.intensity, 'impatient')
    assert.equal(impatient.snapshot.revision, 2)
    assert.deepEqual(impatient.cues, [{
      kind: 'anger-escalated',
      intensity: 'impatient',
      sequence: 1,
      parentGeneration: 2,
    }])
    assert.equal(impatient.nextDeadlineAt, 2_000 + ANGRY_WAITING.furiousAfterMs)

    assert.deepEqual(machine.advance(2).cues, [], 'the same threshold cannot replay its cue')

    now = 2_000 + ANGRY_WAITING.furiousAfterMs
    const furious = machine.advance(2)
    assert.equal(furious.snapshot.lifecycle, 'active')
    assert.equal(furious.snapshot.intensity, 'furious')
    assert.equal(furious.snapshot.revision, 3)
    assert.deepEqual(furious.cues, [{
      kind: 'anger-escalated',
      intensity: 'furious',
      sequence: 2,
      parentGeneration: 2,
    }])
    assert.equal(furious.nextDeadlineAt, undefined)
  })

  it('jumps directly to the current intensity after a late wake-up', () => {
    let now = 3_000
    const machine = new AngryWaitingMachine(() => now)

    machine.activate(3)
    now += ANGRY_WAITING.furiousAfterMs + 5_000

    const caughtUp = machine.advance(3)

    assert.equal(caughtUp.snapshot.lifecycle, 'active')
    assert.equal(caughtUp.snapshot.intensity, 'furious')
    assert.equal(caughtUp.snapshot.revision, 2)
    assert.deepEqual(caughtUp.cues.map(cue => cue.intensity), ['furious'])
    assert.equal(caughtUp.nextDeadlineAt, undefined)
  })

  it('does not reset a continuous waiting interval for the same generation', () => {
    let now = 4_000
    const machine = new AngryWaitingMachine(() => now)

    machine.activate(4)
    now += ANGRY_WAITING.impatientAfterMs - 100

    const duplicateActivation = machine.activate(4)

    assert.equal(duplicateActivation.snapshot.revision, 1)
    assert.equal(duplicateActivation.nextDeadlineAt, 4_000 + ANGRY_WAITING.impatientAfterMs)

    now += 100
    const impatient = machine.advance(4).snapshot
    assert.equal(impatient.lifecycle, 'active')
    if (impatient.lifecycle !== 'active') assert.fail('waiting should remain active')
    assert.equal(impatient.intensity, 'impatient')
  })

  it('clears deadlines on exit and rejects stale generation work', () => {
    let now = 5_000
    const machine = new AngryWaitingMachine(() => now)

    machine.activate(5)
    const deactivated = machine.deactivate(6)

    assert.deepEqual(deactivated.snapshot, {
      lifecycle: 'inactive',
      parentGeneration: 6,
      revision: 2,
    })
    assert.equal(deactivated.nextDeadlineAt, undefined)

    now += ANGRY_WAITING.furiousAfterMs
    assert.deepEqual(machine.advance(5).cues, [])
    assert.equal(machine.activate(5).snapshot.lifecycle, 'inactive')

    const reactivated = machine.activate(7)

    assert.equal(reactivated.snapshot.lifecycle, 'active')
    assert.equal(reactivated.snapshot.intensity, 'annoyed')
    assert.equal(reactivated.snapshot.parentGeneration, 7)
    assert.equal(reactivated.nextDeadlineAt, now + ANGRY_WAITING.impatientAfterMs)
  })

  it('keeps the injected clock monotonic when the source moves backwards', () => {
    let now = 10_000
    const machine = new AngryWaitingMachine(() => now)

    machine.activate(8)
    now += ANGRY_WAITING.impatientAfterMs
    machine.advance(8)

    now = 1
    const rolledBack = machine.advance(8)

    assert.equal(rolledBack.snapshot.lifecycle, 'active')
    assert.equal(rolledBack.snapshot.intensity, 'impatient')
    assert.equal(rolledBack.nextDeadlineAt, 10_000 + ANGRY_WAITING.furiousAfterMs)
  })
})
