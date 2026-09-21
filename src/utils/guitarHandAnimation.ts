import type { GuitarClip, GuitarMode, GuitarPhrase, HandPose } from './guitarPerformance'

import { GUITAR_CLIPS, GUITAR_HEAD, GUITAR_MODES, GUITAR_PERFORMANCE, GUITAR_PHRASES } from './guitarPerformance'

type Phase = 'idle' | 'entering' | 'playing' | 'leaving'
interface Target { pose: HandPose, velocity: HandPose, durationMs: number }
interface Segment extends Target { from: HandPose, fromVelocity: HandPose, elapsedMs: number }

const zero = (): HandPose => ({ x: 0, y: 0 })
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
const approach = (value: number, target: number, step: number) => value + clamp(target - value, -step, step)
const bounded = (pose: HandPose): HandPose => ({ x: clamp(pose.x, -30, 30), y: clamp(pose.y, -30, 30) })

function segmentFrom(pose: HandPose, velocity: HandPose, target: Target): Segment {
  return {
    ...target,
    pose: bounded(target.pose),
    durationMs: Math.max(1, target.durationMs),
    from: { ...pose },
    fromVelocity: { ...velocity },
    elapsedMs: 0,
  }
}

export class GuitarHandAnimation {
  private phase: Phase = 'idle'
  private pose = zero()
  private velocity = zero()
  private segment?: Segment
  private targets: Target[] = []
  private head = zero()
  private headVelocity = zero()
  private headSegment?: Segment
  private headTargets: Target[] = []
  private phrase?: GuitarPhrase
  private stepIndex = 0
  private phraseNumber = 0
  private mode: GuitarMode = 'gentle'
  private modeRemaining = 0
  private phrasesSinceAccent: number = GUITAR_PERFORMANCE.accentCooldown
  private recent: string[] = []
  private bpm = 86
  private energy = 0.6
  private home = zero()
  private clipId: GuitarClip = 'settle'

  constructor(
    private readonly writeParameter: (id: string, value: number) => void,
    private readonly random: () => number = Math.random,
  ) { }

  public get isActive() {
    return this.phase !== 'idle'
  }

  public get snapshot() {
    return {
      phase: this.phase,
      mode: this.mode,
      phraseId: this.phrase?.id,
      phraseNumber: this.phraseNumber,
      clipId: this.clipId,
      bpm: this.bpm,
      energy: this.energy,
      pose: { ...this.pose },
      velocity: { ...this.velocity },
      head: { ...this.head },
    }
  }

  // Returns true only when a ticker subscription is needed. Re-entry keeps the existing ticker.
  public start(initialPose = zero(), initialHead = zero()) {
    if (this.isActive && this.phase !== 'leaving') return false

    const subscribe = !this.isActive
    if (subscribe) {
      this.pose = bounded(initialPose)
      this.velocity = zero()
      this.head = bounded(initialHead)
      this.headVelocity = zero()
      this.mode = 'gentle'
      this.modeRemaining = 0
      this.phraseNumber = 0
      this.phrasesSinceAccent = GUITAR_PERFORMANCE.accentCooldown
      this.recent = []
      this.bpm = 86
      this.energy = 0.6
    }
    this.phase = 'entering'
    this.phrase = undefined
    this.targets = []
    this.beginSegment({ pose: { x: -2, y: 0.2 }, velocity: zero(), durationMs: GUITAR_PERFORMANCE.enterMs })
    this.startHead([{ pose: zero(), velocity: zero(), durationMs: GUITAR_PERFORMANCE.enterMs }])
    this.writePose()
    return subscribe
  }

  public update(deltaMs: number, exitTarget?: HandPose, exitHead?: HandPose) {
    if (!this.isActive || !Number.isFinite(deltaMs) || deltaMs <= 0) return

    // Follow a moving mouse target during handoff without moving the original exit deadline.
    if (this.phase === 'leaving' && exitTarget && this.segment) {
      const target = bounded(exitTarget)
      if (target.x !== this.segment.pose.x || target.y !== this.segment.pose.y) {
        this.beginSegment({
          pose: target,
          velocity: zero(),
          durationMs: this.segment.durationMs - this.segment.elapsedMs,
        })
      }
    }
    if (this.phase === 'leaving' && exitHead && this.headSegment) {
      const target = bounded(exitHead)
      if (target.x !== this.headSegment.pose.x || target.y !== this.headSegment.pose.y) {
        this.startHead([{
          pose: target,
          velocity: zero(),
          durationMs: this.headSegment.durationMs - this.headSegment.elapsedMs,
        }])
      }
    }

    let remaining = Math.min(deltaMs, GUITAR_PERFORMANCE.maxFrameMs)
    while (remaining > 1e-7 && this.segment) {
      const segment = this.segment
      const consumed = Math.min(remaining, segment.durationMs - segment.elapsedMs)
      segment.elapsedMs += consumed
      remaining -= consumed
      this.sampleSegment(segment)
      this.updateHead(consumed)
      if (segment.durationMs - segment.elapsedMs < 1e-7) {
        this.pose = { ...segment.pose }
        this.velocity = { ...segment.velocity }
        this.advanceSegment()
      }
    }
    this.writePose()
  }

  public stop(target = zero(), headTarget = zero()) {
    if (!this.isActive || this.phase === 'leaving') return

    this.phase = 'leaving'
    this.targets = []
    this.beginSegment({ pose: bounded(target), velocity: zero(), durationMs: GUITAR_PERFORMANCE.exitMs })
    this.startHead([{ pose: bounded(headTarget), velocity: zero(), durationMs: GUITAR_PERFORMANCE.exitMs }])
  }

  public abort() {
    this.phase = 'idle'
    this.segment = undefined
    this.targets = []
    this.headSegment = undefined
    this.headTargets = []
    this.phrase = undefined
  }

  private beginSegment(target: Target) {
    this.segment = segmentFrom(this.pose, this.velocity, target)
  }

  private sampleSegment(segment: Segment, pose = this.pose, velocity = this.velocity) {
    const { from, fromVelocity, pose: to, velocity: toVelocity, durationMs } = segment
    const t = segment.elapsedMs / durationMs
    const t2 = t * t
    const t3 = t2 * t
    for (const axis of ['x', 'y'] as const) {
      // Cubic Hermite: inherit the current position AND velocity when changing actions.
      const position = (2 * t3 - 3 * t2 + 1) * from[axis]
        + (t3 - 2 * t2 + t) * durationMs * fromVelocity[axis]
        + (-2 * t3 + 3 * t2) * to[axis]
        + (t3 - t2) * durationMs * toVelocity[axis]
      pose[axis] = clamp(position, -30, 30)
      velocity[axis] = position !== pose[axis]
        ? 0
        : (
            (6 * t2 - 6 * t) * from[axis]
            + (3 * t2 - 4 * t + 1) * durationMs * fromVelocity[axis]
            + (-6 * t2 + 6 * t) * to[axis]
            + (3 * t2 - 2 * t) * durationMs * toVelocity[axis]
          ) / durationMs
    }
  }

  private startHead(targets: Target[]) {
    this.headTargets = targets
    this.headSegment = segmentFrom(this.head, this.headVelocity, this.headTargets.shift()!)
  }

  private updateHead(deltaMs: number) {
    let remaining = deltaMs
    while (remaining > 1e-7 && this.headSegment) {
      const segment = this.headSegment
      const consumed = Math.min(remaining, segment.durationMs - segment.elapsedMs)
      segment.elapsedMs += consumed
      remaining -= consumed
      this.sampleSegment(segment, this.head, this.headVelocity)
      if (segment.durationMs - segment.elapsedMs < 1e-7) {
        this.head = { ...segment.pose }
        this.headVelocity = { ...segment.velocity }
        const next = this.headTargets.shift()
        this.headSegment = next ? segmentFrom(this.head, this.headVelocity, next) : undefined
      }
    }
  }

  private advanceSegment() {
    if (this.phase === 'leaving') {
      this.abort()
    } else if (this.phase === 'entering') {
      this.phase = 'playing'
      this.nextPhrase()
    } else if (this.targets.length) {
      this.beginSegment(this.targets.shift()!)
    } else if (this.phrase && ++this.stepIndex < this.phrase.steps.length) {
      this.beginClip()
    } else {
      this.nextPhrase()
    }
  }

  private range(min: number, max: number) {
    return min + (max - min) * clamp(this.random(), 0, 1 - Number.EPSILON)
  }

  private nextMode(): GuitarMode {
    if (this.mode === 'accent') return 'release'
    if (this.mode === 'release' || this.phraseNumber === 0) return 'gentle'
    if (this.mode === 'gentle') return 'groove'
    return this.phrasesSinceAccent >= GUITAR_PERFORMANCE.accentCooldown
      && this.range(0, 1) < GUITAR_PERFORMANCE.accentChance
      ? 'accent'
      : 'gentle'
  }

  private nextPhrase() {
    if (this.modeRemaining === 0) {
      this.mode = this.nextMode()
      const [min, max] = GUITAR_MODES[this.mode].phrases
      this.modeRemaining = Math.floor(this.range(min, max + 1))
    }
    this.modeRemaining--
    this.phrasesSinceAccent = this.mode === 'accent' ? 0 : this.phrasesSinceAccent + 1
    const available = GUITAR_PHRASES.filter(phrase => phrase.mode === this.mode)
    const fresh = available.filter(phrase => !this.recent.includes(phrase.id))
    const choices = fresh.length ? fresh : available.filter(phrase => phrase.id !== this.recent.at(-1))
    this.phrase = choices[Math.floor(this.range(0, choices.length))]
    this.recent = [...this.recent.slice(-1), this.phrase.id]
    const tuning = GUITAR_MODES[this.mode]
    this.bpm = approach(this.bpm, this.range(...tuning.bpm), GUITAR_PERFORMANCE.tempoStep)
    this.energy = approach(this.energy, this.range(...tuning.energy), GUITAR_PERFORMANCE.energyStep)
    this.home = { x: this.range(-2, 2), y: this.range(-0.3, 0.3) }
    this.phraseNumber++
    this.stepIndex = 0
    this.beginHeadPhrase()
    this.beginClip()
  }

  private beginClip() {
    const [clip, beats, strength] = this.phrase!.steps[this.stepIndex]
    this.clipId = clip
    const durationMs = beats * 60000 / this.bpm
    const scaleX = GUITAR_PERFORMANCE.travelX * this.energy * strength
    const scaleY = GUITAR_PERFORMANCE.travelY * this.energy * strength
    let previous = 0
    this.targets = GUITAR_CLIPS[clip].map((key) => {
      const target: Target = {
        pose: clip === 'rest'
          ? { ...this.pose }
          : {
              x: this.home.x + key.x * scaleX,
              y: this.home.y + key.y * scaleY,
            },
        velocity: { x: (key.vx ?? 0) * scaleX / durationMs, y: (key.vy ?? 0) * scaleY / durationMs },
        durationMs: (key.at - previous) * durationMs,
      }
      previous = key.at
      return target
    })
    this.beginSegment(this.targets.shift()!)
  }

  private beginHeadPhrase() {
    const phrase = this.phrase!
    const durationMs = phrase.steps.reduce((beats, [, count]) => beats + count, 0) * 60000 / this.bpm
    // Preserve a visible range even during light picking; hand strength is not multiplied in again.
    const weight = GUITAR_HEAD.minimumWeight + (1 - GUITAR_HEAD.minimumWeight) * Math.min(1, this.energy)
    let previous = 0
    this.startHead(phrase.head.map((key) => {
      const scaleX = (key.x < 0 ? GUITAR_HEAD.left : GUITAR_HEAD.right) * weight
      const scaleY = (key.y < 0 ? GUITAR_HEAD.press : GUITAR_HEAD.lift) * weight
      const target = {
        pose: { x: key.x * scaleX, y: key.y * scaleY },
        velocity: { x: (key.vx ?? 0) * scaleX / durationMs, y: (key.vy ?? 0) * scaleY / durationMs },
        durationMs: (key.at - previous) * durationMs,
      }
      previous = key.at
      return target
    }))
  }

  private writePose() {
    this.writeParameter('ParamMouseX', this.pose.x)
    this.writeParameter('ParamMouseY', this.pose.y)
    this.writeParameter('ParamAngleX', this.head.x)
    this.writeParameter('ParamAngleY', this.head.y)
  }
}
