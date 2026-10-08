import { MikuCatHairMotion } from './mikucatHairMotion'
import { MIKUCAT_LEEK_HAND_CHANNELS, MIKUCAT_NORMAL_LEFT_HAND_CHANNELS, MIKUCAT_V2_CHANNELS } from './modelParameterOwnership'

export type AngryAnimationIntensity = 'annoyed' | 'impatient' | 'furious'
export type AngryAnimationPhase = 'idle' | 'entering' | 'playing' | 'leaving'

export interface AngryAnimationIntent {
  intensity: AngryAnimationIntensity
}

interface Pose {
  x: number
  y: number
}

type AngryPoseKey = 'head' | 'body' | 'leftEar' | 'rightEar' | 'leekHand' | 'normalLeftHand'

interface AngryFrame {
  head: Pose
  body: Pose
  leftEar: Pose
  rightEar: Pose
  leekHand: Pose
  normalLeftHand: Pose
}

interface AngryFrameWithVelocity extends AngryFrame {
  headVelocity: Pose
  bodyVelocity: Pose
  leftEarVelocity: Pose
  rightEarVelocity: Pose
  leekHandVelocity: Pose
  normalLeftHandVelocity: Pose
}

export const ANGRY_ANIMATION = {
  enterMs: 420,
  exitMs: 320,
  annoyedLoopMs: 4600,
  impatientLoopMs: 4000,
  furiousLoopMs: 5000,
  maxFrameMs: 100,
} as const

const ZERO = { x: 0, y: 0 } as const

// Equal-time periodic control points. The motion spends most of its time in a
// restrained forward pose, with one slow side look and asymmetric ear follow.
const ANNOYED_FRAMES: readonly AngryFrame[] = [
  frame(-2.8, -4.4, -0.8, -2.8, -0.10, -0.10, 0.12, 0.08),
  frame(-4.5, -5.4, -1.5, -3.8, -0.22, -0.18, 0.06, 0.17),
  frame(-10.5, -8.0, -4.2, -6.1, -0.48, -0.36, -0.10, 0.34),
  frame(-12.0, -8.8, -5.2, -6.8, -0.55, -0.40, -0.14, 0.40),
  frame(-6.4, -6.0, -2.5, -4.3, -0.30, -0.22, 0.03, 0.24),
  frame(-2.4, -4.0, -0.6, -2.4, -0.06, -0.08, 0.15, 0.06),
]

// Sixteen 250ms points separate a readable hold from two sharp prompts. The
// head leads each push, the body accepts the weight one point later, and the
// final third settles instead of turning impatience into a continuous tremor.
const IMPATIENT_FRAMES: readonly AngryFrame[] = [
  frame(-1.2, -8.0, -2.5, -7.0, -0.03, -0.03, 0.03, 0.04),
  frame(-1.0, -7.8, -2.4, -6.8, -0.03, -0.03, 0.03, 0.04),
  frame(-1.1, -8.1, -2.6, -7.1, -0.03, -0.03, 0.03, 0.04),
  frame(-1.3, -8.0, -2.5, -7.0, -0.03, -0.03, 0.03, 0.04),
  frame(2.0, -3.5, -1.0, -5.0, 0.06, 0.08, 0.07, 0.09, -6, 7, -1, 1),
  frame(-4.0, -16.0, -5.0, -13.0, -0.07, -0.09, -0.06, -0.08, 8, -10, 1, -1),
  frame(1.0, -5.5, -7.0, -19.0, -0.10, -0.12, -0.08, -0.10, -5, 6, 4, -4),
  frame(3.0, -3.0, -2.0, -8.0, 0.07, 0.10, 0.08, 0.11, -8, 9, -2, 2),
  frame(-6.0, -23.0, -8.0, -18.0, -0.09, -0.11, -0.07, -0.09, 18, -18, 2, -2),
  frame(-3.0, -14.0, -11.0, -26.0, -0.14, -0.14, -0.12, -0.13, 12, -12, 7, -7),
  frame(-2.0, -7.5, -7.0, -16.0, -0.09, -0.10, -0.07, -0.08, 4, -4, 4, -4),
  frame(-1.5, -8.0, -4.0, -10.0, -0.05, -0.05, 0.01, 0.02, 1, -1, 1, -1),
  frame(-1.2, -8.0, -2.8, -7.5, -0.03, -0.03, 0.03, 0.04),
  frame(-1.0, -7.9, -2.5, -7.0, -0.03, -0.03, 0.03, 0.04),
  frame(-1.1, -8.1, -2.5, -6.9, -0.03, -0.03, 0.03, 0.04),
  frame(-1.3, -8.0, -2.5, -7.0, -0.03, -0.03, 0.03, 0.04),
]

// A grounded five-second phrase. After a short hold and raised wind-up, the
// leek hand keeps changing direction for 2.4 seconds, finishes on one heavy
// downward strike, then lets the body and secondary motion settle. Unequal
// arcs and one brief breath keep the sequence from reading as a metronome.
const FURIOUS_FRAMES: readonly AngryFrame[] = [
  frame(-2.0, -12.0, -2.0, -12.0, -0.05, -0.05, 0.05, 0.05),
  frame(-1.8, -11.8, -1.8, -11.8, -0.05, -0.05, 0.05, 0.05),
  frame(-2.1, -12.2, -2.1, -12.2, -0.06, -0.05, 0.04, 0.05),
  frame(-2.0, -12.0, -2.0, -12.0, -0.05, -0.05, 0.05, 0.05),
  frame(4.0, -9.0, 6.0, -10.0, 0.08, 0.10, 0.09, 0.11, -10, 16, -2, 2),
  frame(-3.0, -13.0, -5.0, -15.0, -0.10, -0.12, -0.08, -0.11, 16, -14, 0, -1),
  frame(3.0, -11.0, 5.0, -12.0, 0.09, 0.11, 0.10, 0.12, -15, 12, 1, -2),
  frame(-4.0, -14.0, -6.0, -16.0, -0.11, -0.13, -0.09, -0.12, 19, -10, 2, -3),
  frame(-1.0, -12.0, -1.0, -13.0, 0.03, 0.05, 0.04, 0.06, -6, 8, 2, -3),
  frame(3.0, -12.0, 5.0, -14.0, 0.09, 0.11, 0.10, 0.12, -20, -6, 1, -3),
  frame(-3.0, -13.0, -5.0, -15.0, -0.10, -0.12, -0.08, -0.11, 17, 9, 0, -3),
  frame(2.0, -14.0, 4.0, -16.0, 0.08, 0.10, 0.09, 0.11, -14, -15, -1, -4),
  frame(-4.0, -12.0, -6.0, -14.0, -0.11, -0.13, -0.09, -0.12, 18, 13, -1, -4),
  frame(3.0, -15.0, 5.0, -17.0, 0.10, 0.12, 0.11, 0.13, -21, -9, 0, -3),
  frame(2.0, -10.0, 4.0, -11.0, 0.07, 0.10, 0.09, 0.12, -12, 17, 2, 1),
  frame(5.0, -9.0, 7.0, -10.0, 0.10, 0.13, 0.11, 0.14, -13, 18, 3, 2),
  frame(-9.0, -25.0, -13.0, -28.0, -0.18, -0.20, -0.16, -0.19, 25, -25, 6, -6),
  frame(-8.0, -23.0, -14.0, -27.0, -0.15, -0.17, -0.13, -0.16, 23, -23, 6, -7),
  frame(2.0, -10.0, -8.0, -20.0, 0.08, 0.11, 0.09, 0.12, 7, -9, 5, -5),
  frame(0.0, -9.0, -4.0, -16.0, 0.05, 0.07, 0.06, 0.08, 2, -4, 3, -3),
  frame(-1.5, -11.0, -2.0, -13.0, -0.03, -0.04, 0.04, 0.05, 0, 0, 1, -1),
  frame(-2.0, -12.0, -2.0, -12.0, -0.05, -0.05, 0.05, 0.05),
  frame(-2.1, -12.1, -2.1, -12.1, -0.06, -0.05, 0.04, 0.05),
  frame(-1.9, -11.9, -1.9, -11.9, -0.05, -0.04, 0.05, 0.06),
  frame(-2.0, -12.0, -2.0, -12.0, -0.05, -0.05, 0.05, 0.05),
]

function frame(
  headX: number,
  headY: number,
  bodyX: number,
  bodyY: number,
  leftEarX: number,
  leftEarY: number,
  rightEarX: number,
  rightEarY: number,
  leekHandX = 0,
  leekHandY = 0,
  normalLeftHandX = 0,
  normalLeftHandY = 0,
): AngryFrame {
  return {
    head: { x: headX, y: headY },
    body: { x: bodyX, y: bodyY },
    leftEar: { x: leftEarX, y: leftEarY },
    rightEar: { x: rightEarX, y: rightEarY },
    leekHand: { x: leekHandX, y: leekHandY },
    normalLeftHand: { x: normalLeftHandX, y: normalLeftHandY },
  }
}

function clonePose(pose: Pose): Pose {
  return { x: pose.x, y: pose.y }
}

function zeroFrame(): AngryFrameWithVelocity {
  return {
    head: clonePose(ZERO),
    body: clonePose(ZERO),
    leftEar: clonePose(ZERO),
    rightEar: clonePose(ZERO),
    leekHand: clonePose(ZERO),
    normalLeftHand: clonePose(ZERO),
    headVelocity: clonePose(ZERO),
    bodyVelocity: clonePose(ZERO),
    leftEarVelocity: clonePose(ZERO),
    rightEarVelocity: clonePose(ZERO),
    leekHandVelocity: clonePose(ZERO),
    normalLeftHandVelocity: clonePose(ZERO),
  }
}

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number) {
  const t2 = t * t
  const t3 = t2 * t
  return 0.5 * (
    2 * p1
    + (-p0 + p2) * t
    + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2
    + (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  )
}

function catmullRomDerivative(p0: number, p1: number, p2: number, p3: number, t: number) {
  const t2 = t * t
  return 0.5 * (
    -p0 + p2
    + 2 * (2 * p0 - 5 * p1 + 4 * p2 - p3) * t
    + 3 * (-p0 + 3 * p1 - 3 * p2 + p3) * t2
  )
}

function periodicPose(
  frames: readonly AngryFrame[],
  key: AngryPoseKey,
  elapsedMs: number,
  durationMs: number,
) {
  const count = frames.length
  const progress = ((elapsedMs % durationMs) + durationMs) % durationMs / durationMs
  const scaled = progress * count
  const index = Math.floor(scaled) % count
  const t = scaled - Math.floor(scaled)
  const p0 = frames[(index - 1 + count) % count][key]
  const p1 = frames[index][key]
  const p2 = frames[(index + 1) % count][key]
  const p3 = frames[(index + 2) % count][key]
  const velocityScale = count / durationMs

  return {
    pose: {
      x: catmullRom(p0.x, p1.x, p2.x, p3.x, t),
      y: catmullRom(p0.y, p1.y, p2.y, p3.y, t),
    },
    velocity: {
      x: catmullRomDerivative(p0.x, p1.x, p2.x, p3.x, t) * velocityScale,
      y: catmullRomDerivative(p0.y, p1.y, p2.y, p3.y, t) * velocityScale,
    },
  }
}

function motionFor(intensity: AngryAnimationIntensity) {
  if (intensity === 'furious') {
    return { frames: FURIOUS_FRAMES, durationMs: ANGRY_ANIMATION.furiousLoopMs }
  }
  if (intensity === 'impatient') {
    return { frames: IMPATIENT_FRAMES, durationMs: ANGRY_ANIMATION.impatientLoopMs }
  }
  return { frames: ANNOYED_FRAMES, durationMs: ANGRY_ANIMATION.annoyedLoopMs }
}

function sampleMotion(intensity: AngryAnimationIntensity, elapsedMs: number): AngryFrameWithVelocity {
  const { frames, durationMs } = motionFor(intensity)
  const head = periodicPose(frames, 'head', elapsedMs, durationMs)
  const body = periodicPose(frames, 'body', elapsedMs, durationMs)
  const leftEar = periodicPose(frames, 'leftEar', elapsedMs, durationMs)
  const rightEar = periodicPose(frames, 'rightEar', elapsedMs, durationMs)
  const leekHand = periodicPose(frames, 'leekHand', elapsedMs, durationMs)
  const normalLeftHand = periodicPose(frames, 'normalLeftHand', elapsedMs, durationMs)

  return {
    head: head.pose,
    body: body.pose,
    leftEar: leftEar.pose,
    rightEar: rightEar.pose,
    leekHand: leekHand.pose,
    normalLeftHand: normalLeftHand.pose,
    headVelocity: head.velocity,
    bodyVelocity: body.velocity,
    leftEarVelocity: leftEar.velocity,
    rightEarVelocity: rightEar.velocity,
    leekHandVelocity: leekHand.velocity,
    normalLeftHandVelocity: normalLeftHand.velocity,
  }
}

function hermite(from: number, fromVelocity: number, to: number, toVelocity: number, elapsedMs: number, durationMs: number) {
  if (durationMs <= 0) return to
  const t = Math.max(0, Math.min(1, elapsedMs / durationMs))
  const t2 = t * t
  const t3 = t2 * t
  const h00 = 2 * t3 - 3 * t2 + 1
  const h10 = t3 - 2 * t2 + t
  const h01 = -2 * t3 + 3 * t2
  const h11 = t3 - t2
  return h00 * from
    + h10 * fromVelocity * durationMs
    + h01 * to
    + h11 * toVelocity * durationMs
}

function hermiteVelocity(from: number, fromVelocity: number, to: number, toVelocity: number, elapsedMs: number, durationMs: number) {
  if (durationMs <= 0) return toVelocity
  const t = Math.max(0, Math.min(1, elapsedMs / durationMs))
  const t2 = t * t
  return (
    (6 * t2 - 6 * t) * from
    + (3 * t2 - 4 * t + 1) * fromVelocity * durationMs
    + (-6 * t2 + 6 * t) * to
    + (3 * t2 - 2 * t) * toVelocity * durationMs
  ) / durationMs
}

function transitionPose(from: Pose, fromVelocity: Pose, to: Pose, toVelocity: Pose, elapsedMs: number, durationMs: number) {
  return {
    pose: {
      x: hermite(from.x, fromVelocity.x, to.x, toVelocity.x, elapsedMs, durationMs),
      y: hermite(from.y, fromVelocity.y, to.y, toVelocity.y, elapsedMs, durationMs),
    },
    velocity: {
      x: hermiteVelocity(from.x, fromVelocity.x, to.x, toVelocity.x, elapsedMs, durationMs),
      y: hermiteVelocity(from.y, fromVelocity.y, to.y, toVelocity.y, elapsedMs, durationMs),
    },
  }
}

function transitionFrame(
  from: AngryFrameWithVelocity,
  to: AngryFrameWithVelocity,
  elapsedMs: number,
  durationMs: number,
): AngryFrameWithVelocity {
  const head = transitionPose(from.head, from.headVelocity, to.head, to.headVelocity, elapsedMs, durationMs)
  const body = transitionPose(from.body, from.bodyVelocity, to.body, to.bodyVelocity, elapsedMs, durationMs)
  const leftEar = transitionPose(from.leftEar, from.leftEarVelocity, to.leftEar, to.leftEarVelocity, elapsedMs, durationMs)
  const rightEar = transitionPose(from.rightEar, from.rightEarVelocity, to.rightEar, to.rightEarVelocity, elapsedMs, durationMs)
  const leekHand = transitionPose(from.leekHand, from.leekHandVelocity, to.leekHand, to.leekHandVelocity, elapsedMs, durationMs)
  const normalLeftHand = transitionPose(from.normalLeftHand, from.normalLeftHandVelocity, to.normalLeftHand, to.normalLeftHandVelocity, elapsedMs, durationMs)
  return {
    head: head.pose,
    body: body.pose,
    leftEar: leftEar.pose,
    rightEar: rightEar.pose,
    leekHand: leekHand.pose,
    normalLeftHand: normalLeftHand.pose,
    headVelocity: head.velocity,
    bodyVelocity: body.velocity,
    leftEarVelocity: leftEar.velocity,
    rightEarVelocity: rightEar.velocity,
    leekHandVelocity: leekHand.velocity,
    normalLeftHandVelocity: normalLeftHand.velocity,
  }
}

function withHead(frame: AngryFrameWithVelocity, head: Pose): AngryFrameWithVelocity {
  return {
    ...frame,
    head: clonePose(head),
    headVelocity: clonePose(ZERO),
  }
}

export class AngryAnimation {
  private phase: AngryAnimationPhase = 'idle'
  private intensity: AngryAnimationIntensity = 'annoyed'
  private requestedIntent: AngryAnimationIntent = { intensity: 'annoyed' }
  private pose = zeroFrame()
  private transitionFrom = zeroFrame()
  private transitionTo = zeroFrame()
  private transitionElapsed = 0
  private loopElapsed = 0
  private readonly hairMotion = new MikuCatHairMotion()

  constructor(private readonly writeParameter: (id: string, value: number) => void) { }

  public get isActive() {
    return this.phase !== 'idle'
  }

  public get snapshot() {
    return {
      phase: this.phase,
      intensity: this.intensity,
      requestedIntent: { ...this.requestedIntent },
      head: clonePose(this.pose.head),
      headVelocity: clonePose(this.pose.headVelocity),
      body: clonePose(this.pose.body),
      bodyVelocity: clonePose(this.pose.bodyVelocity),
      leftEar: clonePose(this.pose.leftEar),
      rightEar: clonePose(this.pose.rightEar),
      leekHand: clonePose(this.pose.leekHand),
      normalLeftHand: clonePose(this.pose.normalLeftHand),
      hair: this.hairMotion.snapshot,
    }
  }

  public setIntent(intent: AngryAnimationIntent) {
    this.requestedIntent = { intensity: intent.intensity }
    return true
  }

  public start(initialHead: Pose = ZERO) {
    if (this.phase === 'entering' || this.phase === 'playing') return false

    const subscribe = this.phase === 'idle'
    if (subscribe) {
      this.pose = withHead(zeroFrame(), initialHead)
      this.hairMotion.reset()
    }
    this.intensity = this.requestedIntent.intensity
    this.transitionFrom = this.pose
    this.transitionTo = sampleMotion(this.intensity, 0)
    this.transitionElapsed = 0
    this.loopElapsed = 0
    this.phase = 'entering'
    this.writePose()
    return subscribe
  }

  public stop(targetHead: Pose = ZERO) {
    if (this.phase === 'idle' || this.phase === 'leaving') return false

    this.transitionFrom = this.pose
    this.transitionTo = withHead(zeroFrame(), targetHead)
    this.transitionElapsed = 0
    this.phase = 'leaving'
    return true
  }

  public abort() {
    this.phase = 'idle'
    this.pose = zeroFrame()
    this.transitionFrom = zeroFrame()
    this.transitionTo = zeroFrame()
    this.transitionElapsed = 0
    this.loopElapsed = 0
    this.hairMotion.reset()
  }

  public update(deltaMs: number) {
    if (!this.isActive || !Number.isFinite(deltaMs) || deltaMs <= 0) return

    const elapsed = Math.min(deltaMs, ANGRY_ANIMATION.maxFrameMs)
    if (this.phase === 'entering') {
      this.transitionElapsed = Math.min(ANGRY_ANIMATION.enterMs, this.transitionElapsed + elapsed)
      this.pose = transitionFrame(
        this.transitionFrom,
        this.transitionTo,
        this.transitionElapsed,
        ANGRY_ANIMATION.enterMs,
      )
      if (this.transitionElapsed >= ANGRY_ANIMATION.enterMs) {
        this.phase = 'playing'
        this.loopElapsed = 0
        this.pose = sampleMotion(this.intensity, 0)
      }
    } else if (this.phase === 'playing') {
      const { durationMs } = motionFor(this.intensity)
      this.loopElapsed = (this.loopElapsed + elapsed) % durationMs
      this.pose = sampleMotion(this.intensity, this.loopElapsed)
    } else if (this.phase === 'leaving') {
      this.transitionElapsed = Math.min(ANGRY_ANIMATION.exitMs, this.transitionElapsed + elapsed)
      this.pose = transitionFrame(
        this.transitionFrom,
        this.transitionTo,
        this.transitionElapsed,
        ANGRY_ANIMATION.exitMs,
      )
      if (this.transitionElapsed >= ANGRY_ANIMATION.exitMs) {
        this.phase = 'idle'
        this.pose = zeroFrame()
        this.hairMotion.reset()
      }
    }

    if (this.phase !== 'idle') {
      this.hairMotion.update(elapsed, this.pose.head, this.pose.headVelocity)
    }
    this.writePose()
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
    this.writeParameter(MIKUCAT_LEEK_HAND_CHANNELS.x, this.pose.leekHand.x)
    this.writeParameter(MIKUCAT_LEEK_HAND_CHANNELS.y, this.pose.leekHand.y)
    this.writeParameter(MIKUCAT_NORMAL_LEFT_HAND_CHANNELS.x, this.pose.normalLeftHand.x)
    this.writeParameter(MIKUCAT_NORMAL_LEFT_HAND_CHANNELS.y, this.pose.normalLeftHand.y)
    for (const [id, value] of Object.entries(this.hairMotion.snapshot)) {
      this.writeParameter(id, value)
    }
  }
}
