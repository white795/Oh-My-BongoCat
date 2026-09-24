import type {
  GuitarPerformanceTemplateId,
  GuitarTemplatePhraseRole,
} from './guitarPerformance'

import { GUITAR_PERFORMANCE_TEMPLATES } from './guitarPerformance'

export interface PlannedGuitarPhrase {
  templateId: GuitarPerformanceTemplateId
  templateIteration: number
  slotIndex: number
  slotId: string
  role: GuitarTemplatePhraseRole
  phraseId: string
}

/**
 * Expands an authored template into an auditable score. Candidate filtering,
 * state scoring and Motif insertion will be added here without leaking those
 * decisions into the single-clock animation player.
 */
export class GuitarPerformancePlanner {
  private templateId?: GuitarPerformanceTemplateId
  private templateIteration = 0
  private slotIndex = 0
  private lastPlan?: PlannedGuitarPhrase

  public get snapshot(): PlannedGuitarPhrase | undefined {
    return this.lastPlan ? { ...this.lastPlan } : undefined
  }

  public reset() {
    this.templateId = undefined
    this.templateIteration = 0
    this.slotIndex = 0
    this.lastPlan = undefined
  }

  public next(templateId: GuitarPerformanceTemplateId): PlannedGuitarPhrase {
    if (this.templateId !== templateId) {
      this.reset()
      this.templateId = templateId
    }

    const template = GUITAR_PERFORMANCE_TEMPLATES[templateId]
    const slot = template.slots[this.slotIndex]
    const phraseId = slot?.candidates[0]
    if (!slot || !phraseId) {
      throw new Error(`Guitar template ${templateId} has no candidate at slot ${this.slotIndex}`)
    }

    const plan: PlannedGuitarPhrase = {
      templateId,
      templateIteration: this.templateIteration,
      slotIndex: this.slotIndex,
      slotId: slot.id,
      role: slot.role,
      phraseId,
    }
    this.lastPlan = plan

    this.slotIndex++
    if (this.slotIndex >= template.slots.length) {
      this.slotIndex = 0
      this.templateIteration++
    }

    return { ...plan }
  }
}
