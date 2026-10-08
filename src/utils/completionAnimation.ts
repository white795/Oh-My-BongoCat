import { MikuCatHairMotion } from './mikucatHairMotion'
import { MIKUCAT_V2_CHANNELS } from './modelParameterOwnership'

export type CompletionAnimationPhase = 'idle' | 'playing' | 'leaving'

interface Pose {
  x: number
  y: number
}

type CompletionPoseKey = 'head' | 'body' | 'leftEar' | 'rightEar'

interface CompletionFrame {
  readonly atMs: number
  readonly head: Pose
  readonly body: Pose
  readonly leftEar: Pose
  readonly rightEar: Pose
}

interface CompletionFrameWithVelocity {
  head: Pose
  body: Pose
  leftEar: Pose
  rightEar: Pose
  headVelocity: Pose
  bodyVelocity: Pose
  leftEarVelocity: Pose
  rightEarVelocity: Pose
}

export const COMPLETION_ANIMATION = {
  popAtMs: 480,
  actionMs: 1_800,
  returnMs: 420,
  preemptExitMs: 280,
} as const

const ZERO = { x: 0, y: 0 } as const

// One restrained completion sentence: a short anticipation, one clear upward
// beat, two diminishing rebounds and a held smile before returning to mouse.
// The dot-eyes expression is owned by the host so this timeline only authors
// pose channels and remains reusable by the final presentation coordinator.
const AUTHORED_FRAMES: readonly CompletionFrame[] = [
  frame(160, -1.5, -3.2, -0.8, -2.0, -0.08, 0.06, 0.08, 0.06),
  frame(COMPLETION_ANIMATION.popAtMs, 0.0, 13.0, 0.0, 7.5, -0.34, -0.18, 0.34, -0.18),
  frame(760, -3.4, 8.0, -2.0, 4.8, -0.22, -0.08, 0.27, -0.10),
  frame(1_080, 4.0, 10.2, 2.2, 5.6, -0.28, -0.12, 0.20, -0.08),
  frame(1_420, -1.8, 7.2, -1.0, 3.7, -0.18, -0.05, 0.18, -0.05),
  frame(COMPLETION_ANIMATION.actionMs, 0.0, 6.0, 0.0, 3.0, -0.14, -0.04, 0.14, -0.04),
]

function frame(
  atMs: number,
  headX: number,
  headY: number,
  bodyX: number,
  bodyY: number,
  leftEarX: number,
  leftEarY: number,
  rightEarX: number,
  rightEarY: number,
): CompletionFrame {
  return {
    atMs,
    head: { x: headX, y: headY },
    body: { x: bodyX, y: bodyY },
    leftEar: { x: leftEarX, y: leftEarY },
    rightEar: { x: rightEarX, y: rightEarY },
  }
}

function clonePose(pose: Pose): Pose {
  return { x: pose.x, y: pose.y }
}

function zeroFrame(head: Pose = ZERO): CompletionFrameWithVelocity {
  return {
    head: clonePose(head),
    body: clonePose(ZERO),
    leftEar: clonePose(ZERO),
    rightEar: clonePose(ZERO),
    headVelocity: clonePose(ZERO),
    bodyVelocity: clonePose(ZERO),
    leftEarVelocity: clonePose(ZERO),
    rightEarVelocity: clonePose(ZERO),
  }
}

function cloneFrame(source: CompletionFrameWithVelocity): CompletionFrameWithVelocity {
  return {
    head: clonePose(source.head),
    body: clonePose(source.body),
    leftEar: clonePose(source.leftEar),
    rightEar: clonePose(source.rightEar),
    headVelocity: clonePose(source.headVelocity),
    bodyVelocity: clonePose(source.bodyVelocity),
    leftEarVelocity: clonePose(source.leftEarVelocity),
    rightEarVelocity: clonePose(source.rightEarVelocity),
  }
}

function tangent(
  frames: readonly CompletionFrame[],
  index: number,
  key: CompletionPoseKey,
  axis: keyof Pose,
) {
  if (index <= 0 || index >= frames.length - 1) return 0

  const previous = frames[index - 1]
  const next = frames[index + 1]

  return (next[key][axis] - previous[key][axis]) / (next.atMs - previous.atMs) * 0.78
}

function sampleAxis(
  frames: readonly CompletionFrame[],
  index: number,
  key: CompletionPoseKey,
  axis: keyof Pose,
  elapsedMs: number,
) {
  const from = frames[index]
  const to = frames[index + 1]
  const durationMs = to.atMs - from.atMs
  const t = Math.min(Math.max((elapsedMs - from.atMs) / durationMs, 0), 1)
  const t2 = t * t
  const t3 = t2 * t
  const fromValue = from[key][axis]
  const toValue = to[key][axis]
  const fromVelocity = tangent(frames, index, key, axis)
  const toVelocity = tangent(frames, index + 1, key, axis)
  const value = (2 * t3 - 3 * t2 + 1) * fromValue
    + (t3 - 2 * t2 + t) * durationMs * fromVelocity
    + (-2 * t3 + 3 * t2) * toValue
    + (t3 - t2) * durationMs * toVelocity
  const velocity = (
    (6 * t2 - 6 * t) * fromValue
    + (3 * t2 - 4 * t + 1) * durationMs * fromVelocity
    + (-6 * t2 + 6 * t) * toValue
    + (3 * t2 - 2 * t) * durationMs * toVelocity
  ) / durationMs

  return { value, velocity }
}

function sampleAuthored(
  initialHead: Pose,
  elapsedMs: number,
): CompletionFrameWithVelocity {
  const frames: readonly CompletionFrame[] = [
    frame(0, initialHead.x, initialHead.y, 0, 0, 0, 0, 0, 0),
    ...AUTHORED_FRAMES,
  ]
  const boundedElapsed = Math.min(Math.max(elapsedMs, 0), COMPLETION_ANIMATION.actionMs)
  let index = frames.length - 2

  for (let candidate = 0; candidate < frames.length - 1; candidate++) {
    if (boundedElapsed <= frames[candidate + 1].atMs) {
      index = candidate
      break
    }
  }

  const result = zeroFrame()
  for (const key of ['head', 'body', 'leftEar', 'rightEar'] as const) {
    for (const axis of ['x', 'y'] as const) {
      const sample = sampleAxis(frames, index, key, axis, boundedElapsed)
      result[key][axis] = sample.value
      result[`${key}Velocity`][axis] = sample.velocity
    }
  }
  return result
}

function transitionAxis(
  from: number,
  fromVelocity: number,
  to: number,
  elapsedMs: number,
  durationMs: number,
) {
  const t = Math.min(Math.max(elapsedMs / durationMs, 0), 1)
  const t2 = t * t
  const t3 = t2 * t
  return {
    value: (2 * t3 - 3 * t2 + 1) * from
      + (t3 - 2 * t2 + t) * durationMs * fromVelocity
      + (-2 * t3 + 3 * t2) * to,
    velocity: (
      (6 * t2 - 6 * t) * from
      + (3 * t2 - 4 * t + 1) * durationMs * fromVelocity
      + (-6 * t2 + 6 * t) * to
    ) / durationMs,
  }
}

function transitionFrame(
  from: CompletionFrameWithVelocity,
  targetHead: Pose,
  elapsedMs: number,
  durationMs: number,
): CompletionFrameWithVelocity {
  const target = zeroFrame(targetHead)
  const result = zeroFrame()

  for (const key of ['head', 'body', 'leftEar', 'rightEar'] as const) {
    for (const axis of ['x', 'y'] as const) {
      const sample = transitionAxis(
        from[key][axis],
        from[`${key}Velocity`][axis],
        target[key][axis],
        elapsedMs,
        durationMs,
      )
      result[key][axis] = sample.value
      result[`${key}Velocity`][axis] = sample.velocity
    }
  }
  return result
}

export class CompletionAnimation {
  private phase: CompletionAnimationPhase = 'idle'
  private elapsedMs = 0
  private initialHead = clonePose(ZERO)
  private pose = zeroFrame()
  private leavingFrom = zeroFrame()
  private leavingDurationMs: number = COMPLETION_ANIMATION.returnMs
  private readonly hairMotion = new MikuCatHairMotion()

  constructor(private readonly writeParameter: (id: string, value: number) => void) { }

  public get isActive() {
    return this.phase !== 'idle'
  }

  public get snapshot() {
    return {
      phase: this.phase,
      elapsedMs: this.elapsedMs,
      head: clonePose(this.pose.head),
      headVelocity: clonePose(this.pose.headVelocity),
      body: clonePose(this.pose.body),
      leftEar: clonePose(this.pose.leftEar),
      rightEar: clonePose(this.pose.rightEar),
      hair: this.hairMotion.snapshot,
    }
  }

  public start(initialHead: Pose = ZERO) {
    if (this.isActive) return false

    this.initialHead = clonePose(initialHead)
    this.pose = sampleAuthored(this.initialHead, 0)
    this.elapsedMs = 0
    this.phase = 'playing'
    this.hairMotion.reset()
    this.writePose()
    return true
  }

  public stop(targetHead: Pose = ZERO) {
    if (!this.isActive || this.phase === 'leaving') return false

    this.beginLeaving(targetHead, COMPLETION_ANIMATION.preemptExitMs)
    return true
  }

  public abort() {
    this.phase = 'idle'
    this.elapsedMs = 0
    this.initialHead = clonePose(ZERO)
    this.pose = zeroFrame()
    this.leavingFrom = zeroFrame()
    this.leavingDurationMs = COMPLETION_ANIMATION.returnMs
    this.hairMotion.reset()
  }

  public update(deltaMs: number, targetHead: Pose = ZERO) {
    if (!this.isActive || !Number.isFinite(deltaMs) || deltaMs <= 0) return

    let remaining = deltaMs
    if (this.phase === 'playing') {
      const playableMs = Math.min(remaining, COMPLETION_ANIMATION.actionMs - this.elapsedMs)

      this.elapsedMs += playableMs
      remaining -= playableMs
      this.pose = sampleAuthored(this.initialHead, this.elapsedMs)

      if (this.elapsedMs >= COMPLETION_ANIMATION.actionMs) {
        this.beginLeaving(targetHead, COMPLETION_ANIMATION.returnMs)
      }
    }

    if (this.phase === 'leaving' && remaining > 0) {
      this.elapsedMs = Math.min(this.leavingDurationMs, this.elapsedMs + remaining)
      this.pose = transitionFrame(
        this.leavingFrom,
        targetHead,
        this.elapsedMs,
        this.leavingDurationMs,
      )
      if (this.elapsedMs >= this.leavingDurationMs) {
        this.phase = 'idle'
        this.pose = zeroFrame(targetHead)
        this.hairMotion.reset()
      }
    }

    if (this.phase !== 'idle') {
      this.hairMotion.update(deltaMs, this.pose.head, this.pose.headVelocity)
    }
    this.writePose()
  }

  private beginLeaving(targetHead: Pose, durationMs: number) {
    this.leavingFrom = cloneFrame(this.pose)
    this.leavingDurationMs = durationMs
    this.elapsedMs = 0
    this.phase = 'leaving'
    this.pose = transitionFrame(this.leavingFrom, targetHead, 0, durationMs)
  }

  private writePose() {
    this.writeParameter(MIKUCAT_V2_CHANNELS.head.x, this.pose.head.x)
    this.writeParameter(MIKUCAT_V2_CHANNELS.head.y, this.pose.head.y)
    this.writeParameter(MIKUCAT_V2_CHANNELS.body.x, this.pose.body.x)
    this.writeParameter(MIKUCAT_V2_CHANNELS.body.y, this.pose.body.y)
    this.writeParameter(MIKUCAT_V2_CHANNELS.leftEar.x, this.pose.leftEar.x)
    this.writeParameter(MIKUCAT_V2_CHANNELS.leftEar.y, this.pose.leftEar.y)
    this.writeParameter(MIKUCAT_V2_CHANNELS.rightEar.x, this.pose.rightEar.x)
    this.writeParameter(MIKUCAT_V2_CHANNELS.rightEar.y, this.pose.rightEar.y)
    for (const [id, value] of Object.entries(this.hairMotion.snapshot)) {
      this.writeParameter(id, value)
    }
  }
}
