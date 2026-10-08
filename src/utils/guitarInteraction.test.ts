/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { GUITAR_INTERACTION, GuitarInteractionMachine } from './guitarInteraction.ts'

describe('guitar interaction state machine', () => {
  it('stays autonomous after activation and ignores input while inactive', () => {
    let now = 1_000
    const machine = new GuitarInteractionMachine(() => now)

    const ignored = machine.press(1)

    assert.equal(ignored.snapshot.lifecycle, 'inactive')
    assert.equal(ignored.snapshot.revision, 0)
    assert.deepEqual(ignored.cues, [])
    assert.equal(ignored.nextDeadlineAt, undefined)

    const activated = machine.activate(1)

    assert.deepEqual(activated.snapshot, {
      lifecycle: 'active',
      parentGeneration: 1,
      revision: 1,
      interaction: 'autonomous',
      activity: 0,
      burst: 0,
      releasing: false,
      lastInputAt: undefined,
    })
    assert.deepEqual(activated.cues, [])
    assert.equal(activated.nextDeadlineAt, undefined)

    now += 60_000
    assert.deepEqual(machine.advance(1).cues, [], 'silence before any input is not a rest event')
  })

  it('raises sustained activity from engaged through groove to drive', () => {
    let now = 2_000
    const machine = new GuitarInteractionMachine(() => now)

    machine.activate(2)

    const first = machine.press(2)

    assert.equal(first.snapshot.interaction, 'engaged')
    assert.equal(first.snapshot.activity, 0.05)
    assert.equal(first.snapshot.burst, 0.2)
    assert.deepEqual(first.cues.map(cue => cue.kind), ['press'])

    let update = first
    for (let index = 1; index < GUITAR_INTERACTION.grooveEnterPresses; index++) {
      now += 250
      update = machine.press(2)
    }

    assert.equal(update.snapshot.interaction, 'groove')
    assert.equal(update.snapshot.activity, 0.3)

    for (
      let index = GUITAR_INTERACTION.grooveEnterPresses;
      index < GUITAR_INTERACTION.driveEnterPresses;
      index++
    ) {
      now += 250
      update = machine.press(2)
    }

    assert.equal(update.snapshot.interaction, 'drive')
    assert.equal(update.snapshot.activity, 0.6)
    assert.equal(update.nextDeadlineAt, now + GUITAR_INTERACTION.releaseDelayMs)
  })

  it('uses hysteresis when sustained input slows down', () => {
    let now = 3_000
    const machine = new GuitarInteractionMachine(() => now)

    machine.activate(3)
    for (let index = 0; index < GUITAR_INTERACTION.driveEnterPresses; index++) {
      now = 3_000 + index * 250
      machine.press(3)
    }

    assert.equal(machine.snapshot.interaction, 'drive')

    now += 900
    assert.equal(machine.press(3).snapshot.interaction, 'drive', 'drive holds above its lower exit threshold')

    now += 900
    assert.equal(machine.press(3).snapshot.interaction, 'groove')

    now += 900
    assert.equal(machine.press(3).snapshot.interaction, 'groove', 'groove also has a lower exit threshold')

    now += 900
    assert.equal(machine.press(3).snapshot.interaction, 'engaged')
  })

  it('detects short bursts and rate-limits accent cues', () => {
    let now = 4_000
    const machine = new GuitarInteractionMachine(() => now)
    const accentTimes: number[] = []

    machine.activate(4)

    for (let index = 0; index < 18; index++) {
      now = 4_000 + index * 100
      const update = machine.press(4)

      if (update.cues.some(cue => cue.kind === 'accent')) accentTimes.push(now)
    }

    assert.deepEqual(accentTimes, [4_400, 5_600])
    assert.equal(machine.snapshot.interaction, 'drive')
    assert.equal(machine.snapshot.burst, 1)
  })

  it('releases after a short hold and emits one input-rest at one second', () => {
    let now = 6_000
    const machine = new GuitarInteractionMachine(() => now)

    machine.activate(5)
    machine.press(5)

    now += GUITAR_INTERACTION.releaseDelayMs - 1
    const held = machine.advance(5)
    assert.equal(held.snapshot.releasing, false)
    assert.equal(held.nextDeadlineAt, 6_000 + GUITAR_INTERACTION.releaseDelayMs)

    now += 1
    const releasing = machine.advance(5)
    assert.equal(releasing.snapshot.interaction, 'engaged')
    assert.equal(releasing.snapshot.activity, 0.05)
    assert.equal(releasing.snapshot.releasing, true)
    assert.equal(releasing.nextDeadlineAt, 6_000 + GUITAR_INTERACTION.restDelayMs)

    now = 6_000 + GUITAR_INTERACTION.restDelayMs
    const rested = machine.advance(5)
    assert.equal(rested.snapshot.interaction, 'autonomous')
    assert.equal(rested.snapshot.activity, 0)
    assert.equal(rested.snapshot.burst, 0)
    assert.equal(rested.snapshot.releasing, false)
    assert.equal(rested.snapshot.lastInputAt, undefined)
    assert.deepEqual(rested.cues.map(cue => cue.kind), ['input-rest'])
    assert.equal(rested.nextDeadlineAt, undefined)

    now += GUITAR_INTERACTION.restDelayMs
    assert.deepEqual(machine.advance(5).cues, [], 'the same silence cannot emit another rest')
  })

  it('cancels release immediately when input resumes', () => {
    let now = 8_000
    const machine = new GuitarInteractionMachine(() => now)

    machine.activate(6)
    machine.press(6)

    now += GUITAR_INTERACTION.releaseDelayMs
    machine.advance(6)

    now += 200
    const resumed = machine.press(6)

    assert.equal(resumed.snapshot.releasing, false)
    assert.deepEqual(resumed.cues.map(cue => cue.kind), ['press'])

    const oldRestDeadline = 8_000 + GUITAR_INTERACTION.restDelayMs
    now = oldRestDeadline
    assert.deepEqual(machine.advance(6).cues, [], 'an old deadline cannot end the resumed phrase')
  })

  it('starts a fresh phrase after a long unscheduled gap without replaying a stale rest', () => {
    let now = 10_000
    const machine = new GuitarInteractionMachine(() => now)

    machine.activate(7)
    machine.press(7)

    now += GUITAR_INTERACTION.restDelayMs + 500
    const restarted = machine.press(7)

    assert.equal(restarted.snapshot.interaction, 'engaged')
    assert.equal(restarted.snapshot.activity, 0.05)
    assert.deepEqual(restarted.cues.map(cue => cue.kind), ['press'])
  })

  it('keeps durable revisions separate from transient cue sequences', () => {
    let now = 11_000
    const machine = new GuitarInteractionMachine(() => now)

    assert.equal(machine.activate(8).snapshot.revision, 1)

    const first = machine.press(8)
    now += 100
    const second = machine.press(8)

    assert.equal(first.snapshot.revision, 2)
    assert.equal(second.snapshot.revision, 3)
    assert.deepEqual(first.cues.map(cue => cue.sequence), [1])
    assert.deepEqual(second.cues.map(cue => cue.sequence), [2])

    now += GUITAR_INTERACTION.releaseDelayMs
    const releasing = machine.advance(8)

    assert.equal(releasing.snapshot.revision, 4)
    assert.deepEqual(releasing.cues, [], 'a durable release transition is not a transient cue')

    now = second.snapshot.lastInputAt! + GUITAR_INTERACTION.restDelayMs
    const rested = machine.advance(8)

    assert.equal(rested.snapshot.revision, 5)
    assert.deepEqual(rested.cues.map(cue => cue.sequence), [3])
  })

  it('clears deadlines on deactivation and rejects work from stale parent generations', () => {
    let now = 12_000
    const machine = new GuitarInteractionMachine(() => now)

    machine.activate(10)
    machine.press(10)

    const deactivated = machine.deactivate(11)

    assert.equal(deactivated.snapshot.lifecycle, 'inactive')
    assert.equal(deactivated.snapshot.parentGeneration, 11)
    assert.equal(deactivated.nextDeadlineAt, undefined)

    now += GUITAR_INTERACTION.restDelayMs
    assert.deepEqual(machine.advance(10).cues, [])
    assert.deepEqual(machine.press(10).cues, [])
    assert.equal(machine.activate(10).snapshot.lifecycle, 'inactive')

    const reactivated = machine.activate(12)

    assert.equal(reactivated.snapshot.lifecycle, 'active')
    assert.equal(reactivated.snapshot.interaction, 'autonomous')
    assert.equal(reactivated.snapshot.parentGeneration, 12)
  })
})
