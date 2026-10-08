import type { CharacterMode, CharacterPresentationSnapshot } from './characterPresentation'

export interface CharacterPresentationTarget {
  applyAgentPresentation: (mode: CharacterMode) => boolean
  releaseAgentPresentation: () => boolean
}

/**
 * Applies reducer generations to one presentation target. A rejected
 * generation remains retryable so model loading cannot lose the current mode.
 */
export class CharacterPresentationAdapter {
  private appliedGeneration = -1

  constructor(private readonly target: CharacterPresentationTarget) { }

  public apply(snapshot: CharacterPresentationSnapshot): boolean {
    if (snapshot.generation <= this.appliedGeneration) return false

    const accepted = snapshot.owner === 'agent'
      ? this.target.applyAgentPresentation(snapshot.mode)
      : this.target.releaseAgentPresentation()

    if (!accepted) return false

    this.appliedGeneration = snapshot.generation
    return true
  }
}
