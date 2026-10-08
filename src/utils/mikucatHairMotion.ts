import { MIKUCAT_V2_HAIR_CHANNELS } from './modelParameterOwnership'

export type MikuCatHairParameterId = typeof MIKUCAT_V2_HAIR_CHANNELS[keyof typeof MIKUCAT_V2_HAIR_CHANNELS]

export interface MikuCatMotionPose {
  x: number
  y: number
}

interface HairResponse {
  positionX: number
  positionY: number
  velocityX: number
  velocityY: number
  frequency: number
  damping: number
  limit: number
}

interface HairSpring {
  value: number
  velocity: number
}

// Detached components share one response model, but retain deliberately
// different inertia so the two sides never behave like one rigid sheet.
const HAIR_RESPONSES: Record<MikuCatHairParameterId, HairResponse> = {
  [MIKUCAT_V2_HAIR_CHANNELS.rightSide]: {
    positionX: -0.16,
    positionY: 0.03,
    velocityX: -58,
    velocityY: 18,
    frequency: 3.4,
    damping: 0.72,
    limit: 12,
  },
  [MIKUCAT_V2_HAIR_CHANNELS.leftSide]: {
    positionX: -0.14,
    positionY: 0.04,
    velocityX: -64,
    velocityY: 15,
    frequency: 3.1,
    damping: 0.68,
    limit: 13,
  },
  [MIKUCAT_V2_HAIR_CHANNELS.rightPonytail]: {
    positionX: -0.12,
    positionY: 0.18,
    velocityX: -72,
    velocityY: 92,
    frequency: 2.25,
    damping: 0.5,
    limit: 20,
  },
  [MIKUCAT_V2_HAIR_CHANNELS.leftPonytail]: {
    positionX: -0.1,
    positionY: 0.2,
    velocityX: -80,
    velocityY: 86,
    frequency: 2.05,
    damping: 0.54,
    limit: 20,
  },
  [MIKUCAT_V2_HAIR_CHANNELS.bangs]: {
    positionX: -0.08,
    positionY: 0.025,
    velocityX: -36,
    velocityY: 14,
    frequency: 4.1,
    damping: 0.8,
    limit: 8,
  },
  [MIKUCAT_V2_HAIR_CHANNELS.rightRibbonX]: {
    positionX: -0.12,
    positionY: 0.04,
    velocityX: -76,
    velocityY: 30,
    frequency: 2.8,
    damping: 0.56,
    limit: 16,
  },
  [MIKUCAT_V2_HAIR_CHANNELS.rightRibbonY]: {
    positionX: -0.04,
    positionY: 0.16,
    velocityX: -30,
    velocityY: 96,
    frequency: 2.45,
    damping: 0.52,
    limit: 18,
  },
  [MIKUCAT_V2_HAIR_CHANNELS.leftRibbonX]: {
    positionX: -0.1,
    positionY: 0.05,
    velocityX: -70,
    velocityY: 34,
    frequency: 2.65,
    damping: 0.58,
    limit: 16,
  },
  [MIKUCAT_V2_HAIR_CHANNELS.leftRibbonY]: {
    positionX: -0.035,
    positionY: 0.18,
    velocityX: -27,
    velocityY: 88,
    frequency: 2.3,
    damping: 0.55,
    limit: 18,
  },
}

const MAX_FRAME_MS = 50
const MAX_SUBSTEP_SECONDS = 1 / 240
const clamp = (value: number, limit: number) => Math.max(-limit, Math.min(limit, value))

function createSprings() {
  return Object.fromEntries(
    Object.values(MIKUCAT_V2_HAIR_CHANNELS).map(id => [id, { value: 0, velocity: 0 }]),
  ) as Record<MikuCatHairParameterId, HairSpring>
}

export class MikuCatHairMotion {
  private readonly springs = createSprings()

  public get snapshot(): Readonly<Record<MikuCatHairParameterId, number>> {
    return Object.fromEntries(
      Object.entries(this.springs).map(([id, spring]) => [id, spring.value]),
    ) as Record<MikuCatHairParameterId, number>
  }

  public reset() {
    for (const spring of Object.values(this.springs)) {
      spring.value = 0
      spring.velocity = 0
    }
  }

  public update(deltaMs: number, head: MikuCatMotionPose, headVelocity: MikuCatMotionPose) {
    if (!Number.isFinite(deltaMs) || deltaMs <= 0) return
    if (![head.x, head.y, headVelocity.x, headVelocity.y].every(Number.isFinite)) return

    let remaining = Math.min(deltaMs, MAX_FRAME_MS) / 1000
    while (remaining > 1e-9) {
      const elapsed = Math.min(remaining, MAX_SUBSTEP_SECONDS)
      for (const id of Object.values(MIKUCAT_V2_HAIR_CHANNELS)) {
        const response = HAIR_RESPONSES[id]
        const spring = this.springs[id]
        const target = clamp(
          head.x * response.positionX
          + head.y * response.positionY
          + headVelocity.x * response.velocityX
          + headVelocity.y * response.velocityY,
          response.limit,
        )
        const angularFrequency = 2 * Math.PI * response.frequency
        const acceleration = angularFrequency * angularFrequency * (target - spring.value)
          - 2 * response.damping * angularFrequency * spring.velocity
        spring.velocity += acceleration * elapsed
        spring.value += spring.velocity * elapsed
        const bounded = clamp(spring.value, response.limit)
        if (bounded !== spring.value) spring.velocity = 0
        spring.value = bounded
      }
      remaining -= elapsed
    }
  }
}
