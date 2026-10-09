import type { AngryAnimationIntent } from './angryAnimation'
import type {
  AngryEffectCue,
  AngryEffectInstance,
  AngryEffectStateSnapshot,
} from './angryEffectEngine'
import type { GuitarEffectCue, GuitarNote } from './guitarEffectEngine'
import type { GuitarPerformanceIntent } from './guitarPerformance'

import { AngryEffectEngine } from './angryEffectEngine'
import { GuitarEffectEngine } from './guitarEffectEngine'

export type MikuCatPresentationMode = 'relaxed' | 'guitar' | 'angry'
export type MikuCatEnteredMode = MikuCatPresentationMode | 'completion'

export type MikuCatPresentationSnapshot
  = | {
    readonly owner: 'manual'
    readonly generation: number
  }
  | {
    readonly owner: 'agent'
    readonly mode: MikuCatPresentationMode
    readonly generation: number
  }

export interface MikuCatGuitarSnapshot {
  readonly lifecycle: 'inactive' | 'active'
  readonly parentGeneration: number | null
  readonly revision: number
  readonly interaction: GuitarPerformanceIntent['profile']
  readonly activity: number
  readonly releasing: boolean
}

export type MikuCatChildState
  = | {
    readonly mode: 'guitar'
    readonly snapshot: MikuCatGuitarSnapshot
  }
  | {
    readonly mode: 'angry'
    readonly snapshot: AngryEffectStateSnapshot
  }

export interface MikuCatCompletionCue {
  readonly kind: 'all-sessions-done'
  readonly ambientSequence: number
  readonly presentationGeneration: number
}

export type MikuCatPresentationCue
  = | {
    readonly source: 'presentation'
    readonly cue: MikuCatCompletionCue
  }
  | {
    readonly source: 'guitar'
    readonly cue: GuitarEffectCue
  }
  | {
    readonly source: 'angry'
    readonly cue: AngryEffectCue
  }

/**
 * Structural view of CharacterStateUpdate. The state-machine object is
 * assignable to this port without importing or duplicating its reducers,
 * input windows, waiting thresholds or deadline scheduler.
 */
export interface MikuCatPresentationUpdate {
  readonly snapshot: {
    readonly presentation: MikuCatPresentationSnapshot
    readonly child: MikuCatChildState | null
  }
  readonly cues: readonly MikuCatPresentationCue[]
}

export interface MikuCatPresentationTarget {
  readonly enteredAnimationMode: MikuCatEnteredMode
  applyAgentPresentation: (mode: MikuCatPresentationMode) => boolean
  releaseAgentPresentation: () => boolean
  setGuitarPerformanceIntent: (intent: GuitarPerformanceIntent) => boolean
  setAngryAnimationIntent: (intent: AngryAnimationIntent) => boolean
  playCompletionAnimation: () => boolean
  onAnimationModeChange: (listener: (mode: MikuCatEnteredMode) => void) => () => void
}

export interface MikuCatEffectSnapshot {
  readonly guitarNotes: readonly GuitarNote[]
  readonly angryEffects: readonly AngryEffectInstance[]
  readonly nextDeadlineAt: number | undefined
}

export interface MikuCatEffectRuntime {
  readonly setTimeout: (callback: () => void, delayMs: number) => unknown
  readonly clearTimeout: (handle: unknown) => void
  readonly onEffectsChange: (snapshot: MikuCatEffectSnapshot) => void
}

/**
 * Fans one state-machine update out to independent animation and effect
 * consumers. It owns generation/revision delivery only; semantic thresholds
 * remain entirely upstream.
 */
export class MikuCatPresentationConsumer {
  private readonly guitarEffect: GuitarEffectEngine
  private readonly angryEffect: AngryEffectEngine
  private readonly unsubscribeAnimationMode: () => void
  private latestGeneration = Number.NEGATIVE_INFINITY
  private appliedGeneration = Number.NEGATIVE_INFINITY
  private childRevision = Number.NEGATIVE_INFINITY
  private lastCompletionAmbientSequence = Number.NEGATIVE_INFINITY
  private desiredPresentation?: MikuCatPresentationSnapshot
  private desiredChild: MikuCatChildState | null = null
  private pendingCues: MikuCatPresentationCue[] = []
  private enteredMode: MikuCatEnteredMode
  private lastEffectSignature: string | undefined
  private effectDeadlineHandle: unknown
  private scheduledEffectDeadlineAt: number | undefined
  private effectDeadlineToken = 0
  private disposed = false

  constructor(
    private readonly target: MikuCatPresentationTarget,
    private readonly now: () => number = Date.now,
    random: () => number = Math.random,
    private readonly effectRuntime?: MikuCatEffectRuntime,
  ) {
    this.guitarEffect = new GuitarEffectEngine(now, random)
    this.angryEffect = new AngryEffectEngine(now)
    this.enteredMode = target.enteredAnimationMode
    this.unsubscribeAnimationMode = target.onAnimationModeChange((mode) => {
      this.enteredMode = mode
      this.reconcileEffects()
      this.finishEffects()
    })
    this.finishEffects()
  }

  public get guitarNotes(): readonly GuitarNote[] {
    return this.guitarEffect.snapshot
  }

  public get angryEffects(): readonly AngryEffectInstance[] {
    return this.angryEffect.snapshot
  }

  public get nextEffectDeadlineAt(): number | undefined {
    const deadlines = [
      this.guitarEffect.nextDeadlineAt,
      this.angryEffect.nextDeadlineAt,
    ].filter((deadline): deadline is number => deadline !== undefined)

    return deadlines.length > 0 ? Math.min(...deadlines) : undefined
  }

  public get effectSnapshot(): MikuCatEffectSnapshot {
    return {
      guitarNotes: this.guitarNotes,
      angryEffects: this.angryEffects,
      nextDeadlineAt: this.nextEffectDeadlineAt,
    }
  }

  public apply(update: MikuCatPresentationUpdate): boolean {
    const presentation = update.snapshot.presentation
    const generation = presentation.generation

    if (!Number.isFinite(generation) || generation < this.latestGeneration) return false
    if (
      generation === this.latestGeneration
      && this.desiredPresentation
      && !samePresentation(this.desiredPresentation, presentation)
    ) {
      return false
    }

    const isNewGeneration = generation > this.latestGeneration
    let childChanged = false

    if (isNewGeneration) {
      this.invalidatePreviousMode(presentation, generation)
      this.latestGeneration = generation
      this.desiredPresentation = clonePresentation(presentation)
      this.desiredChild = null
      this.childRevision = Number.NEGATIVE_INFINITY
      this.pendingCues = []
    }

    const incomingChild = update.snapshot.child
    if (
      isChildForPresentation(incomingChild, presentation)
      && incomingChild.snapshot.revision >= this.childRevision
    ) {
      childChanged = incomingChild.snapshot.revision > this.childRevision
        || this.desiredChild === null
      this.desiredChild = cloneChild(incomingChild)
      this.childRevision = incomingChild.snapshot.revision
    } else if (presentation.owner === 'manual' || presentation.mode === 'relaxed') {
      this.desiredChild = null
      this.childRevision = Number.NEGATIVE_INFINITY
    }

    this.pendingCues.push(...update.cues.map(cloneCue))

    if (childChanged) this.applyAnimationIntent()

    if (generation > this.appliedGeneration) {
      const accepted = presentation.owner === 'agent'
        ? this.target.applyAgentPresentation(presentation.mode)
        : this.target.releaseAgentPresentation()

      if (!accepted) {
        this.finishEffects()
        return false
      }
      this.appliedGeneration = generation
    }

    this.consumeCompletionCues()
    this.reconcileEffects()
    this.finishEffects()
    return true
  }

  public advanceEffects(now = this.now()) {
    this.guitarEffect.advance(now)
    this.angryEffect.advance(now)
    this.finishEffects()
  }

  public dispose() {
    if (this.disposed) return

    this.disposed = true
    this.unsubscribeAnimationMode()
    this.cancelEffectDeadline()
  }

  private invalidatePreviousMode(
    nextPresentation: MikuCatPresentationSnapshot,
    nextGeneration: number,
  ) {
    if (this.desiredPresentation?.owner !== 'agent') return
    if (
      nextPresentation.owner === 'agent'
      && nextPresentation.mode === this.desiredPresentation.mode
    ) {
      return
    }

    if (this.desiredPresentation.mode === 'guitar') {
      this.guitarEffect.deactivate(nextGeneration)
    } else if (this.desiredPresentation.mode === 'angry') {
      this.angryEffect.deactivate(nextGeneration)
    }
  }

  private applyAnimationIntent() {
    const child = this.desiredChild

    if (!child || child.snapshot.lifecycle !== 'active') return

    if (child.mode === 'guitar') {
      this.target.setGuitarPerformanceIntent({
        profile: child.snapshot.interaction,
        activity: child.snapshot.activity,
        releasing: child.snapshot.releasing,
      })
      return
    }

    this.target.setAngryAnimationIntent({ intensity: child.snapshot.intensity })
  }

  private consumeCompletionCues() {
    const presentation = this.desiredPresentation
    if (
      !presentation
      || presentation.owner !== 'agent'
      || presentation.mode !== 'relaxed'
      || this.appliedGeneration !== presentation.generation
    ) {
      this.pendingCues = this.pendingCues.filter(item => item.source !== 'presentation')
      return
    }

    const retained: MikuCatPresentationCue[] = []

    for (const item of this.pendingCues) {
      if (item.source !== 'presentation') {
        retained.push(item)
        continue
      }

      const cue = item.cue
      if (
        cue.presentationGeneration !== presentation.generation
        || !Number.isFinite(cue.ambientSequence)
        || cue.ambientSequence <= this.lastCompletionAmbientSequence
      ) {
        continue
      }

      if (this.target.playCompletionAnimation()) {
        this.lastCompletionAmbientSequence = cue.ambientSequence
      } else {
        retained.push(item)
      }
    }

    this.pendingCues = retained
  }

  private reconcileEffects() {
    const presentation = this.desiredPresentation
    if (
      !presentation
      || this.appliedGeneration !== presentation.generation
      || presentation.owner !== 'agent'
      || this.enteredMode !== presentation.mode
    ) {
      return
    }

    if (presentation.mode === 'guitar') {
      const child = this.desiredChild
      if (
        child?.mode !== 'guitar'
        || child.snapshot.lifecycle !== 'active'
        || child.snapshot.parentGeneration !== presentation.generation
      ) {
        return
      }

      this.guitarEffect.activate(presentation.generation)
      this.consumeGuitarCues(presentation.generation)
      return
    }

    if (presentation.mode === 'angry') {
      const child = this.desiredChild
      if (
        child?.mode !== 'angry'
        || child.snapshot.lifecycle !== 'active'
        || child.snapshot.parentGeneration !== presentation.generation
      ) {
        return
      }

      this.angryEffect.applySnapshot(child.snapshot)
      this.consumeAngryCues(presentation.generation)
      return
    }

    this.pendingCues = this.pendingCues.filter(item => item.source === 'presentation')
  }

  private consumeGuitarCues(generation: number) {
    const retained: MikuCatPresentationCue[] = []

    for (const item of this.pendingCues) {
      if (item.source === 'guitar') {
        if (item.cue.parentGeneration === generation) this.guitarEffect.consume(item.cue)
        continue
      }
      if (item.source === 'presentation') retained.push(item)
    }

    this.pendingCues = retained
  }

  private consumeAngryCues(generation: number) {
    const retained: MikuCatPresentationCue[] = []

    for (const item of this.pendingCues) {
      if (item.source === 'angry') {
        if (item.cue.parentGeneration === generation) this.angryEffect.consume(item.cue)
        continue
      }
      if (item.source === 'presentation') retained.push(item)
    }

    this.pendingCues = retained
  }

  private finishEffects() {
    if (this.disposed || !this.effectRuntime) return

    const snapshot = this.effectSnapshot
    const signature = JSON.stringify(snapshot)

    if (signature !== this.lastEffectSignature) {
      this.lastEffectSignature = signature
      this.effectRuntime.onEffectsChange(snapshot)
    }

    this.scheduleEffectDeadline(snapshot.nextDeadlineAt)
  }

  private scheduleEffectDeadline(deadlineAt: number | undefined) {
    if (!this.effectRuntime) return
    if (
      deadlineAt !== undefined
      && deadlineAt === this.scheduledEffectDeadlineAt
      && this.effectDeadlineHandle !== undefined
    ) {
      return
    }

    this.cancelEffectDeadline()
    if (deadlineAt === undefined) return

    const currentNow = this.now()
    const delayMs = Math.max(0, deadlineAt - (Number.isFinite(currentNow) ? currentNow : 0))
    const token = ++this.effectDeadlineToken

    this.scheduledEffectDeadlineAt = deadlineAt
    this.effectDeadlineHandle = this.effectRuntime.setTimeout(() => {
      if (this.disposed || token !== this.effectDeadlineToken) return

      this.effectDeadlineHandle = undefined
      this.scheduledEffectDeadlineAt = undefined
      this.advanceEffects()
    }, delayMs)
  }

  private cancelEffectDeadline() {
    this.effectDeadlineToken++

    if (this.effectDeadlineHandle !== undefined) {
      this.effectRuntime?.clearTimeout(this.effectDeadlineHandle)
    }

    this.effectDeadlineHandle = undefined
    this.scheduledEffectDeadlineAt = undefined
  }
}

function samePresentation(
  left: MikuCatPresentationSnapshot,
  right: MikuCatPresentationSnapshot,
) {
  return left.owner === right.owner
    && left.generation === right.generation
    && (
      left.owner === 'manual'
      || (right.owner === 'agent' && left.mode === right.mode)
    )
}

function isChildForPresentation(
  child: MikuCatChildState | null,
  presentation: MikuCatPresentationSnapshot,
): child is MikuCatChildState {
  return presentation.owner === 'agent'
    && presentation.mode !== 'relaxed'
    && child?.mode === presentation.mode
    && child.snapshot.lifecycle === 'active'
    && child.snapshot.parentGeneration === presentation.generation
    && Number.isFinite(child.snapshot.revision)
}

function clonePresentation(snapshot: MikuCatPresentationSnapshot): MikuCatPresentationSnapshot {
  return snapshot.owner === 'manual'
    ? { owner: 'manual', generation: snapshot.generation }
    : { owner: 'agent', mode: snapshot.mode, generation: snapshot.generation }
}

function cloneChild(child: MikuCatChildState): MikuCatChildState {
  return child.mode === 'guitar'
    ? { mode: 'guitar', snapshot: { ...child.snapshot } }
    : { mode: 'angry', snapshot: { ...child.snapshot } }
}

function cloneCue(cue: MikuCatPresentationCue): MikuCatPresentationCue {
  if (cue.source === 'presentation') return { source: 'presentation', cue: { ...cue.cue } }
  if (cue.source === 'guitar') return { source: 'guitar', cue: { ...cue.cue } }
  return { source: 'angry', cue: { ...cue.cue } }
}
