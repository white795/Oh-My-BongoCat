import type {
  AngryWaitingCue,
  AngryWaitingSnapshot,
  AngryWaitingUpdate,
} from './angryWaiting'
import type {
  CharacterPresentationCue,
  CharacterPresentationSnapshot,
  CharacterPresentationTransition,
} from './characterPresentation'
import type {
  GuitarInteractionCue,
  GuitarInteractionSnapshot,
  GuitarInteractionUpdate,
} from './guitarInteraction'

import { AngryWaitingMachine } from './angryWaiting'
import { GuitarInteractionMachine } from './guitarInteraction'

export type CharacterChildState
  = | {
    readonly mode: 'guitar'
    readonly snapshot: GuitarInteractionSnapshot
  }
  | {
    readonly mode: 'angry'
    readonly snapshot: AngryWaitingSnapshot
  }

export interface CharacterStateSnapshot {
  readonly presentation: CharacterPresentationSnapshot
  readonly child: CharacterChildState | null
}

export type CharacterStateCue
  = | {
    readonly source: 'presentation'
    readonly cue: CharacterPresentationCue
  }
  | {
    readonly source: 'guitar'
    readonly cue: GuitarInteractionCue
  }
  | {
    readonly source: 'angry'
    readonly cue: AngryWaitingCue
  }

export interface CharacterStateUpdate {
  readonly snapshot: CharacterStateSnapshot
  readonly cues: readonly CharacterStateCue[]
  readonly nextDeadlineAt: number | undefined
}

export interface CharacterStateDeadlineRuntime {
  readonly setTimeout: (callback: () => void, delayMs: number) => unknown
  readonly clearTimeout: (handle: unknown) => void
  readonly onUpdate: (update: CharacterStateUpdate) => void
}

/**
 * Connects the parent presentation state to exactly one active mode child.
 * It routes semantic input and deadlines without scheduling timers or invoking
 * presentation consumers.
 */
export class CharacterStateCoordinator {
  private readonly guitar: GuitarInteractionMachine
  private readonly angry: AngryWaitingMachine
  private guitarUpdate: GuitarInteractionUpdate
  private angryUpdate: AngryWaitingUpdate
  private deadlineHandle: unknown
  private deadlineScheduled = false
  private scheduledDeadlineAt: number | undefined
  private deadlineToken = 0
  private disposed = false
  private lastNow = Number.NEGATIVE_INFINITY
  private presentation: CharacterPresentationSnapshot = {
    owner: 'manual',
    generation: 0,
  }

  constructor(
    private readonly now: () => number = () => performance.now(),
    private readonly deadlineRuntime?: CharacterStateDeadlineRuntime,
  ) {
    this.guitar = new GuitarInteractionMachine(this.now)
    this.angry = new AngryWaitingMachine(this.now)
    this.guitarUpdate = inactiveGuitarUpdate(this.guitar.snapshot)
    this.angryUpdate = inactiveAngryUpdate(this.angry.snapshot)
  }

  public get snapshot(): CharacterStateSnapshot {
    return {
      presentation: { ...this.presentation },
      child: this.currentChild,
    }
  }

  public applyPresentation(transition: CharacterPresentationTransition): CharacterStateUpdate {
    const incoming = transition.current

    if (incoming.generation < this.presentation.generation) return this.finish(this.result())
    if (
      incoming.generation === this.presentation.generation
      && !samePresentation(incoming, this.presentation)
    ) {
      return this.finish(this.result())
    }

    if (incoming.generation > this.presentation.generation) {
      this.presentation = { ...incoming }
      this.reconcileChildren()
    }

    const cues = transition.cues
      .filter(cue => cue.presentationGeneration === this.presentation.generation)
      .map<CharacterStateCue>(cue => ({
        source: 'presentation',
        cue: { ...cue },
      }))

    return this.finish(this.result(cues))
  }

  public press(parentGeneration: number): CharacterStateUpdate {
    if (!this.isActiveMode('guitar', parentGeneration)) return this.finish(this.result())

    this.guitarUpdate = this.guitar.press(parentGeneration)

    return this.finish(this.result(this.guitarUpdate.cues.map(cue => ({
      source: 'guitar',
      cue,
    }))))
  }

  public advance(parentGeneration: number): CharacterStateUpdate {
    if (this.isActiveMode('guitar', parentGeneration)) {
      this.guitarUpdate = this.guitar.advance(parentGeneration)

      return this.finish(this.result(this.guitarUpdate.cues.map(cue => ({
        source: 'guitar',
        cue,
      }))))
    }

    if (this.isActiveMode('angry', parentGeneration)) {
      this.angryUpdate = this.angry.advance(parentGeneration)

      return this.finish(this.result(this.angryUpdate.cues.map(cue => ({
        source: 'angry',
        cue,
      }))))
    }

    return this.finish(this.result())
  }

  public dispose() {
    if (this.disposed) return

    this.disposed = true
    this.cancelDeadline()
  }

  private reconcileChildren() {
    const generation = this.presentation.generation

    if (this.presentation.owner === 'agent' && this.presentation.mode === 'guitar') {
      this.angryUpdate = this.angry.deactivate(generation)
      this.guitarUpdate = this.guitar.activate(generation)
      return
    }

    if (this.presentation.owner === 'agent' && this.presentation.mode === 'angry') {
      this.guitarUpdate = this.guitar.deactivate(generation)
      this.angryUpdate = this.angry.activate(generation)
      return
    }

    this.guitarUpdate = this.guitar.deactivate(generation)
    this.angryUpdate = this.angry.deactivate(generation)
  }

  private isActiveMode(mode: 'guitar' | 'angry', parentGeneration: number): boolean {
    return this.presentation.owner === 'agent'
      && this.presentation.mode === mode
      && this.presentation.generation === parentGeneration
  }

  private get currentChild(): CharacterChildState | null {
    if (this.presentation.owner !== 'agent') return null

    if (this.presentation.mode === 'guitar') {
      return {
        mode: 'guitar',
        snapshot: { ...this.guitarUpdate.snapshot },
      }
    }
    if (this.presentation.mode === 'angry') {
      return {
        mode: 'angry',
        snapshot: { ...this.angryUpdate.snapshot },
      }
    }

    return null
  }

  private get nextDeadlineAt(): number | undefined {
    if (this.presentation.owner !== 'agent') return
    if (this.presentation.mode === 'guitar') return this.guitarUpdate.nextDeadlineAt
    if (this.presentation.mode === 'angry') return this.angryUpdate.nextDeadlineAt
  }

  private result(cues: readonly CharacterStateCue[] = []): CharacterStateUpdate {
    return {
      snapshot: this.snapshot,
      cues: cues.map(cloneCue),
      nextDeadlineAt: this.nextDeadlineAt,
    }
  }

  private finish(update: CharacterStateUpdate): CharacterStateUpdate {
    this.syncDeadline(update.nextDeadlineAt)
    return update
  }

  private syncDeadline(deadlineAt: number | undefined) {
    if (!this.deadlineRuntime || this.disposed) return
    if (deadlineAt === undefined) {
      this.cancelDeadline()
      return
    }
    if (this.deadlineScheduled && deadlineAt === this.scheduledDeadlineAt) return

    this.cancelDeadline()

    const generation = this.presentation.generation
    const token = ++this.deadlineToken
    const delayMs = Math.max(0, deadlineAt - this.readNow())

    this.scheduledDeadlineAt = deadlineAt
    this.deadlineScheduled = true
    this.deadlineHandle = this.deadlineRuntime.setTimeout(() => {
      if (this.disposed || token !== this.deadlineToken) return

      this.deadlineHandle = undefined
      this.deadlineScheduled = false
      this.scheduledDeadlineAt = undefined

      const update = this.advance(generation)

      this.deadlineRuntime?.onUpdate(update)
    }, delayMs)
  }

  private cancelDeadline() {
    ++this.deadlineToken

    if (this.deadlineRuntime && this.deadlineScheduled) {
      this.deadlineRuntime.clearTimeout(this.deadlineHandle)
    }

    this.deadlineHandle = undefined
    this.deadlineScheduled = false
    this.scheduledDeadlineAt = undefined
  }

  private readNow(): number {
    const candidate = this.now()

    if (Number.isFinite(candidate)) this.lastNow = Math.max(this.lastNow, candidate)
    if (!Number.isFinite(this.lastNow)) this.lastNow = 0

    return this.lastNow
  }
}

function cloneCue(item: CharacterStateCue): CharacterStateCue {
  if (item.source === 'presentation') {
    return { source: item.source, cue: { ...item.cue } }
  }
  if (item.source === 'guitar') {
    return { source: item.source, cue: { ...item.cue } }
  }

  return { source: item.source, cue: { ...item.cue } }
}

function samePresentation(
  left: CharacterPresentationSnapshot,
  right: CharacterPresentationSnapshot,
): boolean {
  return left.owner === right.owner
    && left.generation === right.generation
    && (
      left.owner === 'manual'
      || (right.owner === 'agent' && left.mode === right.mode)
    )
}

function inactiveGuitarUpdate(snapshot: GuitarInteractionSnapshot): GuitarInteractionUpdate {
  return { snapshot, cues: [], nextDeadlineAt: undefined }
}

function inactiveAngryUpdate(snapshot: AngryWaitingSnapshot): AngryWaitingUpdate {
  return { snapshot, cues: [], nextDeadlineAt: undefined }
}
