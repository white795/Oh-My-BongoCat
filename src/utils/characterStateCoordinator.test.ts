/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type {
  CharacterPresentationCue,
  CharacterPresentationSnapshot,
  CharacterPresentationTransition,
} from './characterPresentation.ts'
import type {
  CharacterStateDeadlineRuntime,
  CharacterStateUpdate,
} from './characterStateCoordinator.ts'

import { ANGRY_WAITING } from './angryWaiting.ts'
import { CharacterStateCoordinator } from './characterStateCoordinator.ts'
import { GUITAR_INTERACTION } from './guitarInteraction.ts'

describe('character state coordinator', () => {
  it('activates guitar and routes press cues only to the guitar child', () => {
    let now = 1_000
    const coordinator = new CharacterStateCoordinator(() => now)

    const activated = coordinator.applyPresentation(change(
      manual(0),
      agent('guitar', 1),
    ))

    assert.deepEqual(activated.snapshot.presentation, agent('guitar', 1))
    assert.equal(activated.snapshot.child?.mode, 'guitar')
    assert.equal(activated.snapshot.child?.snapshot.lifecycle, 'active')
    assert.equal(activated.nextDeadlineAt, undefined)

    now += 10
    const pressed = coordinator.press(1)

    assert.equal(pressed.snapshot.child?.mode, 'guitar')
    assert.deepEqual(pressed.cues.map(item => [item.source, item.cue.kind]), [
      ['guitar', 'press'],
    ])
    assert.equal(pressed.nextDeadlineAt, now + GUITAR_INTERACTION.releaseDelayMs)
  })

  it('switches from guitar to angry and rejects old input and deadlines', () => {
    let now = 2_000
    const coordinator = new CharacterStateCoordinator(() => now)

    coordinator.applyPresentation(change(manual(0), agent('guitar', 1)))
    coordinator.press(1)

    now += 100
    const angry = coordinator.applyPresentation(change(
      agent('guitar', 1),
      agent('angry', 2),
    ))

    assert.equal(angry.snapshot.child?.mode, 'angry')
    assert.equal(angry.snapshot.child?.snapshot.lifecycle, 'active')
    if (angry.snapshot.child?.mode !== 'angry') assert.fail('angry child should be active')
    assert.equal(angry.snapshot.child.snapshot.intensity, 'annoyed')
    assert.equal(angry.nextDeadlineAt, now + ANGRY_WAITING.impatientAfterMs)

    assert.deepEqual(coordinator.press(2).cues, [], 'keyboard input is ignored outside guitar')

    now += ANGRY_WAITING.impatientAfterMs
    assert.deepEqual(coordinator.advance(1).cues, [], 'old guitar deadline cannot affect angry')

    const impatient = coordinator.advance(2)
    assert.equal(impatient.snapshot.child?.mode, 'angry')
    assert.deepEqual(impatient.cues.map(item => [item.source, item.cue.kind]), [
      ['angry', 'anger-escalated'],
    ])
  })

  it('does not reset angry timing for a repeated parent snapshot', () => {
    let now = 3_000
    const coordinator = new CharacterStateCoordinator(() => now)
    const current = agent('angry', 3)

    const activated = coordinator.applyPresentation(change(manual(0), current))
    const originalDeadline = activated.nextDeadlineAt

    now += ANGRY_WAITING.impatientAfterMs - 100
    const repeated = coordinator.applyPresentation(unchanged(current))

    assert.equal(repeated.nextDeadlineAt, originalDeadline)
    assert.deepEqual(repeated.cues, [])

    now += 100
    const impatient = coordinator.advance(3)
    assert.equal(impatient.snapshot.child?.mode, 'angry')
    if (impatient.snapshot.child?.mode !== 'angry') assert.fail('angry child should be active')
    assert.equal(impatient.snapshot.child.snapshot.lifecycle, 'active')
    if (impatient.snapshot.child.snapshot.lifecycle !== 'active') assert.fail('waiting should remain active')
    assert.equal(impatient.snapshot.child.snapshot.intensity, 'impatient')
  })

  it('starts a fresh guitar child and discards the previous angry deadline', () => {
    let now = 4_000
    const coordinator = new CharacterStateCoordinator(() => now)

    coordinator.applyPresentation(change(manual(0), agent('angry', 4)))
    now += 500
    const guitar = coordinator.applyPresentation(change(
      agent('angry', 4),
      agent('guitar', 5),
    ))

    assert.equal(guitar.snapshot.child?.mode, 'guitar')
    assert.equal(guitar.snapshot.child?.snapshot.lifecycle, 'active')
    assert.equal(guitar.nextDeadlineAt, undefined)

    now = 4_000 + ANGRY_WAITING.furiousAfterMs
    const stale = coordinator.advance(4)

    assert.equal(stale.snapshot.child?.mode, 'guitar')
    assert.deepEqual(stale.cues, [])
    assert.equal(stale.nextDeadlineAt, undefined)
  })

  it('deactivates both children in relaxed or manual ownership', () => {
    const coordinator = new CharacterStateCoordinator(() => 5_000)

    coordinator.applyPresentation(change(manual(0), agent('guitar', 6)))
    const relaxed = coordinator.applyPresentation(change(
      agent('guitar', 6),
      agent('relaxed', 7),
    ))

    assert.equal(relaxed.snapshot.child, null)
    assert.equal(relaxed.nextDeadlineAt, undefined)
    assert.deepEqual(coordinator.press(7).cues, [])

    const released = coordinator.applyPresentation(change(
      agent('relaxed', 7),
      manual(8),
    ))

    assert.equal(released.snapshot.child, null)
    assert.equal(released.nextDeadlineAt, undefined)
  })

  it('forwards parent cues without turning them into child cues', () => {
    const coordinator = new CharacterStateCoordinator(() => 6_000)
    const previous = agent('guitar', 9)
    const current = agent('relaxed', 10)
    const cue: CharacterPresentationCue = {
      kind: 'all-sessions-done',
      ambientSequence: 42,
      presentationGeneration: 10,
    }

    coordinator.applyPresentation(change(manual(0), previous))
    const completed = coordinator.applyPresentation(change(previous, current, [cue]))

    assert.equal(completed.snapshot.child, null)
    assert.deepEqual(completed.cues, [{ source: 'presentation', cue }])
  })

  it('wakes angry only at semantic deadlines and schedules the next threshold', () => {
    let now = 7_000
    const deadlines = new FakeDeadlines()
    const coordinator = new CharacterStateCoordinator(() => now, deadlines.runtime)

    coordinator.applyPresentation(change(manual(0), agent('angry', 11)))

    assert.equal(deadlines.onlyDelay, ANGRY_WAITING.impatientAfterMs)

    now += ANGRY_WAITING.impatientAfterMs
    deadlines.fireOnly()

    assert.equal(deadlines.updates.at(-1)?.snapshot.child?.mode, 'angry')
    assert.deepEqual(deadlines.updates.at(-1)?.cues.map(item => item.cue.kind), [
      'anger-escalated',
    ])
    assert.equal(
      deadlines.onlyDelay,
      ANGRY_WAITING.furiousAfterMs - ANGRY_WAITING.impatientAfterMs,
    )

    now = 7_000 + ANGRY_WAITING.furiousAfterMs
    deadlines.fireOnly()

    const furious = deadlines.updates.at(-1)
    assert.equal(furious?.snapshot.child?.mode, 'angry')
    if (furious?.snapshot.child?.mode !== 'angry') assert.fail('angry child should be active')
    assert.equal(furious.snapshot.child.snapshot.lifecycle, 'active')
    if (furious.snapshot.child.snapshot.lifecycle !== 'active') assert.fail('waiting should remain active')
    assert.equal(furious.snapshot.child.snapshot.intensity, 'furious')
    assert.equal(deadlines.pendingCount, 0)
  })

  it('converges directly when an angry deadline wakes late', () => {
    let now = 8_000
    const deadlines = new FakeDeadlines()
    const coordinator = new CharacterStateCoordinator(() => now, deadlines.runtime)

    coordinator.applyPresentation(change(manual(0), agent('angry', 12)))
    now += ANGRY_WAITING.furiousAfterMs
    deadlines.fireOnly()

    const update = deadlines.updates.at(-1)
    assert.equal(update?.snapshot.child?.mode, 'angry')
    if (update?.snapshot.child?.mode !== 'angry') assert.fail('angry child should be active')
    assert.equal(update.snapshot.child.snapshot.lifecycle, 'active')
    if (update.snapshot.child.snapshot.lifecycle !== 'active') assert.fail('waiting should remain active')
    assert.equal(update.snapshot.child.snapshot.intensity, 'furious')
    assert.deepEqual(update.cues.map(item => [item.source, item.cue.kind]), [
      ['angry', 'anger-escalated'],
    ])
    assert.equal(deadlines.pendingCount, 0)
  })

  it('replaces guitar deadlines on input and advances release and rest automatically', () => {
    let now = 9_000
    const deadlines = new FakeDeadlines()
    const coordinator = new CharacterStateCoordinator(() => now, deadlines.runtime)

    coordinator.applyPresentation(change(manual(0), agent('guitar', 13)))
    coordinator.press(13)
    const firstTimer = deadlines.onlyTimer

    assert.equal(firstTimer.delayMs, GUITAR_INTERACTION.releaseDelayMs)

    now += 100
    coordinator.press(13)

    assert.equal(firstTimer.cleared, true)
    assert.equal(deadlines.onlyDelay, GUITAR_INTERACTION.releaseDelayMs)

    now += GUITAR_INTERACTION.releaseDelayMs
    deadlines.fireOnly()

    const releasing = deadlines.updates.at(-1)
    assert.equal(releasing?.snapshot.child?.mode, 'guitar')
    if (releasing?.snapshot.child?.mode !== 'guitar') assert.fail('guitar child should be active')
    assert.equal(releasing.snapshot.child.snapshot.releasing, true)
    assert.equal(
      deadlines.onlyDelay,
      GUITAR_INTERACTION.restDelayMs - GUITAR_INTERACTION.releaseDelayMs,
    )

    now += GUITAR_INTERACTION.restDelayMs - GUITAR_INTERACTION.releaseDelayMs
    deadlines.fireOnly()

    assert.deepEqual(deadlines.updates.at(-1)?.cues.map(item => item.cue.kind), ['input-rest'])
    assert.equal(deadlines.pendingCount, 0)
  })

  it('cancels deadlines and ignores callbacks retained across a mode switch or dispose', () => {
    let now = 10_000
    const deadlines = new FakeDeadlines()
    const coordinator = new CharacterStateCoordinator(() => now, deadlines.runtime)

    coordinator.applyPresentation(change(manual(0), agent('angry', 14)))
    const angryTimer = deadlines.onlyTimer

    coordinator.applyPresentation(change(agent('angry', 14), agent('guitar', 15)))

    assert.equal(angryTimer.cleared, true)
    assert.equal(deadlines.pendingCount, 0)

    now += ANGRY_WAITING.furiousAfterMs
    angryTimer.callback()

    assert.equal(deadlines.updates.length, 0)
    assert.equal(coordinator.snapshot.child?.mode, 'guitar')

    coordinator.press(15)
    const guitarTimer = deadlines.onlyTimer
    coordinator.dispose()

    assert.equal(guitarTimer.cleared, true)
    guitarTimer.callback()
    assert.equal(deadlines.updates.length, 0)
  })
})

interface FakeTimer {
  readonly id: number
  readonly callback: () => void
  readonly delayMs: number
  cleared: boolean
}

class FakeDeadlines {
  public readonly updates: CharacterStateUpdate[] = []
  private readonly timers = new Map<number, FakeTimer>()
  private sequence = 0

  public readonly runtime: CharacterStateDeadlineRuntime = {
    setTimeout: (callback, delayMs) => {
      const timer: FakeTimer = {
        id: ++this.sequence,
        callback,
        delayMs,
        cleared: false,
      }

      this.timers.set(timer.id, timer)
      return timer
    },
    clearTimeout: (handle) => {
      const timer = handle as FakeTimer

      timer.cleared = true
      this.timers.delete(timer.id)
    },
    onUpdate: update => this.updates.push(update),
  }

  public get pendingCount(): number {
    return this.timers.size
  }

  public get onlyTimer(): FakeTimer {
    assert.equal(this.timers.size, 1)
    return [...this.timers.values()][0]!
  }

  public get onlyDelay(): number {
    return this.onlyTimer.delayMs
  }

  public fireOnly() {
    const timer = this.onlyTimer

    this.timers.delete(timer.id)
    timer.callback()
  }
}

function manual(generation: number): CharacterPresentationSnapshot {
  return { owner: 'manual', generation }
}

function agent(
  mode: 'relaxed' | 'guitar' | 'angry',
  generation: number,
): CharacterPresentationSnapshot {
  return { owner: 'agent', mode, generation }
}

function change(
  previous: CharacterPresentationSnapshot,
  current: CharacterPresentationSnapshot,
  cues: readonly CharacterPresentationCue[] = [],
): CharacterPresentationTransition {
  return {
    changed: true,
    previous,
    current,
    cues,
  }
}

function unchanged(current: CharacterPresentationSnapshot): CharacterPresentationTransition {
  return {
    changed: false,
    previous: current,
    current,
    cues: [],
  }
}
