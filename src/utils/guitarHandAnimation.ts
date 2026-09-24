import type { GuitarMotifId } from './guitarMotifs'
import type { GuitarClip, GuitarEnsembleMotion, GuitarHeadAction, GuitarKey, GuitarMode, GuitarPerformanceIntent, GuitarPerformanceProfile, GuitarPerformanceTemplateId, GuitarPhrase, HandPose } from './guitarPerformance'

import { GuitarHairMotion } from './guitarHairMotion'
import { GUITAR_MOTIF_PREVIEW, GUITAR_MOTIF_PREVIEW_PHRASE_ID, GUITAR_MOTIF_PREVIEW_SEQUENCE, GUITAR_MOTIFS } from './guitarMotifs'
import { GUITAR_CLIPS, GUITAR_ENSEMBLE_MOTIONS, GUITAR_ENSEMBLE_SCALES, GUITAR_ESTABLISH_PHRASE_ID, GUITAR_HEAD, GUITAR_HEAD_ACTIONS, GUITAR_KINEMATIC_COUPLING, GUITAR_MODES, GUITAR_PERFORMANCE, GUITAR_PERFORMANCE_PROFILES, GUITAR_PERFORMANCE_TEMPLATES, GUITAR_PHRASES, mapGuitarFrettingPose, mapGuitarStrumPose } from './guitarPerformance'
import { GuitarPerformancePlanner } from './guitarPerformancePlanner'
import { MIKUCAT_GUITAR_ROLES, MIKUCAT_V2_CHANNELS } from './modelParameterOwnership'

type Phase = 'idle' | 'entering' | 'playing' | 'leaving'
interface Target { pose: HandPose, velocity: HandPose, durationMs: number }
interface Segment extends Target { from: HandPose, fromVelocity: HandPose, elapsedMs: number }
interface Track {
  pose: HandPose
  velocity: HandPose
  segment?: Segment
  targets: Target[]
}

type EnsembleTrackName = keyof GuitarEnsembleMotion
type PhraseTrackName = 'head' | EnsembleTrackName
const ENSEMBLE_TRACK_NAMES: readonly EnsembleTrackName[] = ['body', 'frettingHand', 'guitar', 'leftEar', 'rightEar']

const zero = (): HandPose => ({ x: 0, y: 0 })
const createTrack = (): Track => ({ pose: zero(), velocity: zero(), targets: [] })
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
const approach = (value: number, target: number, step: number) => value + clamp(target - value, -step, step)
const bounded = (pose: HandPose): HandPose => ({ x: clamp(pose.x, -30, 30), y: clamp(pose.y, -30, 30) })
const samePose = (left: HandPose, right: HandPose) => left.x === right.x && left.y === right.y
const FLOWING_TANGENT_WEIGHT = 0.72
const MOTIF_PREVIEW_CARRIER = GUITAR_PHRASES.find(phrase => phrase.id === GUITAR_ESTABLISH_PHRASE_ID)!
function motifPreviewPhrase(motifId: GuitarMotifId): GuitarPhrase {
  return {
    ...MOTIF_PREVIEW_CARRIER,
    id: GUITAR_MOTIF_PREVIEW_PHRASE_ID,
    steps: GUITAR_MOTIFS[motifId].steps,
  }
}

function defaultIntent(): GuitarPerformanceIntent {
  return {
    profile: 'autonomous',
    activity: 0,
    releasing: false,
  }
}

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
  private readonly tracks: Record<PhraseTrackName, Track> = {
    head: createTrack(),
    body: createTrack(),
    frettingHand: createTrack(),
    guitar: createTrack(),
    leftEar: createTrack(),
    rightEar: createTrack(),
  }

  private phrase?: GuitarPhrase
  private headActionId?: GuitarHeadAction
  private headActionPart = 0
  private headActionCooldown = 0
  private stepIndex = 0
  private phraseNumber = 0
  private profile: GuitarPerformanceProfile = 'autonomous'
  private requestedIntent = defaultIntent()
  private templateOverride?: GuitarPerformanceTemplateId
  private requestedMotifPreview?: GuitarMotifId
  private activeMotifPreview?: GuitarMotifId
  private activePhraseMotif?: GuitarMotifId
  private motifPreviewCursor = 0
  private motifPreviewSlotIndex?: number
  private mode: GuitarMode = 'gentle'
  private modeRemaining = 0
  private readonly performancePlanner = new GuitarPerformancePlanner()
  private readonly hairMotion = new GuitarHairMotion()
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
    const rendered = this.renderedPoses()
    return {
      phase: this.phase,
      profile: this.profile,
      requestedIntent: { ...this.requestedIntent },
      templateOverride: this.templateOverride,
      requestedMotifPreview: this.requestedMotifPreview,
      activeMotifPreview: this.activeMotifPreview,
      activePhraseMotif: this.activePhraseMotif,
      motifPreviewSlotIndex: this.motifPreviewSlotIndex,
      mode: this.mode,
      phraseId: this.phrase?.id,
      headActionId: this.headActionId,
      headActionPart: this.headActionPart,
      headActionCooldown: this.headActionCooldown,
      phraseNumber: this.phraseNumber,
      plan: this.performancePlanner.snapshot,
      clipId: this.clipId,
      bpm: this.bpm,
      energy: this.energy,
      pose: { ...this.pose },
      velocity: { ...this.velocity },
      strummingGesture: { ...this.pose },
      strummingHand: rendered.strummingHand,
      headGesture: { ...this.tracks.head.pose },
      headGestureVelocity: { ...this.tracks.head.velocity },
      head: rendered.head,
      headVelocity: rendered.headVelocity,
      body: { ...this.tracks.body.pose },
      frettingGesture: { ...this.tracks.frettingHand.pose },
      frettingHand: rendered.frettingHand,
      guitar: { ...this.tracks.guitar.pose },
      leftEar: { ...this.tracks.leftEar.pose },
      rightEar: { ...this.tracks.rightEar.pose },
      hair: this.hairMotion.snapshot,
    }
  }

  private renderedPoses() {
    const { body, frettingHand, guitar, head } = this.tracks
    return {
      head: bounded({
        x: head.pose.x + body.pose.x * GUITAR_KINEMATIC_COUPLING.bodyToHead.x,
        y: head.pose.y + body.pose.y * GUITAR_KINEMATIC_COUPLING.bodyToHead.y,
      }),
      headVelocity: {
        x: head.velocity.x + body.velocity.x * GUITAR_KINEMATIC_COUPLING.bodyToHead.x,
        y: head.velocity.y + body.velocity.y * GUITAR_KINEMATIC_COUPLING.bodyToHead.y,
      },
      strummingHand: bounded({
        x: this.pose.x + guitar.pose.x * GUITAR_KINEMATIC_COUPLING.guitarToStrummingHand.x,
        y: this.pose.y + guitar.pose.y * GUITAR_KINEMATIC_COUPLING.guitarToStrummingHand.y,
      }),
      frettingHand: bounded({
        x: frettingHand.pose.x + guitar.pose.x * GUITAR_KINEMATIC_COUPLING.guitarToFrettingHand.x,
        y: frettingHand.pose.y + guitar.pose.y * GUITAR_KINEMATIC_COUPLING.guitarToFrettingHand.y,
      }),
    }
  }

  /**
   * Records presentation intent without touching the current pose or phrase.
   * The requested profile becomes active at the next phrase boundary.
   */
  public setIntent(intent: GuitarPerformanceIntent) {
    if (!(intent.profile in GUITAR_PERFORMANCE_PROFILES)) return false

    this.requestedIntent = {
      profile: intent.profile,
      activity: clamp(Number.isFinite(intent.activity) ? intent.activity : 0, 0, 1),
      releasing: Boolean(intent.releasing),
    }
    return true
  }

  /**
   * Selects an authored template for isolated visual review. The currently
   * playing phrase is never interrupted; the planner adopts the override at
   * the next phrase boundary and restarts from the template's establish slot.
   */
  public setTemplateOverride(templateId?: GuitarPerformanceTemplateId) {
    if (templateId !== undefined && !(templateId in GUITAR_PERFORMANCE_TEMPLATES)) return false

    this.templateOverride = templateId
    return true
  }

  /**
   * Inserts one Motif after A A A-prime for contextual visual review. This is
   * deliberately separate from production score selection: adoption and exit
   * happen at phrase boundaries, and no production template schedules it.
   */
  public setMotifPreview(motifId?: GuitarMotifId) {
    if (motifId !== undefined && !(motifId in GUITAR_MOTIFS)) return false

    this.requestedMotifPreview = motifId
    return true
  }

  // Returns true only when a ticker subscription is needed. Re-entry keeps the existing ticker.
  public start(initialPose = zero(), initialHead = zero()) {
    if (this.isActive && this.phase !== 'leaving') return false

    const subscribe = !this.isActive
    if (subscribe) {
      this.pose = bounded(initialPose)
      this.velocity = zero()
      for (const track of Object.values(this.tracks)) {
        track.pose = zero()
        track.velocity = zero()
        track.segment = undefined
        track.targets = []
      }
      this.tracks.head.pose = bounded(initialHead)
      this.profile = this.requestedIntent.profile
      this.mode = 'gentle'
      this.modeRemaining = 0
      this.performancePlanner.reset()
      this.hairMotion.reset()
      this.activeMotifPreview = undefined
      this.activePhraseMotif = undefined
      this.motifPreviewCursor = 0
      this.motifPreviewSlotIndex = undefined
      this.phraseNumber = 0
      this.phrasesSinceAccent = GUITAR_PERFORMANCE.accentCooldown
      this.recent = []
      const profile = GUITAR_PERFORMANCE_PROFILES[this.profile]
      this.bpm = this.profile === 'autonomous' ? 86 : (profile.bpm[0] + profile.bpm[1]) / 2
      this.energy = this.profile === 'autonomous' ? 0.6 : (profile.energy[0] + profile.energy[1]) / 2
    }
    this.phase = 'entering'
    this.phrase = undefined
    this.headActionId = undefined
    this.headActionPart = 0
    this.headActionCooldown = 0
    this.activeMotifPreview = undefined
    this.activePhraseMotif = undefined
    this.motifPreviewCursor = 0
    this.motifPreviewSlotIndex = undefined
    this.targets = []
    this.beginSegment({ pose: { x: -2, y: 0.2 }, velocity: zero(), durationMs: GUITAR_PERFORMANCE.enterMs })
    this.startTrack(this.tracks.head, [{ pose: zero(), velocity: zero(), durationMs: GUITAR_PERFORMANCE.enterMs }])
    for (const name of ENSEMBLE_TRACK_NAMES) {
      this.startTrack(this.tracks[name], [{ pose: zero(), velocity: zero(), durationMs: GUITAR_PERFORMANCE.enterMs }])
    }
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
    if (this.phase === 'leaving' && exitHead && this.tracks.head.segment) {
      const target = bounded(exitHead)
      if (target.x !== this.tracks.head.segment.pose.x || target.y !== this.tracks.head.segment.pose.y) {
        this.startTrack(this.tracks.head, [{
          pose: target,
          velocity: zero(),
          durationMs: this.tracks.head.segment.durationMs - this.tracks.head.segment.elapsedMs,
        }])
      }
    }

    const frameMs = Math.min(deltaMs, GUITAR_PERFORMANCE.maxFrameMs)
    let remaining = frameMs
    while (remaining > 1e-7 && this.segment) {
      const segment = this.segment
      const consumed = Math.min(remaining, segment.durationMs - segment.elapsedMs)
      segment.elapsedMs += consumed
      remaining -= consumed
      this.sampleSegment(segment)
      this.updateTracks(consumed)
      if (segment.durationMs - segment.elapsedMs < 1e-7) {
        this.pose = { ...segment.pose }
        this.velocity = { ...segment.velocity }
        this.advanceSegment()
      }
    }
    if (this.isActive) {
      const rendered = this.renderedPoses()
      this.hairMotion.update(frameMs, rendered.head, rendered.headVelocity)
    }
    this.writePose()
  }

  public stop(target = zero(), headTarget = zero()) {
    if (!this.isActive || this.phase === 'leaving') return

    this.phase = 'leaving'
    this.targets = []
    this.beginSegment({ pose: bounded(target), velocity: zero(), durationMs: GUITAR_PERFORMANCE.exitMs })
    this.startTrack(this.tracks.head, [{ pose: bounded(headTarget), velocity: zero(), durationMs: GUITAR_PERFORMANCE.exitMs }])
    for (const name of ENSEMBLE_TRACK_NAMES) {
      this.startTrack(this.tracks[name], [{ pose: zero(), velocity: zero(), durationMs: GUITAR_PERFORMANCE.exitMs }])
    }
  }

  public abort() {
    this.phase = 'idle'
    this.segment = undefined
    this.targets = []
    for (const track of Object.values(this.tracks)) {
      track.segment = undefined
      track.targets = []
    }
    this.phrase = undefined
    this.headActionId = undefined
    this.headActionPart = 0
    this.headActionCooldown = 0
    this.activeMotifPreview = undefined
    this.activePhraseMotif = undefined
    this.motifPreviewCursor = 0
    this.motifPreviewSlotIndex = undefined
    this.hairMotion.reset()
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

  private startTrack(track: Track, targets: Target[]) {
    track.targets = targets
    track.segment = segmentFrom(track.pose, track.velocity, track.targets.shift()!)
  }

  private updateTrack(track: Track, deltaMs: number) {
    let remaining = deltaMs
    while (remaining > 1e-7 && track.segment) {
      const segment = track.segment
      const consumed = Math.min(remaining, segment.durationMs - segment.elapsedMs)
      segment.elapsedMs += consumed
      remaining -= consumed
      this.sampleSegment(segment, track.pose, track.velocity)
      if (segment.durationMs - segment.elapsedMs < 1e-7) {
        track.pose = { ...segment.pose }
        track.velocity = { ...segment.velocity }
        const next = track.targets.shift()
        track.segment = next ? segmentFrom(track.pose, track.velocity, next) : undefined
      }
    }
  }

  private updateTracks(deltaMs: number) {
    for (const track of Object.values(this.tracks)) this.updateTrack(track, deltaMs)
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
    if (this.profile !== 'autonomous') {
      const modes = GUITAR_PERFORMANCE_PROFILES[this.profile].phraseModes
      return modes[Math.floor(this.range(0, modes.length))]
    }

    if (this.mode === 'accent') return 'release'
    if (this.mode === 'release' || this.phraseNumber === 0) return 'gentle'
    if (this.mode === 'gentle') return 'groove'
    return this.phrasesSinceAccent >= GUITAR_PERFORMANCE.accentCooldown
      && this.range(0, 1) < GUITAR_PERFORMANCE.accentChance
      ? 'accent'
      : 'gentle'
  }

  private nextPhrase() {
    if (this.profile !== this.requestedIntent.profile) {
      this.profile = this.requestedIntent.profile
      this.modeRemaining = 0
      this.performancePlanner.reset()
    }

    if (this.activeMotifPreview !== this.requestedMotifPreview) {
      this.activeMotifPreview = this.requestedMotifPreview
      this.activePhraseMotif = undefined
      this.motifPreviewCursor = 0
      this.motifPreviewSlotIndex = undefined
      this.performancePlanner.reset()
    }

    const profileConfig = GUITAR_PERFORMANCE_PROFILES[this.profile]
    const performanceTemplateId = this.templateOverride ?? profileConfig.performanceTemplateId
    const previewSlot = this.activeMotifPreview
      ? GUITAR_MOTIF_PREVIEW_SEQUENCE[this.motifPreviewCursor]
      : undefined
    if (previewSlot) {
      this.motifPreviewSlotIndex = this.motifPreviewCursor
      this.motifPreviewCursor = (this.motifPreviewCursor + 1) % GUITAR_MOTIF_PREVIEW_SEQUENCE.length
      this.activePhraseMotif = previewSlot.kind === 'motif' ? this.activeMotifPreview : undefined
    } else {
      this.activePhraseMotif = undefined
      this.motifPreviewSlotIndex = undefined
    }
    const scriptedPlan = !previewSlot && performanceTemplateId
      ? this.performancePlanner.next(performanceTemplateId)
      : undefined
    const scriptedPhraseId = previewSlot?.kind === 'phrase'
      ? previewSlot.phraseId
      : scriptedPlan?.phraseId
    const plannedPhrase = scriptedPhraseId
      ? GUITAR_PHRASES.find(phrase => phrase.id === scriptedPhraseId)
      : undefined
    if (scriptedPhraseId && !plannedPhrase) {
      throw new Error(`Unknown scripted guitar phrase: ${scriptedPhraseId}`)
    }
    const scriptedPhrase = this.activePhraseMotif
      ? motifPreviewPhrase(this.activePhraseMotif)
      : plannedPhrase
    let selectedPhrase: GuitarPhrase | undefined

    if (scriptedPhrase) {
      this.mode = scriptedPhrase.mode
      this.modeRemaining = 0
      selectedPhrase = scriptedPhrase
      this.bpm = (profileConfig.bpm[0] + profileConfig.bpm[1]) / 2
      this.energy = (profileConfig.energy[0] + profileConfig.energy[1]) / 2
      this.home = zero()
      this.headActionId = undefined
      this.headActionPart = 0
      this.headActionCooldown = 0
    } else if (this.modeRemaining === 0) {
      this.mode = this.nextMode()
      const [min, max] = GUITAR_MODES[this.mode].phrases
      this.modeRemaining = Math.floor(this.range(min, max + 1))
    }
    if (!scriptedPhrase) this.modeRemaining--
    this.phrasesSinceAccent = this.mode === 'accent' ? 0 : this.phrasesSinceAccent + 1
    if (!scriptedPhrase) {
      const available = GUITAR_PHRASES.filter(phrase => phrase.mode === this.mode
        && (!phrase.profiles || phrase.profiles.includes(this.profile)))
      const fresh = available.filter(phrase => !this.recent.includes(phrase.id))
      const alternatives = available.filter(phrase => phrase.id !== this.recent.at(-1))
      const choices = fresh.length ? fresh : alternatives.length ? alternatives : available
      selectedPhrase = choices[Math.floor(this.range(0, choices.length))]
    }
    if (!selectedPhrase) throw new Error(`No guitar phrase available for ${this.profile}/${this.mode}`)
    this.phrase = selectedPhrase
    this.recent = [...this.recent.slice(-1), selectedPhrase.id]
    if (!scriptedPhrase) {
      const tuning = this.profile === 'autonomous'
        ? GUITAR_MODES[this.mode]
        : profileConfig
      this.bpm = approach(this.bpm, this.range(...tuning.bpm), GUITAR_PERFORMANCE.tempoStep)
      this.energy = approach(this.energy, this.range(...tuning.energy), GUITAR_PERFORMANCE.energyStep)
      this.home = { x: this.range(-2, 2), y: this.range(-0.3, 0.3) }
      this.advanceHeadAction()
    }
    this.phraseNumber++
    this.stepIndex = 0
    this.beginPhraseTracks()
    this.beginClip()
  }

  private advanceHeadAction() {
    if (this.headActionId) {
      const action = GUITAR_HEAD_ACTIONS[this.headActionId]
      if (this.headActionPart + 1 < action.parts.length) {
        this.headActionPart++
        return
      }

      this.headActionId = undefined
      this.headActionPart = 0
      this.headActionCooldown = action.cooldownPhrases
    }

    if (this.headActionCooldown > 0) {
      this.headActionCooldown--
      return
    }

    const chance = GUITAR_PERFORMANCE_PROFILES[this.profile].headActionChance
    if (chance <= 0 || this.range(0, 1) >= chance) return

    const actions = Object.keys(GUITAR_HEAD_ACTIONS) as GuitarHeadAction[]
    this.headActionId = actions[Math.floor(this.range(0, actions.length))]
    this.headActionPart = 0
  }

  private beginClip() {
    const [clip, beats, strength] = this.phrase!.steps[this.stepIndex]
    this.clipId = clip
    const durationMs = beats * 60000 / this.bpm
    const scaleX = GUITAR_PERFORMANCE.travelX * this.energy * strength
    const scaleY = GUITAR_PERFORMANCE.travelY * this.energy * strength
    let previous = 0
    this.targets = GUITAR_CLIPS[clip].map((key) => {
      const pose = mapGuitarStrumPose({
        x: key.x * scaleX,
        y: key.y * scaleY,
      })
      const velocity = mapGuitarStrumPose({
        x: (key.vx ?? 0) * scaleX / durationMs,
        y: (key.vy ?? 0) * scaleY / durationMs,
      })
      const target: Target = {
        pose: clip === 'rest'
          ? { ...this.pose }
          : {
              x: this.home.x + pose.x,
              y: this.home.y + pose.y,
            },
        velocity,
        durationMs: (key.at - previous) * durationMs,
      }
      previous = key.at
      return target
    })
    this.beginSegment(this.targets.shift()!)
  }

  private keysToTargets(
    keys: readonly GuitarKey[],
    durationMs: number,
    scaleX: (value: number) => number,
    scaleY: (value: number) => number,
    mapPose: (pose: HandPose) => HandPose = pose => pose,
  ) {
    const poses = keys.map(key => mapPose({ x: scaleX(key.x), y: scaleY(key.y) }))
    let previousAt = 0
    return keys.map((key, index) => {
      const pose = poses[index]
      const before = poses[index - 1]
      const after = poses[index + 1]
      const isFlowingKey = before && after
        && !samePose(pose, before)
        && !samePose(pose, after)
      const neighboringDurationMs = isFlowingKey
        ? (keys[index + 1].at - keys[index - 1].at) * durationMs
        : 0
      const authoredVelocity = key.vx !== undefined || key.vy !== undefined
        ? mapPose({
            x: scaleX(key.vx ?? 0) / durationMs,
            y: scaleY(key.vy ?? 0) / durationMs,
          })
        : undefined
      const target = {
        pose,
        velocity: {
          x: authoredVelocity
            ? authoredVelocity.x
            : isFlowingKey
              ? (after.x - before.x) * FLOWING_TANGENT_WEIGHT / neighboringDurationMs
              : 0,
          y: authoredVelocity
            ? authoredVelocity.y
            : isFlowingKey
              ? (after.y - before.y) * FLOWING_TANGENT_WEIGHT / neighboringDurationMs
              : 0,
        },
        durationMs: (key.at - previousAt) * durationMs,
      }
      previousAt = key.at
      return target
    })
  }

  private beginPhraseTracks() {
    const phrase = this.phrase!
    const durationMs = phrase.steps.reduce((beats, [, count]) => beats + count, 0) * 60000 / this.bpm
    // Preserve a visible range even during light picking; hand strength is not multiplied in again.
    const weight = GUITAR_HEAD.minimumWeight + (1 - GUITAR_HEAD.minimumWeight) * Math.min(1, this.energy)
    const motif = this.activePhraseMotif ? GUITAR_MOTIFS[this.activePhraseMotif] : undefined
    const previewKeys = (keys: readonly GuitarKey[]) => {
      const mapped = keys.map(key => ({
        ...key,
        at: (GUITAR_MOTIF_PREVIEW.leadInBeats + key.at * motif!.durationBeats)
          / GUITAR_MOTIF_PREVIEW.loopBeats,
      }))
      return mapped.at(-1)?.at === 1
        ? mapped
        : [...mapped, { at: 1, x: 0, y: 0 }]
    }
    const headKeys = motif
      ? previewKeys(motif.tracks.head)
      : this.headActionId
        ? GUITAR_HEAD_ACTIONS[this.headActionId].parts[this.headActionPart]
        : phrase.head
    this.startTrack(this.tracks.head, this.keysToTargets(
      headKeys,
      durationMs,
      value => value * (value < 0 ? GUITAR_HEAD.left : GUITAR_HEAD.right) * weight,
      value => value * (value < 0 ? GUITAR_HEAD.press : GUITAR_HEAD.lift) * weight,
    ))

    const ensembleWeight = GUITAR_ENSEMBLE_SCALES.minimumWeight
      + (1 - GUITAR_ENSEMBLE_SCALES.minimumWeight) * Math.min(1, this.energy)
    const motion = GUITAR_ENSEMBLE_MOTIONS[phrase.ensemble]
    for (const name of ENSEMBLE_TRACK_NAMES) {
      const scale = GUITAR_ENSEMBLE_SCALES[name]
      const profileGain = name === 'body'
        ? GUITAR_PERFORMANCE_PROFILES[this.profile].bodyGain
        : 1
      this.startTrack(this.tracks[name], this.keysToTargets(
        motif && (name === 'body' || name === 'leftEar' || name === 'rightEar' || name === 'frettingHand')
          ? previewKeys(motif.tracks[name])
          : motion[name],
        durationMs,
        value => value * scale.x * ensembleWeight * profileGain,
        value => value * scale.y * ensembleWeight * profileGain,
        name === 'frettingHand' ? mapGuitarFrettingPose : undefined,
      ))
    }
  }

  private writePose() {
    const { body, leftEar, rightEar, guitar } = this.tracks
    const rendered = this.renderedPoses()
    this.writeParameter(MIKUCAT_V2_CHANNELS.head.x, rendered.head.x)
    this.writeParameter(MIKUCAT_V2_CHANNELS.head.y, rendered.head.y)
    this.writeParameter(MIKUCAT_V2_CHANNELS.body.x, body.pose.x)
    this.writeParameter(MIKUCAT_V2_CHANNELS.body.y, body.pose.y)
    this.writeParameter(MIKUCAT_V2_CHANNELS.leftEar.x, leftEar.pose.x)
    this.writeParameter(MIKUCAT_V2_CHANNELS.leftEar.y, leftEar.pose.y)
    this.writeParameter(MIKUCAT_V2_CHANNELS.rightEar.x, rightEar.pose.x)
    this.writeParameter(MIKUCAT_V2_CHANNELS.rightEar.y, rightEar.pose.y)
    this.writeParameter(MIKUCAT_GUITAR_ROLES.frettingHand.x, rendered.frettingHand.x)
    this.writeParameter(MIKUCAT_GUITAR_ROLES.frettingHand.y, rendered.frettingHand.y)
    this.writeParameter(MIKUCAT_GUITAR_ROLES.strummingHand.x, rendered.strummingHand.x)
    this.writeParameter(MIKUCAT_GUITAR_ROLES.strummingHand.y, rendered.strummingHand.y)
    this.writeParameter(MIKUCAT_V2_CHANNELS.guitar.x, guitar.pose.x)
    this.writeParameter(MIKUCAT_V2_CHANNELS.guitar.y, guitar.pose.y)
    for (const [id, value] of Object.entries(this.hairMotion.snapshot)) {
      this.writeParameter(id, value)
    }
  }
}
