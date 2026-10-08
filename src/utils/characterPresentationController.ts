import type {
  CharacterAmbientSnapshot,
  CharacterPresentationSnapshot,
  CharacterPresentationTransition,
} from './characterPresentation'
import type { Model } from './modelPresets'

import { CharacterPresentationReducer } from './characterPresentation'

type PresentationModel = Pick<Model, 'isPreset' | 'presetKey'>

/**
 * Owns the runtime boundary between Agent presentation and existing manual
 * expression/motion controls. It does not map character modes to animations.
 */
export class CharacterPresentationController {
  private readonly reducer = new CharacterPresentationReducer()
  private agentRequested = false
  private modelSupported = false

  public get snapshot(): CharacterPresentationSnapshot {
    return this.reducer.snapshot
  }

  public get manualControlAllowed(): boolean {
    return this.snapshot.owner === 'manual'
  }

  public applyAmbient(snapshot: CharacterAmbientSnapshot): CharacterPresentationTransition {
    return this.reducer.applyAmbient(snapshot)
  }

  public setAgentRequested(requested: boolean): CharacterPresentationTransition {
    this.agentRequested = requested

    return this.reconcileOwnership()
  }

  public setModel(model: PresentationModel | undefined): CharacterPresentationTransition {
    this.modelSupported = supportsAgentPresentation(model)

    return this.reconcileOwnership()
  }

  private reconcileOwnership(): CharacterPresentationTransition {
    return this.reducer.setAgentEnabled(this.agentRequested && this.modelSupported)
  }
}

export function supportsAgentPresentation(model: PresentationModel | undefined): boolean {
  return model?.isPreset === true && model.presetKey === 'mikucat'
}
