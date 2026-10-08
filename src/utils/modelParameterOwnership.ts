export interface ModelParameterRange {
  min: number
  max: number
}

export interface ModelAnimationParameter extends ModelParameterRange {
  id: string
}

export type ModelParameterOwner = symbol

export const MIKUCAT_V2_CHANNELS = {
  head: { x: 'ParamAngleX', y: 'ParamAngleY' },
  body: { x: 'Param14', y: 'Param15' },
  leftEar: { x: 'Param18', y: 'Param16' },
  rightEar: { x: 'Param17', y: 'Param19' },
  leftHand: { x: 'Param21', y: 'Param22' },
  rightHand: { x: 'Param23', y: 'Param24' },
  guitar: { x: 'Param34', y: 'Param35' },
} as const

export const MIKUCAT_V2_HAIR_CHANNELS = {
  rightSide: 'Param2',
  leftSide: 'Param3',
  rightPonytail: 'Param4',
  leftPonytail: 'Param5',
  bangs: 'Param20',
  rightRibbonX: 'Param',
  rightRibbonY: 'Param27',
  leftRibbonX: 'Param28',
  leftRibbonY: 'Param29',
} as const

// Animation roles are deliberately separate from anatomical asset names.
// This left-handed guitar pose strums with the model's anatomical left hand.
export const MIKUCAT_GUITAR_ROLES = {
  strummingHand: MIKUCAT_V2_CHANNELS.leftHand,
  frettingHand: MIKUCAT_V2_CHANNELS.rightHand,
} as const

export const MIKUCAT_V2_ANIMATION_PARAMETERS: readonly ModelAnimationParameter[] = [
  { id: MIKUCAT_V2_CHANNELS.head.x, min: -30, max: 30 },
  { id: MIKUCAT_V2_CHANNELS.head.y, min: -30, max: 30 },
  { id: MIKUCAT_V2_CHANNELS.body.x, min: -30, max: 30 },
  { id: MIKUCAT_V2_CHANNELS.body.y, min: -30, max: 30 },
  { id: MIKUCAT_V2_CHANNELS.leftEar.x, min: -1, max: 1 },
  { id: MIKUCAT_V2_CHANNELS.leftEar.y, min: -1, max: 1 },
  { id: MIKUCAT_V2_CHANNELS.rightEar.x, min: -1, max: 1 },
  { id: MIKUCAT_V2_CHANNELS.rightEar.y, min: -1, max: 1 },
  { id: MIKUCAT_V2_CHANNELS.leftHand.x, min: -30, max: 30 },
  { id: MIKUCAT_V2_CHANNELS.leftHand.y, min: -30, max: 30 },
  { id: MIKUCAT_V2_CHANNELS.rightHand.x, min: -30, max: 30 },
  { id: MIKUCAT_V2_CHANNELS.rightHand.y, min: -30, max: 30 },
  { id: MIKUCAT_V2_CHANNELS.guitar.x, min: -30, max: 30 },
  { id: MIKUCAT_V2_CHANNELS.guitar.y, min: -30, max: 30 },
]

// Core-model inspection confirms these axes deform only the leek mesh and its
// adjacent hand mesh. Param25/26 instead belong to the empty normal left hand.
export const MIKUCAT_LEEK_HAND_CHANNELS = {
  x: 'ParamMouseX',
  y: 'ParamMouseY',
} as const

export const MIKUCAT_NORMAL_LEFT_HAND_CHANNELS = {
  x: 'Param25',
  y: 'Param26',
} as const

// These inputs are neutralized while the autonomous animation owns the model.
// Angle X/Y already belong to the animation manifest and are not duplicated.
export const MIKUCAT_MOUSE_CONTROL_PARAMETERS = [
  'ParamMouseX',
  'ParamMouseY',
  'ParamMouseLeftDown',
  'ParamMouseRightDown',
] as const

export const MIKUCAT_GUITAR_OWNED_PARAMETERS = [
  ...MIKUCAT_V2_ANIMATION_PARAMETERS.map(parameter => parameter.id),
  ...Object.values(MIKUCAT_V2_HAIR_CHANNELS),
  ...MIKUCAT_MOUSE_CONTROL_PARAMETERS,
] as const

export const MIKUCAT_ANGRY_POSE_PARAMETERS = [
  MIKUCAT_V2_CHANNELS.head.x,
  MIKUCAT_V2_CHANNELS.head.y,
  MIKUCAT_V2_CHANNELS.body.x,
  MIKUCAT_V2_CHANNELS.body.y,
  MIKUCAT_V2_CHANNELS.leftEar.x,
  MIKUCAT_V2_CHANNELS.leftEar.y,
  MIKUCAT_V2_CHANNELS.rightEar.x,
  MIKUCAT_V2_CHANNELS.rightEar.y,
  MIKUCAT_NORMAL_LEFT_HAND_CHANNELS.x,
  MIKUCAT_NORMAL_LEFT_HAND_CHANNELS.y,
] as const

export const MIKUCAT_ANGRY_OWNED_PARAMETERS = [
  ...MIKUCAT_ANGRY_POSE_PARAMETERS,
  ...Object.values(MIKUCAT_V2_HAIR_CHANNELS),
  ...MIKUCAT_MOUSE_CONTROL_PARAMETERS,
] as const

const clamp = (value: number, range: ModelParameterRange) => Math.max(range.min, Math.min(range.max, value))

/**
 * Arbitrates persistent easy-live2d parameter overrides.
 *
 * easy-live2d reapplies every external override after physics on each frame. A
 * zero-weight write therefore acts as release: the entry may remain cached by
 * the library, but no longer changes the value produced by physics or motion.
 */
export class ModelParameterOwnership {
  private readonly owners = new Map<string, ModelParameterOwner>()

  constructor(
    private readonly writeParameter: (id: string, value: number, weight: number) => void,
    private readonly getRange: (id: string) => ModelParameterRange | null | undefined,
  ) { }

  public acquire(owner: ModelParameterOwner, parameterIds: readonly string[]) {
    const ids = [...new Set(parameterIds)]
    const available = ids.every((id) => {
      const range = this.getRange(id)
      const currentOwner = this.owners.get(id)
      return range != null
        && Number.isFinite(range.min)
        && Number.isFinite(range.max)
        && range.min <= range.max
        && (currentOwner == null || currentOwner === owner)
    })
    if (!available) return false

    for (const id of ids) this.owners.set(id, owner)
    return true
  }

  public write(owner: ModelParameterOwner, id: string, value: number) {
    if (this.owners.get(id) !== owner || !Number.isFinite(value)) return false

    const range = this.getRange(id)
    if (!range) return false

    this.writeParameter(id, clamp(value, range), 1)
    return true
  }

  public release(owner: ModelParameterOwner) {
    let released = 0
    for (const [id, currentOwner] of this.owners) {
      if (currentOwner !== owner) continue
      this.writeParameter(id, 0, 0)
      this.owners.delete(id)
      released++
    }
    return released
  }
}
