import type { GuitarMotifDefinition, GuitarMotifId, GuitarMotifPreviewSlot } from './guitarMotifs'
import type {
  GuitarPerformanceIntent,
  GuitarPerformanceProfile,
  GuitarPerformanceTemplateId,
  GuitarTemplatePhraseRole,
} from './guitarPerformance'

import { GUITAR_MOTIF_CATALOG, IMMERSED_DOUBLE_NOD_MOTIF_ID } from './guitarMotifs'
import { GUITAR_ESTABLISH_PHRASE_ID, GUITAR_PERFORMANCE_TEMPLATES, GUITAR_SOFT_CADENCE_PHRASE_ID, GUITAR_VARIATION_PHRASE_ID } from './guitarPerformance'

export type GuitarPlanRole = GuitarTemplatePhraseRole | 'feature'
export type GuitarPlanReason = 'template-slot' | 'preview-context' | 'preview-motif'
  | 'performance-establish' | 'performance-repeat' | 'performance-variation'
  | 'performance-home-motif' | 'performance-support-motif' | 'performance-recovery'
  | 'performance-release-cadence' | 'performance-release-hold'

interface PlannedGuitarUnitBase {
  kind: 'phrase' | 'motif'
  profile: GuitarPerformanceProfile
  gain: number
  reason: GuitarPlanReason
  role: GuitarPlanRole
  phraseId?: string
  motifId?: GuitarMotifId
  templateId?: GuitarPerformanceTemplateId
  templateIteration?: number
  slotIndex: number
  slotId: string
}

export interface PlannedGuitarPhrase extends PlannedGuitarUnitBase {
  kind: 'phrase'
  phraseId: string
  templateId: GuitarPerformanceTemplateId
  templateIteration: number
  role: GuitarTemplatePhraseRole
}

export interface PlannedGuitarPreviewPhrase extends PlannedGuitarUnitBase {
  kind: 'phrase'
  phraseId: string
  role: GuitarTemplatePhraseRole
}

export interface PlannedGuitarMotif extends PlannedGuitarUnitBase {
  kind: 'motif'
  motifId: GuitarMotifId
  role: 'feature'
}

export type PlannedGuitarUnit = PlannedGuitarPhrase | PlannedGuitarPreviewPhrase | PlannedGuitarMotif

const CARRIER_GAIN_FLOOR = 0.6
const PERFORMANCE_PROFILES: readonly GuitarPerformanceProfile[] = ['autonomous', 'engaged', 'groove', 'drive']
const PROFILE_RANK = Object.fromEntries(PERFORMANCE_PROFILES.map((profile, rank) => [profile, rank])) as Record<GuitarPerformanceProfile, number>

type MotifSelectionPool = 'home' | 'support'
type PerformanceReleasePhase = 'inactive' | 'cadence' | 'hold'

interface MotifSelectionState {
  featureCount: number
  homeCursor: number
  supportCursor: number
}

interface PendingMotifSelection {
  motif: GuitarMotifDefinition
  pool: MotifSelectionPool
  nextCursor: number
}

interface PerformancePhraseSlot {
  kind: 'phrase'
  phraseId: string
  role: PlannedGuitarPreviewPhrase['role']
  reason: Extract<GuitarPlanReason, `performance-${string}`>
  slotIndex: number
  slotId: string
}

interface PerformanceMotifSlot {
  kind: 'motif'
  motifId: GuitarMotifId
  role: 'feature'
  reason: 'performance-home-motif' | 'performance-support-motif'
  slotIndex: number
  slotId: string
}

type PerformanceSlot = PerformancePhraseSlot | PerformanceMotifSlot

function createMotifSelectionStates(): Record<GuitarPerformanceProfile, MotifSelectionState> {
  return Object.fromEntries(PERFORMANCE_PROFILES.map(profile => [profile, {
    featureCount: 0,
    homeCursor: 0,
    supportCursor: 0,
  }])) as Record<GuitarPerformanceProfile, MotifSelectionState>
}

export function eligibleGuitarMotifs(profile: GuitarPerformanceProfile): readonly GuitarMotifDefinition[] {
  return GUITAR_MOTIF_CATALOG.filter(motif => PROFILE_RANK[motif.minimumProfile] <= PROFILE_RANK[profile])
}

export function guitarCarrierGain(activity: number) {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(activity) ? activity : 0))
  const smoothed = clamped * clamped * (3 - 2 * clamped)
  return Math.round((CARRIER_GAIN_FLOOR + (1 - CARRIER_GAIN_FLOOR) * smoothed) * 10_000) / 10_000
}

/**
 * Converts durable intent into an auditable score. Template overrides,
 * cumulative Motif selection and release cadence all stay here so the
 * single-clock player only executes the returned unit.
 */
export class GuitarPerformancePlanner {
  private templateId?: GuitarPerformanceTemplateId
  private templateIteration = 0
  private slotIndex = 0
  private lastPlan?: PlannedGuitarUnit
  private performanceProfile?: GuitarPerformanceProfile
  private performanceIteration = 0
  private performanceSlots: PerformanceSlot[] = []
  private motifSelectionStates = createMotifSelectionStates()
  private pendingMotifSelection?: PendingMotifSelection
  private lastMotifId?: GuitarMotifId
  private releasePhase: PerformanceReleasePhase = 'inactive'
  private releaseIteration = 0

  public get snapshot(): PlannedGuitarUnit | undefined {
    return this.lastPlan ? { ...this.lastPlan } : undefined
  }

  public reset() {
    this.templateId = undefined
    this.templateIteration = 0
    this.slotIndex = 0
    this.lastPlan = undefined
    this.performanceProfile = undefined
    this.performanceIteration = 0
    this.performanceSlots = []
    this.motifSelectionStates = createMotifSelectionStates()
    this.pendingMotifSelection = undefined
    this.lastMotifId = undefined
    this.releasePhase = 'inactive'
    this.releaseIteration = 0
  }

  public next(templateId: GuitarPerformanceTemplateId, intent: GuitarPerformanceIntent): PlannedGuitarPhrase {
    if (this.templateId !== templateId) {
      this.templateIteration = 0
      this.slotIndex = 0
      this.templateId = templateId
      this.clearPerformanceFlow()
    }

    const template = GUITAR_PERFORMANCE_TEMPLATES[templateId]
    const slot = template.slots[this.slotIndex]
    const phraseId = slot?.candidates[0]
    if (!slot || !phraseId) {
      throw new Error(`Guitar template ${templateId} has no candidate at slot ${this.slotIndex}`)
    }

    const plan: PlannedGuitarPhrase = {
      kind: 'phrase',
      profile: intent.profile,
      gain: guitarCarrierGain(intent.activity),
      reason: 'template-slot',
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

  public nextPerformance(intent: GuitarPerformanceIntent): PlannedGuitarPreviewPhrase | PlannedGuitarMotif {
    const returningFromTemplate = this.templateId !== undefined
    const profileChanged = this.performanceProfile !== intent.profile

    if (returningFromTemplate) {
      this.templateId = undefined
      this.templateIteration = 0
      this.slotIndex = 0
    }

    if (intent.releasing) {
      if (this.releasePhase === 'inactive') {
        this.releasePhase = 'cadence'
        this.releaseIteration = 0
        this.discardPerformanceQueue()
      }
      if (profileChanged || returningFromTemplate) {
        this.performanceProfile = intent.profile
        this.discardPerformanceQueue()
      }
      return this.nextRelease(intent)
    }

    if (this.releasePhase !== 'inactive' || profileChanged || returningFromTemplate) {
      this.releasePhase = 'inactive'
      this.releaseIteration = 0
      this.performanceProfile = intent.profile
      this.performanceIteration = 0
      this.discardPerformanceQueue()
    }

    if (this.performanceSlots.length === 0) this.buildPerformanceBlock(intent.profile)
    const slot = this.performanceSlots.shift()
    if (!slot) throw new Error(`No guitar performance slot available for ${intent.profile}`)

    const common = {
      profile: intent.profile,
      templateIteration: this.performanceIteration,
      slotIndex: slot.slotIndex,
      slotId: slot.slotId,
      reason: slot.reason,
    }
    const plan: PlannedGuitarPreviewPhrase | PlannedGuitarMotif = slot.kind === 'motif'
      ? {
          ...common,
          kind: 'motif',
          motifId: slot.motifId,
          role: 'feature',
          gain: 1,
        }
      : {
          ...common,
          kind: 'phrase',
          phraseId: slot.phraseId,
          role: slot.role,
          gain: guitarCarrierGain(intent.activity),
        }

    if (plan.kind === 'motif') this.commitPendingMotif(plan.motifId, intent.profile)
    if (this.performanceSlots.length === 0) this.performanceIteration++
    this.lastPlan = plan
    return { ...plan }
  }

  public preview(
    slot: GuitarMotifPreviewSlot,
    motifId: GuitarMotifId,
    slotIndex: number,
    intent: GuitarPerformanceIntent,
  ): PlannedGuitarPreviewPhrase | PlannedGuitarMotif {
    const slotId = `preview-${slotIndex}`
    const plan: PlannedGuitarPreviewPhrase | PlannedGuitarMotif = slot.kind === 'motif'
      ? {
          kind: 'motif',
          motifId,
          role: 'feature',
          profile: intent.profile,
          gain: 1,
          reason: 'preview-motif',
          slotIndex,
          slotId,
        }
      : {
          kind: 'phrase',
          phraseId: slot.phraseId,
          role: slot.phraseId === GUITAR_VARIATION_PHRASE_ID
            ? 'variation'
            : slotIndex === 0
              ? 'establish'
              : 'repeat',
          profile: intent.profile,
          gain: guitarCarrierGain(intent.activity),
          reason: 'preview-context',
          slotIndex,
          slotId,
        }
    this.lastPlan = plan
    return { ...plan }
  }

  private clearPerformanceFlow() {
    this.performanceProfile = undefined
    this.performanceIteration = 0
    this.discardPerformanceQueue()
    this.releasePhase = 'inactive'
    this.releaseIteration = 0
  }

  private discardPerformanceQueue() {
    this.performanceSlots = []
    this.pendingMotifSelection = undefined
  }

  private nextRelease(intent: GuitarPerformanceIntent): PlannedGuitarPreviewPhrase {
    const isCadence = this.releasePhase === 'cadence'
    const plan: PlannedGuitarPreviewPhrase = {
      kind: 'phrase',
      profile: intent.profile,
      gain: guitarCarrierGain(intent.activity),
      reason: isCadence ? 'performance-release-cadence' : 'performance-release-hold',
      templateIteration: this.releaseIteration,
      slotIndex: isCadence ? 0 : 1,
      slotId: isCadence ? 'release-cadence' : 'release-hold',
      role: isCadence ? 'soft-cadence' : 'continuation',
      phraseId: isCadence ? GUITAR_SOFT_CADENCE_PHRASE_ID : GUITAR_ESTABLISH_PHRASE_ID,
    }
    this.releasePhase = 'hold'
    this.releaseIteration++
    this.lastPlan = plan
    return { ...plan }
  }

  private buildPerformanceBlock(profile: GuitarPerformanceProfile) {
    const selection = this.peekNextMotif(profile)
    this.pendingMotifSelection = selection
    if (!selection) {
      this.performanceSlots = this.standardPhraseBlock()
      return
    }

    const motifId = selection.motif.id as GuitarMotifId
    this.performanceSlots = motifId === IMMERSED_DOUBLE_NOD_MOTIF_ID
      ? [
          this.phraseSlot(0, 'establish', 'establish', GUITAR_ESTABLISH_PHRASE_ID, 'performance-establish'),
          this.phraseSlot(1, 'repeat', 'repeat', GUITAR_ESTABLISH_PHRASE_ID, 'performance-repeat'),
          this.phraseSlot(2, 'lead-in', 'variation', GUITAR_VARIATION_PHRASE_ID, 'performance-variation'),
          this.motifSlot(3, motifId, selection.pool),
        ]
      : [
          this.phraseSlot(0, 'establish', 'establish', GUITAR_ESTABLISH_PHRASE_ID, 'performance-establish'),
          this.phraseSlot(1, 'repeat', 'repeat', GUITAR_ESTABLISH_PHRASE_ID, 'performance-repeat'),
          this.motifSlot(2, motifId, selection.pool),
          this.phraseSlot(3, 'recovery', 'continuation', GUITAR_ESTABLISH_PHRASE_ID, 'performance-recovery'),
        ]
  }

  private standardPhraseBlock(): PerformanceSlot[] {
    return [
      this.phraseSlot(0, 'establish', 'establish', GUITAR_ESTABLISH_PHRASE_ID, 'performance-establish'),
      this.phraseSlot(1, 'repeat', 'repeat', GUITAR_ESTABLISH_PHRASE_ID, 'performance-repeat'),
      this.phraseSlot(2, 'variation', 'variation', GUITAR_VARIATION_PHRASE_ID, 'performance-variation'),
      this.phraseSlot(3, 'recovery', 'continuation', GUITAR_ESTABLISH_PHRASE_ID, 'performance-recovery'),
    ]
  }

  private phraseSlot(
    slotIndex: number,
    slotId: string,
    role: PerformancePhraseSlot['role'],
    phraseId: string,
    reason: PerformancePhraseSlot['reason'],
  ): PerformancePhraseSlot {
    return { kind: 'phrase', phraseId, role, reason, slotIndex, slotId }
  }

  private motifSlot(slotIndex: number, motifId: GuitarMotifId, pool: MotifSelectionPool): PerformanceMotifSlot {
    return {
      kind: 'motif',
      motifId,
      role: 'feature',
      reason: pool === 'home' ? 'performance-home-motif' : 'performance-support-motif',
      slotIndex,
      slotId: 'feature',
    }
  }

  private peekNextMotif(profile: GuitarPerformanceProfile): PendingMotifSelection | undefined {
    const eligible = eligibleGuitarMotifs(profile)
    if (eligible.length === 0) return undefined

    const state = this.motifSelectionStates[profile]
    const home = eligible.filter(motif => motif.homeProfile === profile)
    const support = eligible.filter(motif => motif.homeProfile !== profile)
    const preferredPool: MotifSelectionPool = state.featureCount % 2 === 0 ? 'home' : 'support'
    const fallbackPool: MotifSelectionPool = preferredPool === 'home' ? 'support' : 'home'

    return this.peekFromPool(state, preferredPool, preferredPool === 'home' ? home : support, true)
      ?? this.peekFromPool(state, fallbackPool, fallbackPool === 'home' ? home : support, true)
      ?? this.peekFromPool(state, preferredPool, preferredPool === 'home' ? home : support, false)
      ?? this.peekFromPool(state, fallbackPool, fallbackPool === 'home' ? home : support, false)
  }

  private peekFromPool(
    state: MotifSelectionState,
    pool: MotifSelectionPool,
    candidates: readonly GuitarMotifDefinition[],
    avoidLast: boolean,
  ): PendingMotifSelection | undefined {
    if (candidates.length === 0) return undefined
    const cursorKey = pool === 'home' ? 'homeCursor' : 'supportCursor'
    const cursor = state[cursorKey] % candidates.length
    for (let offset = 0; offset < candidates.length; offset++) {
      const index = (cursor + offset) % candidates.length
      const motif = candidates[index]
      if (avoidLast && motif.id === this.lastMotifId) continue
      return { motif, pool, nextCursor: (index + 1) % candidates.length }
    }
    return undefined
  }

  private commitPendingMotif(motifId: GuitarMotifId, profile: GuitarPerformanceProfile) {
    const selection = this.pendingMotifSelection
    if (!selection || selection.motif.id !== motifId) return
    const state = this.motifSelectionStates[profile]
    if (selection.pool === 'home') state.homeCursor = selection.nextCursor
    else state.supportCursor = selection.nextCursor
    state.featureCount++
    this.lastMotifId = motifId
    this.pendingMotifSelection = undefined
  }
}
