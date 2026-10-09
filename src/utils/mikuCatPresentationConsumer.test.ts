/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type {
  MikuCatEffectRuntime,
  MikuCatEffectSnapshot,
  MikuCatEnteredMode,
  MikuCatPresentationTarget,
  MikuCatPresentationUpdate,
} from './mikuCatPresentationConsumer.ts'

import { MikuCatPresentationConsumer } from './mikuCatPresentationConsumer.ts'

class FakeTarget implements MikuCatPresentationTarget {
  public enteredAnimationMode: MikuCatEnteredMode = 'relaxed'
  public readonly presentationRequests: Array<'release' | 'relaxed' | 'guitar' | 'angry'> = []
  public readonly guitarIntents: unknown[] = []
  public readonly angryIntents: unknown[] = []
  public completionRequests = 0
  private readonly listeners = new Set<(mode: MikuCatEnteredMode) => void>()

  public applyAgentPresentation(mode: 'relaxed' | 'guitar' | 'angry') {
    this.presentationRequests.push(mode)
    return true
  }

  public releaseAgentPresentation() {
    this.presentationRequests.push('release')
    return true
  }

  public setGuitarPerformanceIntent(intent: unknown) {
    this.guitarIntents.push(intent)
    return true
  }

  public setAngryAnimationIntent(intent: unknown) {
    this.angryIntents.push(intent)
    return true
  }

  public playCompletionAnimation() {
    this.completionRequests++
    return true
  }

  public onAnimationModeChange(listener: (mode: MikuCatEnteredMode) => void) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  public enter(mode: MikuCatEnteredMode) {
    this.enteredAnimationMode = mode
    for (const listener of this.listeners) listener(mode)
  }
}

class FakeEffectRuntime implements MikuCatEffectRuntime {
  public readonly snapshots: MikuCatEffectSnapshot[] = []
  private readonly timers = new Map<number, { callback: () => void, delayMs: number }>()
  private nextHandle = 0

  public get activeTimerCount() {
    return this.timers.size
  }

  public get nextDelayMs() {
    return [...this.timers.values()][0]?.delayMs
  }

  public setTimeout(callback: () => void, delayMs: number) {
    const handle = ++this.nextHandle

    this.timers.set(handle, { callback, delayMs })
    return handle
  }

  public clearTimeout(handle: unknown) {
    if (typeof handle === 'number') this.timers.delete(handle)
  }

  public onEffectsChange(snapshot: MikuCatEffectSnapshot) {
    this.snapshots.push(snapshot)
  }

  public fireNext() {
    const entry = this.timers.entries().next().value as
      | [number, { callback: () => void, delayMs: number }]
      | undefined

    assert.ok(entry)
    this.timers.delete(entry[0])
    entry[1].callback()
  }
}

function guitarUpdate(
  generation: number,
  revision: number,
  interaction: 'autonomous' | 'engaged' | 'groove' | 'drive',
  cues: MikuCatPresentationUpdate['cues'] = [],
): MikuCatPresentationUpdate {
  return {
    snapshot: {
      presentation: { owner: 'agent', mode: 'guitar', generation },
      child: {
        mode: 'guitar',
        snapshot: {
          lifecycle: 'active',
          parentGeneration: generation,
          revision,
          interaction,
          activity: interaction === 'autonomous' ? 0 : 0.65,
          releasing: false,
        },
      },
    },
    cues,
  }
}

function angryUpdate(
  generation: number,
  revision: number,
  intensity: 'annoyed' | 'impatient' | 'furious',
  cues: MikuCatPresentationUpdate['cues'] = [],
): MikuCatPresentationUpdate {
  return {
    snapshot: {
      presentation: { owner: 'agent', mode: 'angry', generation },
      child: {
        mode: 'angry',
        snapshot: {
          lifecycle: 'active',
          parentGeneration: generation,
          revision,
          intensity,
        },
      },
    },
    cues,
  }
}

describe('MikuCat presentation consumer', () => {
  it('queues formal guitar cues until the guitar animation actually enters', () => {
    let now = 1_000
    const target = new FakeTarget()
    const consumer = new MikuCatPresentationConsumer(target, () => now, () => 0)

    assert.equal(consumer.apply(guitarUpdate(4, 1, 'engaged', [{
      source: 'guitar',
      cue: {
        kind: 'press',
        sequence: 1,
        parentGeneration: 4,
        activity: 0.25,
        burst: 0.2,
      },
    }])), true)
    assert.deepEqual(target.guitarIntents, [{
      profile: 'engaged',
      activity: 0.65,
      releasing: false,
    }])
    assert.equal(consumer.guitarNotes.length, 0)

    target.enter('guitar')

    assert.equal(consumer.guitarNotes.length, 1)

    now += 100
    assert.equal(consumer.apply(guitarUpdate(4, 2, 'groove', [{
      source: 'guitar',
      cue: {
        kind: 'press',
        sequence: 2,
        parentGeneration: 4,
        activity: 0.65,
        burst: 0.4,
      },
    }])), true)
    assert.deepEqual(target.presentationRequests, ['guitar'])
    assert.deepEqual(target.guitarIntents.at(-1), {
      profile: 'groove',
      activity: 0.65,
      releasing: false,
    })
    assert.deepEqual(consumer.guitarNotes.map(note => note.id), [1, 2])
  })

  it('invalidates the old generation immediately and starts angry effects only on angry entry', () => {
    let now = 2_000
    const target = new FakeTarget()
    const consumer = new MikuCatPresentationConsumer(target, () => now, () => 0)

    consumer.apply(guitarUpdate(7, 1, 'engaged', [{
      source: 'guitar',
      cue: {
        kind: 'press',
        sequence: 1,
        parentGeneration: 7,
        activity: 0.2,
        burst: 0.2,
      },
    }]))
    target.enter('guitar')
    assert.equal(consumer.guitarNotes.length, 1)

    assert.equal(consumer.apply(angryUpdate(8, 1, 'annoyed')), true)
    assert.equal(consumer.guitarNotes.length, 0)
    assert.equal(consumer.angryEffects.length, 0)
    assert.equal(consumer.apply(guitarUpdate(7, 2, 'drive')), false)

    target.enter('angry')

    assert.deepEqual(consumer.angryEffects.map(effect => effect.variant), ['stress-arc'])
    const entryIds = consumer.angryEffects.map(effect => effect.id)

    now += 100
    consumer.apply(angryUpdate(8, 2, 'impatient', [{
      source: 'angry',
      cue: {
        kind: 'anger-escalated',
        intensity: 'impatient',
        sequence: 1,
        parentGeneration: 8,
      },
    }]))

    assert.deepEqual(target.presentationRequests, ['guitar', 'angry'])
    assert.deepEqual(target.angryIntents.at(-1), { intensity: 'impatient' })
    assert.ok(entryIds.every(id => consumer.angryEffects.some(effect => effect.id === id)))
    assert.ok(consumer.angryEffects.some(effect => effect.variant === 'anger-knot'))
  })

  it('clears mode effects and plays one valid all-sessions-done cue only once', () => {
    const target = new FakeTarget()
    const consumer = new MikuCatPresentationConsumer(target, () => 3_000, () => 0)

    consumer.apply(guitarUpdate(10, 1, 'engaged', [{
      source: 'guitar',
      cue: {
        kind: 'press',
        sequence: 1,
        parentGeneration: 10,
        activity: 0.2,
        burst: 0.2,
      },
    }]))
    target.enter('guitar')

    const completed: MikuCatPresentationUpdate = {
      snapshot: {
        presentation: { owner: 'agent', mode: 'relaxed', generation: 11 },
        child: null,
      },
      cues: [{
        source: 'presentation',
        cue: {
          kind: 'all-sessions-done',
          ambientSequence: 80,
          presentationGeneration: 11,
        },
      }],
    }

    assert.equal(consumer.apply(completed), true)
    assert.deepEqual(consumer.guitarNotes, [])
    assert.equal(target.completionRequests, 1)

    assert.equal(consumer.apply(completed), true)
    assert.equal(target.completionRequests, 1)
    assert.deepEqual(target.presentationRequests, ['guitar', 'relaxed'])
  })

  it('releases manual ownership once and rejects a stale generation', () => {
    const target = new FakeTarget()
    const consumer = new MikuCatPresentationConsumer(target)

    consumer.apply(angryUpdate(14, 1, 'annoyed'))
    assert.equal(consumer.apply({
      snapshot: {
        presentation: { owner: 'manual', generation: 15 },
        child: null,
      },
      cues: [],
    }), true)
    assert.equal(consumer.apply(angryUpdate(14, 2, 'furious')), false)
    assert.deepEqual(target.presentationRequests, ['angry', 'release'])
    assert.deepEqual(consumer.angryEffects, [])
  })

  it('publishes effect snapshots and owns one deadline timer for visual expiry', () => {
    let now = 5_000
    const target = new FakeTarget()
    const runtime = new FakeEffectRuntime()
    const consumer = new MikuCatPresentationConsumer(target, () => now, () => 0, runtime)

    consumer.apply(guitarUpdate(20, 1, 'engaged', [{
      source: 'guitar',
      cue: {
        kind: 'press',
        sequence: 1,
        parentGeneration: 20,
        activity: 0.2,
        burst: 0.2,
      },
    }]))
    target.enter('guitar')

    assert.equal(runtime.snapshots.at(-1)?.guitarNotes.length, 1)
    assert.equal(runtime.snapshots.at(-1)?.angryEffects.length, 0)
    assert.equal(runtime.activeTimerCount, 1)
    assert.equal(runtime.nextDelayMs, 820)

    now += 820
    runtime.fireNext()

    assert.equal(runtime.snapshots.at(-1)?.guitarNotes.length, 0)
    assert.equal(runtime.activeTimerCount, 0)

    consumer.dispose()
  })

  it('cancels the old deadline and keeps DOM keys monotonic across generations', () => {
    let now = 7_000
    const target = new FakeTarget()
    const runtime = new FakeEffectRuntime()
    const consumer = new MikuCatPresentationConsumer(target, () => now, () => 0, runtime)

    consumer.apply(guitarUpdate(30, 1, 'engaged', [{
      source: 'guitar',
      cue: {
        kind: 'press',
        sequence: 1,
        parentGeneration: 30,
        activity: 0.2,
        burst: 0.2,
      },
    }]))
    target.enter('guitar')
    const firstId = consumer.guitarNotes[0].id

    now += 100
    consumer.apply(guitarUpdate(31, 1, 'engaged', [{
      source: 'guitar',
      cue: {
        kind: 'press',
        sequence: 1,
        parentGeneration: 31,
        activity: 0.2,
        burst: 0.2,
      },
    }]))

    assert.equal(runtime.activeTimerCount, 1)
    assert.equal(runtime.nextDelayMs, 820)
    assert.notEqual(consumer.guitarNotes[0].id, firstId)

    consumer.dispose()
    assert.equal(runtime.activeTimerCount, 0)
  })
})
