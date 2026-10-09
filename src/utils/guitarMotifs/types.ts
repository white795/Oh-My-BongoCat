import type { GuitarKey, GuitarPerformanceProfile, GuitarPhrase } from '../guitarPerformance'

export type GuitarMotifTrackName = 'head' | 'body' | 'leftEar' | 'rightEar' | 'frettingHand'

export interface GuitarMotifDefinition {
  id: string
  label: string
  homeProfile: GuitarPerformanceProfile
  minimumProfile: GuitarPerformanceProfile
  durationBeats: number
  steps: GuitarPhrase['steps']
  frettingAngleDegrees?: number
  tracks: Record<GuitarMotifTrackName, readonly GuitarKey[]>
}

export type GuitarMotifPreviewSlot
  = | { kind: 'phrase', phraseId: string }
    | { kind: 'motif' }
