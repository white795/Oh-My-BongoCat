export type AgentSessionState = 'idle' | 'working' | 'waiting' | 'done'
export type CharacterMode = 'relaxed' | 'guitar' | 'angry'

export interface CharacterAmbientSession {
  readonly sessionId: string
  readonly state: AgentSessionState
}

export interface CharacterAmbientSnapshot {
  readonly sequence: number
  readonly sessions: readonly CharacterAmbientSession[]
}

export type CharacterPresentationSnapshot
  = | {
    readonly owner: 'manual'
    readonly generation: number
  }
  | {
    readonly owner: 'agent'
    readonly mode: CharacterMode
    readonly generation: number
  }

export interface CharacterPresentationCue {
  readonly kind: 'all-sessions-done'
  readonly ambientSequence: number
  readonly presentationGeneration: number
}

export interface CharacterPresentationTransition {
  readonly changed: boolean
  readonly previous: CharacterPresentationSnapshot
  readonly current: CharacterPresentationSnapshot
  readonly cues: readonly CharacterPresentationCue[]
}

/**
 * Reduces the independent Agent sessions into one owner and one character mode.
 * It deliberately does not know about Live2D expressions, animation, or effects.
 */
export class CharacterPresentationReducer {
  private agentEnabled = false
  private ambientSequence = -1
  private sessions: CharacterAmbientSession[] = []
  private current: CharacterPresentationSnapshot = {
    owner: 'manual',
    generation: 0,
  }

  public get snapshot(): CharacterPresentationSnapshot {
    return this.current
  }

  public setAgentEnabled(enabled: boolean): CharacterPresentationTransition {
    this.agentEnabled = enabled

    return this.reconcile()
  }

  public applyAmbient(snapshot: CharacterAmbientSnapshot): CharacterPresentationTransition {
    if (snapshot.sequence <= this.ambientSequence) return this.unchanged()

    const previousSessions = this.sessions

    this.ambientSequence = snapshot.sequence
    this.sessions = snapshot.sessions.map(session => ({
      sessionId: session.sessionId,
      state: session.state,
    }))

    const transition = this.reconcile()

    if (
      !this.agentEnabled
      || transition.current.owner !== 'agent'
      || !didAllSessionsComplete(previousSessions, this.sessions)
    ) {
      return transition
    }

    return {
      ...transition,
      cues: [{
        kind: 'all-sessions-done',
        ambientSequence: snapshot.sequence,
        presentationGeneration: transition.current.generation,
      }],
    }
  }

  private reconcile(): CharacterPresentationTransition {
    const previous = this.current
    const mode = this.agentEnabled ? deriveCharacterMode(this.sessions) : undefined

    if (
      (!this.agentEnabled && previous.owner === 'manual')
      || (
        this.agentEnabled
        && previous.owner === 'agent'
        && previous.mode === mode
      )
    ) {
      return this.unchanged()
    }

    const generation = previous.generation + 1

    this.current = mode === undefined
      ? { owner: 'manual', generation }
      : { owner: 'agent', mode, generation }

    return {
      changed: true,
      previous,
      current: this.current,
      cues: [],
    }
  }

  private unchanged(): CharacterPresentationTransition {
    return {
      changed: false,
      previous: this.current,
      current: this.current,
      cues: [],
    }
  }
}

function didAllSessionsComplete(
  previousSessions: readonly CharacterAmbientSession[],
  currentSessions: readonly CharacterAmbientSession[],
): boolean {
  if (
    currentSessions.length === 0
    || currentSessions.some(session => session.state !== 'done')
  ) {
    return false
  }

  const previousStates = new Map(
    previousSessions.map(session => [session.sessionId, session.state]),
  )

  return currentSessions.some((session) => {
    const previousState = previousStates.get(session.sessionId)

    return previousState === 'working' || previousState === 'waiting'
  })
}

export function deriveCharacterMode(sessions: readonly CharacterAmbientSession[]): CharacterMode {
  if (sessions.some(session => session.state === 'waiting')) return 'angry'
  if (sessions.some(session => session.state === 'working')) return 'guitar'

  return 'relaxed'
}
