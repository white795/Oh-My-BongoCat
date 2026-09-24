/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { GuitarHandAnimation } from './guitarHandAnimation.ts'
import { GUITAR_MOTIF_PREVIEW, GUITAR_MOTIF_PREVIEW_PHRASE_ID, IMMERSED_DOUBLE_NOD_MOTIF_ID } from './guitarMotifs.ts'
import { GUITAR_CLIPS, GUITAR_CONTINUE_TEMPLATE_ID, GUITAR_ENSEMBLE_MOTIONS, GUITAR_ENSEMBLE_SCALES, GUITAR_ESTABLISH_PHRASE_ID, GUITAR_FILL_PHRASE_ID, GUITAR_HEAD, GUITAR_HEAD_ACTIONS, GUITAR_INPUT_BASELINE_TEMPLATE_ID, GUITAR_INPUT_PHRASE_SEQUENCE, GUITAR_KINEMATIC_COUPLING, GUITAR_PERFORMANCE, GUITAR_PERFORMANCE_PROFILES, GUITAR_PERFORMANCE_TEMPLATES, GUITAR_PHRASES, GUITAR_SOFT_CADENCE_PHRASE_ID, GUITAR_SOFT_CLOSE_TEMPLATE_ID, GUITAR_VARIATION_PHRASE_ID, mapGuitarFrettingPose, mapGuitarStrumPose } from './guitarPerformance.ts'
import { MIKUCAT_V2_HAIR_CHANNELS } from './modelParameterOwnership.ts'

function seededRandom(seed = 7) {
  return () => {
    seed = (1664525 * seed + 1013904223) >>> 0
    return seed / 0x100000000
  }
}

function fixture(seed = 7) {
  const writes: Array<[string, number]> = []
  const animation = new GuitarHandAnimation((id, value) => writes.push([id, value]), seededRandom(seed))
  return { animation, writes }
}

function near(actual: number, expected: number, tolerance = 1e-8) {
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} should be near ${expected}`)
}

function advance(animation: GuitarHandAnimation, milliseconds: number, step = 20) {
  let elapsed = 0
  while (elapsed < milliseconds - 1e-7) {
    const delta = Math.min(step, milliseconds - elapsed)
    animation.update(delta)
    elapsed += delta
  }
}

function advanceToNextPhrase(animation: GuitarHandAnimation) {
  const phraseNumber = animation.snapshot.phraseNumber
  for (let elapsed = 0; elapsed < 10_000 && animation.snapshot.phraseNumber === phraseNumber; elapsed += 10) {
    animation.update(10)
  }
  assert.ok(animation.snapshot.phraseNumber > phraseNumber, 'expected the next phrase to begin')
}

function clampParameter(value: number) {
  return Math.max(-30, Math.min(30, value))
}

describe('guitar performance', () => {
  it('rotates the main hand stroke across the tilted strings instead of sweeping horizontally', () => {
    const [fromKey, strikeKey] = GUITAR_CLIPS.down
    const from = mapGuitarStrumPose({
      x: fromKey.x * GUITAR_PERFORMANCE.travelX,
      y: fromKey.y * GUITAR_PERFORMANCE.travelY,
    })
    const strike = mapGuitarStrumPose({
      x: strikeKey.x * GUITAR_PERFORMANCE.travelX,
      y: strikeKey.y * GUITAR_PERFORMANCE.travelY,
    })
    const dx = strike.x - from.x
    const dy = strike.y - from.y
    const angle = Math.atan2(dy, dx) * 180 / Math.PI

    assert.ok(Math.abs(dy) > Math.abs(dx), 'the primary stroke should travel more vertically than horizontally')
    assert.ok(angle < -45 && angle > -70, `expected a diagonal stroke across the strings, got ${angle}°`)
  })

  it('moves chord changes along the tilted guitar neck instead of the model axes', () => {
    const alongNeck = mapGuitarFrettingPose({ x: 10, y: 0 })
    const angle = Math.atan2(alongNeck.y, alongNeck.x) * 180 / Math.PI
    assert.ok(angle > 35 && angle < 45, `expected the fretting axis near the 40° neck, got ${angle}°`)

    const { animation } = fixture(123)
    animation.setIntent({ profile: 'groove', activity: 0.6, releasing: false })
    animation.start()
    advance(animation, GUITAR_PERFORMANCE.enterMs)
    const phrase = GUITAR_PHRASES.find(item => item.id === animation.snapshot.phraseId)!
    const key = GUITAR_ENSEMBLE_MOTIONS[phrase.ensemble].frettingHand[0]
    const phraseDuration = phrase.steps.reduce((beats, [, count]) => beats + count, 0) * 60000 / animation.snapshot.bpm
    const weight = GUITAR_ENSEMBLE_SCALES.minimumWeight
      + (1 - GUITAR_ENSEMBLE_SCALES.minimumWeight) * Math.min(1, animation.snapshot.energy)
    const expected = mapGuitarFrettingPose({
      x: key.x * GUITAR_ENSEMBLE_SCALES.frettingHand.x * weight,
      y: key.y * GUITAR_ENSEMBLE_SCALES.frettingHand.y * weight,
    })
    advance(animation, key.at * phraseDuration)
    near(animation.snapshot.frettingGesture.x, expected.x)
    near(animation.snapshot.frettingGesture.y, expected.y)
  })

  it('gives the fretting hand and body a visible performance range during groove phrases', () => {
    const { animation } = fixture(123)
    animation.setIntent({ profile: 'groove', activity: 0.6, releasing: false })
    animation.start()
    advance(animation, GUITAR_PERFORMANCE.enterMs)

    const ranges = {
      body: { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity },
      frettingHand: { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity },
    }
    for (let elapsed = 0; elapsed < 20_000; elapsed += 10) {
      animation.update(10)
      for (const name of ['body', 'frettingHand'] as const) {
        const pose = animation.snapshot[name]
        ranges[name].minX = Math.min(ranges[name].minX, pose.x)
        ranges[name].maxX = Math.max(ranges[name].maxX, pose.x)
        ranges[name].minY = Math.min(ranges[name].minY, pose.y)
        ranges[name].maxY = Math.max(ranges[name].maxY, pose.y)
      }
    }

    const bodyTravel = Math.hypot(
      ranges.body.maxX - ranges.body.minX,
      ranges.body.maxY - ranges.body.minY,
    )
    const frettingTravel = Math.hypot(
      ranges.frettingHand.maxX - ranges.frettingHand.minX,
      ranges.frettingHand.maxY - ranges.frettingHand.minY,
    )
    assert.ok(bodyTravel > 35, `body travel should be visible across the model, got ${bodyTravel}`)
    assert.ok(frettingTravel > 14, `fretting-hand chord changes should be visible, got ${frettingTravel}`)
  })

  it('gives drive phrases a clearly stronger body range than groove', () => {
    const bodyTravel = (profile: 'groove' | 'drive') => {
      const { animation } = fixture(123)
      animation.setIntent({ profile, activity: profile === 'drive' ? 1 : 0.6, releasing: false })
      animation.start()
      advance(animation, GUITAR_PERFORMANCE.enterMs)
      let minX = Infinity
      let maxX = -Infinity
      let minY = Infinity
      let maxY = -Infinity
      for (let elapsed = 0; elapsed < 20_000; elapsed += 10) {
        animation.update(10)
        const { x, y } = animation.snapshot.body
        minX = Math.min(minX, x)
        maxX = Math.max(maxX, x)
        minY = Math.min(minY, y)
        maxY = Math.max(maxY, y)
      }
      return Math.hypot(maxX - minX, maxY - minY)
    }

    const grooveTravel = bodyTravel('groove')
    const driveTravel = bodyTravel('drive')
    assert.ok(
      driveTravel > grooveTravel * 1.2,
      `drive body range ${driveTravel} should clearly exceed groove ${grooveTravel}`,
    )
  })

  it('keeps both local hand gestures attached to the moving guitar base', () => {
    const { animation } = fixture(123)
    animation.setIntent({ profile: 'drive', activity: 1, releasing: false })
    animation.start()
    advance(animation, GUITAR_PERFORMANCE.enterMs + 900)
    const snapshot = animation.snapshot
    assert.ok(Math.hypot(snapshot.guitar.x, snapshot.guitar.y) > 1, 'exercise a visibly moving guitar pose')

    near(snapshot.strummingHand.x, clampParameter(
      snapshot.strummingGesture.x
      + snapshot.guitar.x * GUITAR_KINEMATIC_COUPLING.guitarToStrummingHand.x,
    ))
    near(snapshot.strummingHand.y, clampParameter(
      snapshot.strummingGesture.y
      + snapshot.guitar.y * GUITAR_KINEMATIC_COUPLING.guitarToStrummingHand.y,
    ))
    near(snapshot.frettingHand.x, clampParameter(
      snapshot.frettingGesture.x
      + snapshot.guitar.x * GUITAR_KINEMATIC_COUPLING.guitarToFrettingHand.x,
    ))
    near(snapshot.frettingHand.y, clampParameter(
      snapshot.frettingGesture.y
      + snapshot.guitar.y * GUITAR_KINEMATIC_COUPLING.guitarToFrettingHand.y,
    ))
  })

  it('carries the body base into the rendered head without erasing the local head gesture', () => {
    const { animation } = fixture(123)
    animation.setIntent({ profile: 'drive', activity: 1, releasing: false })
    animation.start()
    advance(animation, GUITAR_PERFORMANCE.enterMs + 900)
    const snapshot = animation.snapshot
    assert.ok(Math.hypot(snapshot.body.x, snapshot.body.y) > 1, 'exercise a visibly moving body pose')

    near(snapshot.head.x, clampParameter(
      snapshot.headGesture.x + snapshot.body.x * GUITAR_KINEMATIC_COUPLING.bodyToHead.x,
    ))
    near(snapshot.head.y, clampParameter(
      snapshot.headGesture.y + snapshot.body.y * GUITAR_KINEMATIC_COUPLING.bodyToHead.y,
    ))
    assert.notDeepEqual(snapshot.head, snapshot.headGesture)
  })

  it('carries head velocity through flowing keys and never freezes at a large turned pose', () => {
    const { animation } = fixture(123)
    animation.setIntent({ profile: 'groove', activity: 0.6, releasing: false })
    animation.start()
    advance(animation, GUITAR_PERFORMANCE.enterMs)

    const phrase = GUITAR_PHRASES.find(phrase => phrase.id === animation.snapshot.phraseId)!
    const flowingKeyIndex = phrase.head.findIndex((key, index, keys) => {
      if (index === 0 || index === keys.length - 1) return false
      const previous = keys[index - 1]
      const next = keys[index + 1]
      return (previous.x !== key.x || previous.y !== key.y)
        && (next.x !== key.x || next.y !== key.y)
    })
    assert.ok(flowingKeyIndex > 0, `${phrase.id}: expected at least one flowing head key`)
    const phraseDuration = phrase.steps.reduce((beats, [, count]) => beats + count, 0) * 60000 / animation.snapshot.bpm
    advance(animation, phrase.head[flowingKeyIndex].at * phraseDuration)
    assert.ok(
      Math.hypot(animation.snapshot.headVelocity.x, animation.snapshot.headVelocity.y) > 0.001,
      `${phrase.id}: a flowing head key should not brake to zero`,
    )

    let previous = animation.snapshot.head
    let largeStillMs = 0
    let longestLargeStillMs = 0
    for (let elapsed = 0; elapsed < 30_000; elapsed += 10) {
      animation.update(10)
      const head = animation.snapshot.head
      const moved = Math.hypot(head.x - previous.x, head.y - previous.y)
      largeStillMs = Math.hypot(head.x, head.y) > 10 && moved < 0.002
        ? largeStillMs + 10
        : 0
      longestLargeStillMs = Math.max(longestLargeStillMs, largeStillMs)
      previous = head
    }
    assert.ok(longestLargeStillMs < 160, `large turned poses should keep flowing, froze for ${longestLargeStillMs} ms`)
  })

  it('defines four presentation profiles without creating separate playback engines', () => {
    assert.deepEqual(Object.keys(GUITAR_PERFORMANCE_PROFILES), [
      'autonomous',
      'engaged',
      'groove',
      'drive',
    ])

    assert.ok(GUITAR_PERFORMANCE_PROFILES.autonomous.phraseModes.includes('gentle'))
    assert.deepEqual(GUITAR_PERFORMANCE_PROFILES.engaged.phraseModes, ['groove'])
    assert.deepEqual(GUITAR_PERFORMANCE_PROFILES.groove.phraseModes, ['groove'])
    assert.deepEqual(GUITAR_PERFORMANCE_PROFILES.drive.phraseModes, ['groove'])
    assert.ok(GUITAR_PERFORMANCE_PROFILES.engaged.bpm[0] < GUITAR_PERFORMANCE_PROFILES.groove.bpm[0])
    assert.ok(GUITAR_PERFORMANCE_PROFILES.groove.bpm[0] < GUITAR_PERFORMANCE_PROFILES.drive.bpm[0])
    assert.equal(GUITAR_PERFORMANCE_PROFILES.autonomous.headActionChance, 0)
    assert.deepEqual(
      GUITAR_PERFORMANCE_TEMPLATES[GUITAR_INPUT_BASELINE_TEMPLATE_ID].slots.map(slot => slot.candidates[0]),
      GUITAR_INPUT_PHRASE_SEQUENCE,
    )
    for (const profile of ['engaged', 'groove', 'drive'] as const) {
      assert.equal(GUITAR_PERFORMANCE_PROFILES[profile].establishPhraseId, GUITAR_ESTABLISH_PHRASE_ID)
      assert.equal(GUITAR_PERFORMANCE_PROFILES[profile].performanceTemplateId, GUITAR_INPUT_BASELINE_TEMPLATE_ID)
      assert.equal(GUITAR_PERFORMANCE_PROFILES[profile].headActionChance, 0)
    }
  })

  it('authors establish A on one shared four-beat cause-and-response timeline', () => {
    const phrase = GUITAR_PHRASES.find(item => item.id === GUITAR_ESTABLISH_PHRASE_ID)!
    const motion = GUITAR_ENSEMBLE_MOTIONS[phrase.ensemble]
    const phraseBeats = phrase.steps.reduce((sum, [, beats]) => sum + beats, 0)
    const firstDownStrikeBeat = GUITAR_CLIPS.down.reduce((peak, key) => key.x > peak.x ? key : peak).at
      * phrase.steps[0][1]
    const atBeat = (key: { at: number }) => key.at * phraseBeats

    assert.equal(phrase.mode, 'groove')
    assert.equal(phraseBeats, 4)
    assert.ok(atBeat(motion.frettingHand[0]) < firstDownStrikeBeat, 'the fretting hand prepares before the stroke')
    assert.ok(firstDownStrikeBeat < atBeat(motion.guitar[1]), 'the instrument reacts after the stroke')
    assert.ok(atBeat(motion.guitar[1]) < atBeat(motion.body[1]), 'weight reaches the body after the instrument')
    assert.ok(atBeat(motion.body[1]) < atBeat(phrase.head[1]), 'the head answers only after the body')
    assert.ok(atBeat(phrase.head[1]) < atBeat(motion.leftEar[1]), 'the ear supplies the final secondary response')
  })

  it('authors A-prime as a restrained second-half variation that returns to the A boundary', () => {
    const establish = GUITAR_PHRASES.find(item => item.id === GUITAR_ESTABLISH_PHRASE_ID)!
    const variation = GUITAR_PHRASES.find(item => item.id === GUITAR_VARIATION_PHRASE_ID)!
    const establishMotion = GUITAR_ENSEMBLE_MOTIONS[establish.ensemble]
    const variationMotion = GUITAR_ENSEMBLE_MOTIONS[variation.ensemble]
    const phraseBeats = variation.steps.reduce((sum, [, beats]) => sum + beats, 0)
    const doubleStartBeat = variation.steps
      .slice(0, variation.steps.findIndex(([clip]) => clip === 'double'))
      .reduce((sum, [, beats]) => sum + beats, 0)
    const doubleStrikeBeat = doubleStartBeat + GUITAR_CLIPS.double[1].at
    const atBeat = (key: { at: number }) => key.at * phraseBeats

    assert.equal(phraseBeats, 4)
    assert.deepEqual(variation.steps.slice(0, 3), establish.steps.slice(0, 3))
    assert.deepEqual(variation.steps.at(-1), establish.steps.at(-1))
    assert.ok(variation.steps.some(([clip]) => clip === 'double'))

    const frettingPrep = variationMotion.frettingHand.find(key => key.at > 0.5)!
    const guitarAnswer = variationMotion.guitar.find(key => atBeat(key) > doubleStrikeBeat)!
    const bodyAnswer = variationMotion.body.find(key => atBeat(key) > atBeat(guitarAnswer))!
    const headAnswer = variation.head.find(key => atBeat(key) > atBeat(bodyAnswer))!
    const earAnswer = variationMotion.leftEar.find(key => atBeat(key) > atBeat(headAnswer))!
    assert.ok(atBeat(frettingPrep) < doubleStrikeBeat, 'the chord change should prepare the denser stroke')
    assert.ok(doubleStrikeBeat < atBeat(guitarAnswer), 'the guitar should answer the denser stroke')
    assert.ok(atBeat(guitarAnswer) < atBeat(bodyAnswer), 'the body should receive the weight after the guitar')
    assert.ok(atBeat(bodyAnswer) < atBeat(headAnswer), 'the head should acknowledge rather than lead the variation')
    assert.ok(atBeat(headAnswer) < atBeat(earAnswer), 'the ear should remain the final secondary response')

    for (const name of ['body', 'frettingHand', 'guitar', 'leftEar', 'rightEar'] as const) {
      assert.deepEqual(variationMotion[name][0], establishMotion[name][0], `${name} should enter like A`)
      assert.deepEqual(variationMotion[name].at(-1), establishMotion[name].at(-1), `${name} should return to A's boundary`)
    }
    assert.deepEqual(variation.head[0], establish.head[0])
    assert.deepEqual(variation.head.at(-1), establish.head.at(-1))
  })

  it('authors Fill as one accented close, a deliberate hold and a pickup back to A', () => {
    const establish = GUITAR_PHRASES.find(item => item.id === GUITAR_ESTABLISH_PHRASE_ID)!
    const fill = GUITAR_PHRASES.find(item => item.id === GUITAR_FILL_PHRASE_ID)!
    const establishMotion = GUITAR_ENSEMBLE_MOTIONS[establish.ensemble]
    const fillMotion = GUITAR_ENSEMBLE_MOTIONS[fill.ensemble]
    const phraseBeats = fill.steps.reduce((sum, [, beats]) => sum + beats, 0)
    const accentIndex = fill.steps.findIndex(([clip]) => clip === 'accent')
    const accentStartBeat = fill.steps.slice(0, accentIndex).reduce((sum, [, beats]) => sum + beats, 0)
    const accentStrikeBeat = accentStartBeat + GUITAR_CLIPS.accent[1].at * fill.steps[accentIndex][1]
    const atBeat = (key: { at: number }) => key.at * phraseBeats

    assert.equal(phraseBeats, 4)
    assert.equal(fill.steps[0][0], 'double', 'carry the variation energy into the close')
    assert.ok(accentIndex > 0, 'the fill needs one authored accent')
    assert.ok(fill.steps.some(([clip]) => clip === 'rest'))
    assert.ok(fill.steps.some(([clip]) => clip === 'settle'))
    assert.deepEqual(fill.steps.at(-1), establish.steps.at(-1), 'the final pickup must match A')

    const frettingPrep = fillMotion.frettingHand.find(key => key.at > 0.3)!
    const guitarAnswer = fillMotion.guitar.find(key => atBeat(key) > accentStrikeBeat)!
    const bodyAnswer = fillMotion.body.find(key => atBeat(key) > atBeat(guitarAnswer))!
    const headAnswer = fill.head.find(key => atBeat(key) > atBeat(bodyAnswer))!
    const earAnswer = fillMotion.leftEar.find(key => atBeat(key) > atBeat(headAnswer))!
    assert.ok(atBeat(frettingPrep) < accentStrikeBeat)
    assert.ok(accentStrikeBeat < atBeat(guitarAnswer))
    assert.ok(atBeat(guitarAnswer) < atBeat(bodyAnswer))
    assert.ok(atBeat(bodyAnswer) < atBeat(headAnswer))
    assert.ok(atBeat(headAnswer) < atBeat(earAnswer))

    const holdSpans = (keys: readonly { at: number, x: number, y: number }[]) => keys.flatMap((key, index) => {
      const next = keys[index + 1]
      return next && key.x === next.x && key.y === next.y ? [next.at - key.at] : []
    })
    assert.ok(holdSpans(fillMotion.body).length > 0, 'the body should visibly settle instead of moving throughout the fill')
    assert.ok(holdSpans(fill.head).length > 0, 'the head should share the deliberate hold')
    assert.ok(Math.max(...holdSpans(fillMotion.body)) <= 0.08, 'the body hold should read as punctuation, not a frozen frame')
    assert.ok(Math.max(...holdSpans(fill.head)) <= 0.08, 'the head hold should release before it looks stalled')
    assert.deepEqual(holdSpans(fillMotion.leftEar), [], 'the left ear should carry residual motion through the hold')
    assert.deepEqual(holdSpans(fillMotion.rightEar), [], 'the right ear should carry residual motion through the hold')

    const restStep = fill.steps.find(([clip]) => clip === 'rest')!
    const settleStep = fill.steps.find(([clip]) => clip === 'settle')!
    assert.ok(restStep[1] <= 0.25, 'the strumming hand must not freeze for more than a quarter beat')
    assert.ok(settleStep[1] > restStep[1], 'visible recovery should last longer than the exact rest')

    const axisRange = (keys: readonly { x: number, y: number }[], axis: 'x' | 'y') => {
      const values = keys.map(key => key[axis])
      return Math.max(...values) - Math.min(...values)
    }
    assert.ok(axisRange(fillMotion.body, 'x') <= 0.55, 'the fill must not pull the whole body side to side')
    assert.ok(
      axisRange(fillMotion.body, 'y') > axisRange(fillMotion.body, 'x'),
      'the accent should read as a vertical weight drop rather than a lateral tug',
    )
    assert.ok(axisRange(fillMotion.guitar, 'x') <= 0.35, 'guitar recoil should support, not oppose, the whole body')
    assert.ok(axisRange(fill.head, 'x') <= 0.2, 'local head motion should not amplify the torso reversal')

    const bodyAccentBuild = fillMotion.body.filter(key => key.at <= 0.5).map(key => key.x)
    const guitarAccentBuild = fillMotion.guitar.filter(key => key.at <= 0.5).map(key => key.x)
    assert.ok(
      bodyAccentBuild.every((value, index) => index === 0 || value <= bodyAccentBuild[index - 1]),
      'the torso should commit to one horizontal direction while building the accent',
    )
    assert.ok(
      guitarAccentBuild[1] >= guitarAccentBuild[0]
      && guitarAccentBuild.slice(2).every((value, index) => value <= guitarAccentBuild[index + 1]),
      'the guitar may lag once, then must follow the torso without another tug',
    )
    assert.ok(
      (bodyAccentBuild.at(-1)! - bodyAccentBuild[0])
      * (guitarAccentBuild.at(-1)! - guitarAccentBuild[0]) > 0,
      'the guitar should finish the accent build in the same direction as the torso',
    )

    const frettingPreparation = fillMotion.frettingHand.filter(key => key.at <= 0.5).map(key => key.x)
    assert.ok(
      frettingPreparation.every((value, index) => index === 0 || value <= frettingPreparation[index - 1]),
      'the fretting hand should prepare in one direction before releasing',
    )

    for (const name of ['body', 'frettingHand', 'guitar', 'leftEar', 'rightEar'] as const) {
      assert.deepEqual(fillMotion[name][0], establishMotion[name][0], `${name} should enter from the shared boundary`)
      assert.deepEqual(fillMotion[name].at(-1), establishMotion[name].at(-1), `${name} should return to A's boundary`)
    }
    assert.deepEqual(fill.head[0], establish.head[0])
    assert.deepEqual(fill.head.at(-1), establish.head.at(-1))
  })

  it('authors SoftCadence as a quieter close without an accent or frozen full-body hold', () => {
    const establish = GUITAR_PHRASES.find(item => item.id === GUITAR_ESTABLISH_PHRASE_ID)!
    const accentCadence = GUITAR_PHRASES.find(item => item.id === GUITAR_FILL_PHRASE_ID)!
    const softCadence = GUITAR_PHRASES.find(item => item.id === GUITAR_SOFT_CADENCE_PHRASE_ID)!
    const establishMotion = GUITAR_ENSEMBLE_MOTIONS[establish.ensemble]
    const accentMotion = GUITAR_ENSEMBLE_MOTIONS[accentCadence.ensemble]
    const softMotion = GUITAR_ENSEMBLE_MOTIONS[softCadence.ensemble]
    const phraseBeats = softCadence.steps.reduce((sum, [, beats]) => sum + beats, 0)
    const axisRange = (keys: readonly { x: number, y: number }[], axis: 'x' | 'y') => {
      const values = keys.map(key => key[axis])
      return Math.max(...values) - Math.min(...values)
    }
    const hasHold = (keys: readonly { x: number, y: number }[]) => keys.some((key, index) => {
      const next = keys[index + 1]
      return next && key.x === next.x && key.y === next.y
    })
    const leadSteps = softCadence.steps.slice(0, 3)
    const breathBeats = softCadence.steps
      .filter(([clip]) => clip === 'rest' || clip === 'settle')
      .reduce((sum, [, beats]) => sum + beats, 0)

    assert.equal(phraseBeats, 4)
    assert.ok(!softCadence.steps.some(([clip]) => clip === 'accent'))
    assert.equal(leadSteps[0][0], 'pick', 'the soft close should enter with a light articulation, not a downbeat')
    assert.ok(
      leadSteps.every((step, index) => index === 0 || step[2] < leadSteps[index - 1][2]),
      'the lead articulations should decay instead of creating another accent',
    )
    assert.ok(softCadence.steps.some(([clip]) => clip === 'rest'))
    assert.ok(softCadence.steps.some(([clip]) => clip === 'settle'))
    assert.ok(breathBeats >= 1.5, 'the phrase needs a quiet breath before returning to A')
    assert.deepEqual(softCadence.steps.at(-1), establish.steps.at(-1), 'the soft close shares A\'s pickup')
    assert.ok(axisRange(softMotion.body, 'y') < axisRange(accentMotion.body, 'y') * 0.4)
    assert.ok(axisRange(softMotion.guitar, 'y') < axisRange(accentMotion.guitar, 'y') * 0.35)
    assert.equal(hasHold(softMotion.body), false)
    assert.equal(hasHold(softMotion.leftEar), false)
    assert.equal(hasHold(softMotion.rightEar), false)

    for (const name of ['body', 'frettingHand', 'guitar', 'leftEar', 'rightEar'] as const) {
      assert.deepEqual(softMotion[name][0], establishMotion[name][0], `${name} should enter from A's boundary`)
      assert.deepEqual(softMotion[name].at(-1), establishMotion[name].at(-1), `${name} should return to A's boundary`)
    }
    assert.deepEqual(softCadence.head[0], establish.head[0])
    assert.deepEqual(softCadence.head.at(-1), establish.head.at(-1))
  })

  it('plays A A A-prime Fill deterministically for every input profile without motifs or randomization', () => {
    for (const profile of ['engaged', 'groove', 'drive'] as const) {
      let randomCalls = 0
      const animation = new GuitarHandAnimation(() => {}, () => {
        randomCalls++
        return 0.37
      })
      animation.setIntent({ profile, activity: profile === 'drive' ? 1 : 0.5, releasing: false })
      animation.start()
      advance(animation, GUITAR_PERFORMANCE.enterMs)
      const bpm = animation.snapshot.bpm
      const energy = animation.snapshot.energy

      const expected = [...GUITAR_INPUT_PHRASE_SEQUENCE, ...GUITAR_INPUT_PHRASE_SEQUENCE]
      for (const [slot, phraseId] of expected.entries()) {
        assert.equal(animation.snapshot.phraseId, phraseId)
        assert.equal(animation.snapshot.plan?.phraseId, phraseId)
        assert.equal(animation.snapshot.plan?.slotIndex, slot % GUITAR_INPUT_PHRASE_SEQUENCE.length)
        assert.equal(animation.snapshot.plan?.templateIteration, Math.floor(slot / GUITAR_INPUT_PHRASE_SEQUENCE.length))
        assert.equal(animation.snapshot.headActionId, undefined)
        assert.equal(animation.snapshot.bpm, bpm)
        assert.equal(animation.snapshot.energy, energy)
        advanceToNextPhrase(animation)
      }
      assert.equal(randomCalls, 0)
    }
  })

  it('crosses A to A-prime, A-prime to Fill and Fill back to A without resetting any local track', () => {
    const animation = new GuitarHandAnimation(() => {}, () => 0.5)
    animation.setIntent({ profile: 'groove', activity: 0.7, releasing: false })
    animation.start()
    advance(animation, GUITAR_PERFORMANCE.enterMs)

    const crossBoundary = (expectedPhraseId: string) => {
      const phrase = GUITAR_PHRASES.find(item => item.id === animation.snapshot.phraseId)!
      const duration = phrase.steps.reduce((sum, [, beats]) => sum + beats, 0) * 60000 / animation.snapshot.bpm
      advance(animation, duration - 0.1)
      const before = animation.snapshot
      animation.update(0.1)
      const after = animation.snapshot
      assert.equal(after.phraseId, expectedPhraseId)
      for (const name of ['headGesture', 'body', 'frettingGesture', 'strummingGesture', 'guitar', 'leftEar', 'rightEar'] as const) {
        assert.ok(Math.hypot(after[name].x - before[name].x, after[name].y - before[name].y) < 0.01, `${name} should not jump at ${before.phraseId}/${after.phraseId}`)
      }
      assert.ok(Math.hypot(after.headGestureVelocity.x, after.headGestureVelocity.y) > 0.0001)
      assert.ok(Math.hypot(after.velocity.x, after.velocity.y) > 0.0001)
    }

    crossBoundary(GUITAR_ESTABLISH_PHRASE_ID)
    crossBoundary(GUITAR_VARIATION_PHRASE_ID)
    crossBoundary(GUITAR_FILL_PHRASE_ID)
    crossBoundary(GUITAR_ESTABLISH_PHRASE_ID)
  })

  it('carries pose and velocity through the establish A loop boundary', () => {
    const animation = new GuitarHandAnimation(() => {}, () => 0.5)
    animation.setIntent({ profile: 'groove', activity: 0.7, releasing: false })
    animation.start()
    advance(animation, GUITAR_PERFORMANCE.enterMs)
    const phrase = GUITAR_PHRASES.find(item => item.id === GUITAR_ESTABLISH_PHRASE_ID)!
    const duration = phrase.steps.reduce((sum, [, beats]) => sum + beats, 0) * 60000 / animation.snapshot.bpm

    advance(animation, duration - 0.1)
    const before = animation.snapshot
    animation.update(0.1)
    const after = animation.snapshot

    assert.ok(after.phraseNumber > before.phraseNumber)
    assert.equal(after.phraseId, GUITAR_ESTABLISH_PHRASE_ID)
    for (const name of ['headGesture', 'body', 'frettingGesture', 'strummingGesture', 'guitar', 'leftEar', 'rightEar'] as const) {
      assert.ok(Math.hypot(after[name].x - before[name].x, after[name].y - before[name].y) < 0.01, `${name} should not jump at the loop boundary`)
    }
    assert.ok(Math.hypot(after.headGestureVelocity.x, after.headGestureVelocity.y) > 0.0001)
    assert.ok(Math.hypot(after.velocity.x, after.velocity.y) > 0.0001)
  })

  it('can force each profile for isolated visual review while using the same timeline', () => {
    for (const profile of ['autonomous', 'engaged', 'groove', 'drive'] as const) {
      const { animation } = fixture(123)
      animation.setIntent({ profile, activity: profile === 'drive' ? 1 : 0.5, releasing: false })
      animation.start()
      advance(animation, GUITAR_PERFORMANCE.enterMs)

      const snapshot = animation.snapshot
      const tuning = GUITAR_PERFORMANCE_PROFILES[profile]
      assert.equal(snapshot.profile, profile)
      assert.equal(snapshot.requestedIntent.profile, profile)
      assert.ok(tuning.phraseModes.includes(snapshot.mode))
      assert.ok(snapshot.bpm >= tuning.bpm[0] && snapshot.bpm <= tuning.bpm[1])
      assert.ok(snapshot.energy >= tuning.energy[0] && snapshot.energy <= tuning.energy[1])
    }
  })

  it('adopts a new profile only at a phrase boundary without restarting the current pose', () => {
    const { animation } = fixture(123)
    animation.start()
    advance(animation, GUITAR_PERFORMANCE.enterMs + 200)
    const before = animation.snapshot

    animation.setIntent({ profile: 'drive', activity: 1, releasing: false })

    assert.equal(animation.snapshot.profile, 'autonomous')
    assert.equal(animation.snapshot.requestedIntent.profile, 'drive')
    assert.equal(animation.snapshot.phraseNumber, before.phraseNumber)
    assert.deepEqual(animation.snapshot.strummingHand, before.strummingHand)
    assert.deepEqual(animation.snapshot.velocity, before.velocity)

    for (let elapsed = 0; elapsed < 10_000 && animation.snapshot.phraseNumber === before.phraseNumber; elapsed += 20) {
      animation.update(20)
    }

    assert.equal(animation.snapshot.profile, 'drive')
    assert.ok(animation.snapshot.phraseNumber > before.phraseNumber)
    assert.equal(animation.snapshot.phase, 'playing')
    assert.equal(animation.snapshot.phraseId, GUITAR_ESTABLISH_PHRASE_ID)
    assert.equal(animation.snapshot.plan?.templateId, GUITAR_INPUT_BASELINE_TEMPLATE_ID)
    assert.equal(animation.snapshot.plan?.slotIndex, 0)
    assert.equal(animation.snapshot.plan?.templateIteration, 0)
  })

  it('adopts and clears a template override only at phrase boundaries', () => {
    const animation = new GuitarHandAnimation(() => {}, () => 0.5)
    animation.setIntent({ profile: 'groove', activity: 0.7, releasing: false })
    animation.start()
    advance(animation, GUITAR_PERFORMANCE.enterMs + 200)

    const before = animation.snapshot
    assert.equal(before.plan?.templateId, GUITAR_INPUT_BASELINE_TEMPLATE_ID)
    assert.equal(animation.setTemplateOverride(GUITAR_SOFT_CLOSE_TEMPLATE_ID), true)
    assert.equal(animation.snapshot.templateOverride, GUITAR_SOFT_CLOSE_TEMPLATE_ID)
    assert.equal(animation.snapshot.plan?.templateId, GUITAR_INPUT_BASELINE_TEMPLATE_ID)
    assert.deepEqual(animation.snapshot.strummingHand, before.strummingHand)

    advanceToNextPhrase(animation)
    assert.equal(animation.snapshot.plan?.templateId, GUITAR_SOFT_CLOSE_TEMPLATE_ID)
    assert.equal(animation.snapshot.plan?.slotIndex, 0)
    assert.equal(animation.snapshot.phraseId, GUITAR_ESTABLISH_PHRASE_ID)

    advanceToNextPhrase(animation)
    advanceToNextPhrase(animation)
    advanceToNextPhrase(animation)
    assert.equal(animation.snapshot.phraseId, GUITAR_SOFT_CADENCE_PHRASE_ID)
    assert.equal(animation.snapshot.plan?.role, 'soft-cadence')

    assert.equal(animation.setTemplateOverride(GUITAR_CONTINUE_TEMPLATE_ID), true)
    assert.equal(animation.snapshot.phraseId, GUITAR_SOFT_CADENCE_PHRASE_ID)
    advanceToNextPhrase(animation)
    assert.equal(animation.snapshot.plan?.templateId, GUITAR_CONTINUE_TEMPLATE_ID)
    assert.equal(animation.snapshot.plan?.slotIndex, 0)

    assert.equal(animation.setTemplateOverride(undefined), true)
    advanceToNextPhrase(animation)
    assert.equal(animation.snapshot.templateOverride, undefined)
    assert.equal(animation.snapshot.plan?.templateId, GUITAR_INPUT_BASELINE_TEMPLATE_ID)
    assert.equal(animation.snapshot.plan?.slotIndex, 0)
  })

  it('previews immersed-double-nod inside A A A-prime Motif and returns to A', () => {
    const animation = new GuitarHandAnimation(() => {}, () => 0.5)
    animation.setIntent({ profile: 'groove', activity: 0.7, releasing: false })
    assert.equal(animation.setMotifPreview(IMMERSED_DOUBLE_NOD_MOTIF_ID), true)
    animation.start()
    advance(animation, GUITAR_PERFORMANCE.enterMs)

    assert.equal(animation.snapshot.requestedMotifPreview, IMMERSED_DOUBLE_NOD_MOTIF_ID)
    assert.equal(animation.snapshot.activeMotifPreview, IMMERSED_DOUBLE_NOD_MOTIF_ID)
    assert.equal(animation.snapshot.phraseId, GUITAR_ESTABLISH_PHRASE_ID)
    assert.equal(animation.snapshot.motifPreviewSlotIndex, 0)
    assert.equal(animation.snapshot.activePhraseMotif, undefined)

    advanceToNextPhrase(animation)
    assert.equal(animation.snapshot.phraseId, GUITAR_ESTABLISH_PHRASE_ID)
    assert.equal(animation.snapshot.motifPreviewSlotIndex, 1)

    advanceToNextPhrase(animation)
    assert.equal(animation.snapshot.phraseId, GUITAR_VARIATION_PHRASE_ID)
    assert.equal(animation.snapshot.motifPreviewSlotIndex, 2)

    advanceToNextPhrase(animation)
    assert.equal(animation.snapshot.phraseId, GUITAR_MOTIF_PREVIEW_PHRASE_ID)
    assert.equal(animation.snapshot.motifPreviewSlotIndex, 3)
    assert.equal(animation.snapshot.activePhraseMotif, IMMERSED_DOUBLE_NOD_MOTIF_ID)
    const previewPlan = animation.snapshot.plan
    assert.equal(previewPlan, undefined)

    const beatMs = 60000 / animation.snapshot.bpm
    const samples = []
    const clipSequence: string[] = []
    for (let elapsed = 0; elapsed <= beatMs * 3.9; elapsed += 10) {
      samples.push(animation.snapshot)
      if (clipSequence.at(-1) !== animation.snapshot.clipId) clipSequence.push(animation.snapshot.clipId)
      animation.update(10)
    }

    const range = (values: number[]) => Math.max(...values) - Math.min(...values)
    assert.deepEqual(clipSequence, ['down', 'up', 'accent', 'up'])
    assert.ok(range(samples.map(sample => sample.headGesture.y)) > 26, 'the four nods should carry a strong rhythmic weight')
    assert.ok(range(samples.map(sample => sample.body.y)) > 12, 'the body should visibly lean into each nod')
    assert.ok(range(samples.map(sample => sample.headGesture.x)) < 2, 'the preview should remain vertical')
    assert.ok(range(samples.map(sample => sample.strummingGesture.x)) > 8, 'the strumming hand should keep playing')
    assert.ok(range(samples.map(sample => sample.guitar.y)) > 1, 'the guitar should retain the A carrier motion')
    const frettingTravel = Math.hypot(
      range(samples.map(sample => sample.frettingGesture.x)),
      range(samples.map(sample => sample.frettingGesture.y)),
    )
    assert.ok(frettingTravel > 20, 'the custom fretting hand should make a visible heavy-beat chord change')

    advanceToNextPhrase(animation)
    assert.equal(animation.snapshot.phraseId, GUITAR_ESTABLISH_PHRASE_ID)
    assert.equal(animation.snapshot.motifPreviewSlotIndex, 0)
    assert.equal(animation.snapshot.activePhraseMotif, undefined)

    assert.equal(animation.setMotifPreview(undefined), true)
    assert.equal(animation.snapshot.activeMotifPreview, IMMERSED_DOUBLE_NOD_MOTIF_ID)
    advanceToNextPhrase(animation)
    assert.equal(animation.snapshot.requestedMotifPreview, undefined)
    assert.equal(animation.snapshot.activeMotifPreview, undefined)
    assert.equal(animation.snapshot.phraseId, GUITAR_ESTABLISH_PHRASE_ID)
    const resumedPlan = animation.snapshot.plan
    assert.ok(resumedPlan)
    assert.equal(resumedPlan.slotIndex, 0)
  })

  it('releases the fourth nod into the following A without reversing at the inserted boundary', () => {
    const animation = new GuitarHandAnimation(() => {}, () => 0.5)
    animation.setIntent({ profile: 'drive', activity: 1, releasing: false })
    animation.setMotifPreview(IMMERSED_DOUBLE_NOD_MOTIF_ID)
    animation.start()
    advance(animation, GUITAR_PERFORMANCE.enterMs)
    advanceToNextPhrase(animation)
    advanceToNextPhrase(animation)
    advanceToNextPhrase(animation)
    assert.equal(animation.snapshot.phraseId, GUITAR_MOTIF_PREVIEW_PHRASE_ID)

    const beatMs = 60000 / animation.snapshot.bpm
    advance(animation, beatMs * 3.9)
    const samples = []
    for (let elapsed = 0; elapsed <= beatMs * 0.2; elapsed += 2) {
      samples.push(animation.snapshot)
      animation.update(2)
    }

    const staysMonotonic = (values: number[], direction: 'up' | 'down') => values.every((value, index) => {
      if (index === 0) return true
      return direction === 'up'
        ? value >= values[index - 1] - 0.001
        : value <= values[index - 1] + 0.001
    })
    assert.ok(staysMonotonic(samples.map(sample => sample.headGesture.y), 'up'))
    assert.ok(staysMonotonic(samples.map(sample => sample.body.y), 'up'))
    assert.ok(staysMonotonic(samples.map(sample => sample.leftEar.y), 'down'))
    assert.ok(staysMonotonic(samples.map(sample => sample.rightEar.y), 'down'))
  })

  it('crosses A-prime into the Motif and the Motif back to A without resetting local tracks', () => {
    const animation = new GuitarHandAnimation(() => {}, () => 0.5)
    animation.setIntent({ profile: 'groove', activity: 0.7, releasing: false })
    animation.setMotifPreview(IMMERSED_DOUBLE_NOD_MOTIF_ID)
    animation.start()
    advance(animation, GUITAR_PERFORMANCE.enterMs)
    advanceToNextPhrase(animation)
    advanceToNextPhrase(animation)
    assert.equal(animation.snapshot.phraseId, GUITAR_VARIATION_PHRASE_ID)

    const crossBoundary = (expectedPhraseId: string) => {
      const phrase = GUITAR_PHRASES.find(item => item.id === animation.snapshot.phraseId)
      const beats = phrase
        ? phrase.steps.reduce((sum, [, count]) => sum + count, 0)
        : GUITAR_MOTIF_PREVIEW.loopBeats
      const duration = beats * 60000 / animation.snapshot.bpm
      advance(animation, duration - 0.1)
      const before = animation.snapshot
      animation.update(0.1)
      const after = animation.snapshot

      assert.equal(after.phraseId, expectedPhraseId)
      for (const name of ['headGesture', 'body', 'frettingGesture', 'strummingGesture', 'guitar', 'leftEar', 'rightEar'] as const) {
        assert.ok(Math.hypot(after[name].x - before[name].x, after[name].y - before[name].y) < 0.01, `${name} should not jump at ${before.phraseId}/${after.phraseId}`)
      }
    }

    crossBoundary(GUITAR_MOTIF_PREVIEW_PHRASE_ID)
    crossBoundary(GUITAR_ESTABLISH_PHRASE_ID)
  })

  it('authors the input head feature as a slow-entry left pair and a recovering right pair', () => {
    const action = GUITAR_HEAD_ACTIONS['left-right-double-nod']
    assert.equal(action.parts.length, 2)
    const [left, right] = action.parts
    const leftPresses = left.filter(key => key.y <= -0.3)
    const rightPresses = right.filter(key => key.y <= -0.3)

    assert.deepEqual(leftPresses.map(key => Math.sign(key.x)), [-1, -1])
    assert.deepEqual(rightPresses.map(key => Math.sign(key.x)), [1, 1])
    assert.ok(left[0].at >= 0.15, 'leave enough time to blend from the previous slow gesture')
    assert.ok(leftPresses[0].at >= 0.4, 'do not rush into the first nod')
    assert.ok(rightPresses[0].at >= 0.4, 'cross to the right before starting its nods')
    assert.equal(left.at(-1)?.at, 1)
    assert.deepEqual(right.at(-1), { at: 1, x: 0.05, y: 0.04 })
  })

  it('provides distinct authored actions and beat-aligned phrases with safe keyframe ordering', () => {
    assert.equal(Object.keys(GUITAR_CLIPS).length, 7)
    assert.equal(new Set(GUITAR_PHRASES.map(phrase => phrase.id)).size, 14)
    const ensembleTracks = Object.values(GUITAR_ENSEMBLE_MOTIONS)
      .flatMap(motion => Object.values(motion))
    const headActions = Object.values(GUITAR_HEAD_ACTIONS).flatMap(action => action.parts)
    for (const keys of [...Object.values(GUITAR_CLIPS), ...headActions, ...GUITAR_PHRASES.map(phrase => phrase.head), ...ensembleTracks]) {
      let previous = 0
      for (const key of keys) {
        assert.ok(key.at > previous && key.at <= 1)
        previous = key.at
      }
      assert.equal(previous, 1)
    }
    for (const phrase of GUITAR_PHRASES) {
      assert.ok(phrase.steps.every(([clip, beats]) => GUITAR_CLIPS[clip] && beats > 0))
      assert.ok(Number.isInteger(phrase.steps.reduce((sum, [, beats]) => sum + beats, 0)))
      assert.ok(GUITAR_ENSEMBLE_MOTIONS[phrase.ensemble])
    }
  })

  it('enters from the current head pose while independent performance channels start neutral', () => {
    const { animation, writes } = fixture()
    animation.start(undefined, { x: -18, y: 12 })
    const pose = Object.fromEntries(writes)
    assert.equal(pose.ParamAngleX, -18)
    assert.equal(pose.ParamAngleY, 12)
    assert.equal(pose.Param23, 0)
    assert.equal(pose.Param24, 0)
    assert.equal([...Object.keys(pose)].some(id => id === 'ParamMouseX' || id === 'ParamMouseY'), false)
    animation.update(1)
    near(animation.snapshot.pose.x, 0, 0.01)
    near(animation.snapshot.pose.y, 0, 0.01)
    near(animation.snapshot.head.x, -18, 0.01)
    near(animation.snapshot.head.y, 12, 0.01)
  })

  it('does not write parameters when guitar is inactive', () => {
    const { animation, writes } = fixture()
    animation.update(16)
    assert.deepEqual(writes, [])
  })

  it('drives every independent V2 performance channel without consuming mouse position parameters', () => {
    const { animation, writes } = fixture()
    animation.start()
    writes.length = 0
    advance(animation, 700)

    const pose = Object.fromEntries(writes)
    near(pose.Param21, animation.snapshot.strummingHand.x)
    near(pose.Param22, animation.snapshot.strummingHand.y)
    near(pose.Param23, animation.snapshot.frettingHand.x)
    near(pose.Param24, animation.snapshot.frettingHand.y)

    assert.deepEqual([...new Set(writes.map(([id]) => id))].sort(), [
      'Param14',
      'Param15',
      'Param16',
      'Param17',
      'Param18',
      'Param19',
      'Param21',
      'Param22',
      'Param23',
      'Param24',
      'Param34',
      'Param35',
      'ParamAngleX',
      'ParamAngleY',
      ...Object.values(MIKUCAT_V2_HAIR_CHANNELS),
    ].sort())
    assert.equal(writes.some(([id]) => id === 'ParamMouseX' || id === 'ParamMouseY'), false)
  })

  it('adds independent ensemble and hair follow-through without taking over face or mouse channels', () => {
    const { animation, writes } = fixture()
    animation.start()
    writes.length = 0
    advance(animation, 700)
    const { body, frettingHand, guitar, head, leftEar, rightEar, strummingHand } = animation.snapshot
    for (const channel of [body, frettingHand, guitar, head, leftEar, rightEar, strummingHand]) {
      assert.ok(channel.x !== 0 || channel.y !== 0)
    }
    assert.equal(writes.some(([id]) => id.startsWith('ParamMouse') || ['Param9', 'Param10', 'Param11'].includes(id)), false)
  })

  it('lets the hands keep playing while gentle phrases give the head long near-still passages', () => {
    const { animation } = fixture(123)
    const seen = new Set<string>()
    animation.start()
    advance(animation, GUITAR_PERFORMANCE.enterMs)
    for (let count = 0; count < 100 && seen.size < 3; count++) {
      const snapshot = animation.snapshot
      const phrase = GUITAR_PHRASES.find(phrase => phrase.id === snapshot.phraseId)!
      const duration = phrase.steps.reduce((sum, [, beats]) => sum + beats, 0) * 60000 / snapshot.bpm
      if (phrase.mode !== 'gentle') {
        advance(animation, duration)
        continue
      }

      // Allow the previous phrase to settle before measuring the quiet passage.
      advance(animation, duration * 0.25)
      let previousHead = animation.snapshot.head
      let stillMs = 0
      let longestStillMs = 0
      let handMinX = Infinity
      let handMaxX = -Infinity
      let handMinY = Infinity
      let handMaxY = -Infinity
      for (let elapsed = duration * 0.25; elapsed < duration - 1e-7;) {
        const delta = Math.min(10, duration - elapsed)
        animation.update(delta)
        elapsed += delta
        const { head, pose } = animation.snapshot
        assert.ok(Math.abs(head.x) < 6 && Math.abs(head.y) < 6, `${phrase.id}: light picking should not rock the body`)
        stillMs = Math.hypot(head.x - previousHead.x, head.y - previousHead.y) < 0.002 * delta
          ? stillMs + delta
          : 0
        longestStillMs = Math.max(longestStillMs, stillMs)
        previousHead = head
        handMinX = Math.min(handMinX, pose.x)
        handMaxX = Math.max(handMaxX, pose.x)
        handMinY = Math.min(handMinY, pose.y)
        handMaxY = Math.max(handMaxY, pose.y)
      }
      assert.ok(longestStillMs >= 500, `${phrase.id}: allow at least half a second of near stillness`)
      assert.ok(
        Math.hypot(handMaxX - handMinX, handMaxY - handMinY) > 5,
        `${phrase.id}: hands should continue playing while the head rests`,
      )
      seen.add(phrase.id)
    }
    assert.equal(seen.size, 3, 'exercise all light-picking phrases')
  })

  it('keeps the same pose for the same elapsed time at different frame rates', () => {
    const slow = fixture()
    const fast = fixture()
    slow.animation.start()
    fast.animation.start()
    advance(slow.animation, 30000, 1000 / 30)
    advance(fast.animation, 30000, 1000 / 60)
    for (const name of ['head', 'body', 'leftEar', 'rightEar', 'frettingHand', 'strummingHand', 'guitar'] as const) {
      near(slow.animation.snapshot[name].x, fast.animation.snapshot[name].x)
      near(slow.animation.snapshot[name].y, fast.animation.snapshot[name].y)
    }
    assert.equal(slow.animation.snapshot.phraseId, fast.animation.snapshot.phraseId)
  })

  it('finishes the authored head trajectory despite short hand clips and rests inside the phrase', () => {
    const animation = new GuitarHandAnimation(() => {}, () => 0.5)
    animation.start()
    advance(animation, GUITAR_PERFORMANCE.enterMs)
    const snapshot = animation.snapshot
    const phrase = GUITAR_PHRASES.find(phrase => phrase.id === snapshot.phraseId)!
    assert.ok(phrase.steps.some(([clip, beats]) => clip === 'rest' && beats < 0.5))
    const duration = phrase.steps.reduce((beats, [, count]) => beats + count, 0) * 60000 / snapshot.bpm
    const weight = GUITAR_HEAD.minimumWeight + (1 - GUITAR_HEAD.minimumWeight) * Math.min(1, snapshot.energy)
    let previous = 0
    for (const key of phrase.head) {
      advance(animation, (key.at - previous) * duration)
      near(animation.snapshot.headGesture.x, key.x * (key.x < 0 ? GUITAR_HEAD.left : GUITAR_HEAD.right) * weight)
      near(animation.snapshot.headGesture.y, key.y * (key.y < 0 ? GUITAR_HEAD.press : GUITAR_HEAD.lift) * weight)
      previous = key.at
    }
  })

  it('lands an accent nod in under 300 ms, holds its weight briefly and recovers without another large swing', () => {
    const { animation } = fixture(123)
    const seen = new Set<string>()
    animation.start()
    advance(animation, GUITAR_PERFORMANCE.enterMs)
    for (let count = 0; count < 150 && seen.size < 2; count++) {
      const snapshot = animation.snapshot
      const phrase = GUITAR_PHRASES.find(phrase => phrase.id === snapshot.phraseId)!
      const beatMs = 60000 / snapshot.bpm
      const beats = phrase.steps.reduce((sum, [, count]) => sum + count, 0)
      if (phrase.mode !== 'accent') {
        advance(animation, beats * beatMs)
        continue
      }

      // The accented hand stroke is the timing cue, not a separate nodding clock.
      let elapsedBeats = 0
      let strikeBeat = 0
      for (const [clip, duration] of phrase.steps) {
        if (clip === 'accent') {
          const strike = GUITAR_CLIPS[clip].reduce((peak, key) => key.x > peak.x ? key : peak)
          strikeBeat = elapsedBeats + strike.at * duration
        }
        elapsedBeats += duration
      }
      const liftBeat = strikeBeat - 0.34
      const pressBeat = strikeBeat + 0.06
      const holdBeat = pressBeat + 0.16
      const reboundBeat = strikeBeat + 1.5
      assert.ok((pressBeat - liftBeat) * beatMs < 300, 'the accent downstroke should be short and decisive')
      advance(animation, liftBeat * beatMs)
      const lifted = animation.snapshot.head
      advance(animation, (pressBeat - liftBeat) * beatMs)
      const pressed = animation.snapshot.head
      const pressedGesture = animation.snapshot.headGesture
      assert.ok(lifted.y > 18, `${phrase.id}: lift should prepare the main strum`)
      assert.ok(pressed.y < -22, `${phrase.id}: press should land close to the hand's main strum`)
      assert.ok(Math.abs(pressed.x - lifted.x) < 6, `${phrase.id}: the nod should not be hidden by a lateral sweep`)
      advance(animation, (holdBeat - pressBeat) * beatMs)
      near(animation.snapshot.headGesture.y, pressedGesture.y)
      assert.ok(
        Math.abs(animation.snapshot.head.y - pressed.y) < 4,
        `${phrase.id}: body follow-through should not erase the held accent`,
      )
      advance(animation, (reboundBeat - holdBeat) * beatMs)
      assert.ok(animation.snapshot.head.y > 0 && animation.snapshot.head.y < 6, `${phrase.id}: recover to a calm pose`)
      seen.add(phrase.id)
      advance(animation, (beats - reboundBeat) * beatMs)
    }
    assert.equal(seen.size, 2, 'exercise both accent phrases')
  })

  it('does not restart or add a second loop when guitar is selected again', () => {
    const { animation, writes } = fixture()
    assert.equal(animation.start(), true)
    advance(animation, 700)
    const before = animation.snapshot
    writes.length = 0
    assert.equal(animation.start(), false)
    assert.deepEqual(writes, [])
    assert.deepEqual(animation.snapshot, before)
  })

  it('leaves from the current pose, neutralizes V2 channels and hands the head to the cursor target', () => {
    const { animation, writes } = fixture()
    animation.start()
    advance(animation, 850)
    const before = animation.snapshot
    writes.length = 0
    animation.stop(undefined, { x: 21, y: -14 })
    assert.deepEqual(animation.snapshot.pose, before.pose)
    assert.deepEqual(animation.snapshot.head, before.head)
    assert.deepEqual(writes, [])
    advance(animation, GUITAR_PERFORMANCE.exitMs)
    near(animation.snapshot.pose.x, 0)
    near(animation.snapshot.pose.y, 0)
    near(animation.snapshot.head.x, 21)
    near(animation.snapshot.head.y, -14)
    for (const name of ['body', 'leftEar', 'rightEar', 'frettingHand', 'guitar'] as const) {
      near(animation.snapshot[name].x, 0)
      near(animation.snapshot[name].y, 0)
    }
    assert.equal(animation.isActive, false)
    writes.length = 0
    animation.update(16)
    animation.stop()
    assert.deepEqual(writes, [])
  })

  it('cancels an exit on quick re-entry without resetting the pose or needing a second ticker', () => {
    const { animation } = fixture()
    animation.start()
    advance(animation, 700)
    animation.stop()
    animation.update(50)
    const before = animation.snapshot
    assert.equal(animation.start(), false)
    assert.deepEqual(animation.snapshot.pose, before.pose)
    assert.deepEqual(animation.snapshot.head, before.head)
    advance(animation, 800)
    assert.equal(animation.snapshot.phase, 'playing')
  })

  it('removes all pending playback on model destruction without writing into the next model', () => {
    const { animation, writes } = fixture()
    animation.start()
    advance(animation, 800)
    writes.length = 0
    animation.abort()
    animation.update(50)
    assert.equal(animation.isActive, false)
    assert.deepEqual(writes, [])
  })

  it('uses varied phrases, rests, emphasis cooldown and recovery during sustained playing', () => {
    const { animation, writes } = fixture(123)
    animation.start()
    const phrases: Array<GuitarHandAnimation['snapshot']> = []
    const clips = new Set<string>()
    let phraseNumber = 0
    let previousPose = animation.snapshot.pose
    let previousHead = animation.snapshot.head
    let headMinY = 0
    let headMaxX = -Infinity
    let headMinX = Infinity
    for (let elapsed = 0; elapsed < 180000; elapsed += 10) {
      animation.update(10)
      const snapshot = animation.snapshot
      assert.ok(Math.abs(snapshot.pose.x) <= 30 && Math.abs(snapshot.pose.y) <= 30)
      assert.ok(Math.abs(snapshot.pose.x - previousPose.x) < 8)
      assert.ok(Math.abs(snapshot.head.x) <= 30 && Math.abs(snapshot.head.y) <= 30)
      assert.ok(Math.abs(snapshot.body.x) <= 30 && Math.abs(snapshot.body.y) <= 30)
      assert.ok(Math.abs(snapshot.frettingHand.x) <= 30 && Math.abs(snapshot.frettingHand.y) <= 30)
      assert.ok(Math.abs(snapshot.guitar.x) <= 30 && Math.abs(snapshot.guitar.y) <= 30)
      assert.ok(Math.abs(snapshot.leftEar.x) <= 1 && Math.abs(snapshot.leftEar.y) <= 1)
      assert.ok(Math.abs(snapshot.rightEar.x) <= 1 && Math.abs(snapshot.rightEar.y) <= 1)
      assert.ok(Math.abs(snapshot.head.x - previousHead.x) < 2)
      // A fast accent intentionally exceeds the old slow-sway speed, but cannot snap.
      const headStepLimit = snapshot.mode === 'accent' && snapshot.clipId === 'accent' ? 4 : 2
      assert.ok(Math.abs(snapshot.head.y - previousHead.y) < headStepLimit)
      headMinY = Math.min(headMinY, snapshot.head.y)
      headMinX = Math.min(headMinX, snapshot.head.x)
      headMaxX = Math.max(headMaxX, snapshot.head.x)
      previousPose = snapshot.pose
      previousHead = snapshot.head
      clips.add(snapshot.clipId)
      if (snapshot.phraseNumber !== phraseNumber) {
        phrases.push(snapshot)
        phraseNumber = snapshot.phraseNumber
      }
      writes.length = 0
    }
    assert.ok(new Set(phrases.map(p => p.phraseId)).size >= 7)
    assert.ok(clips.has('rest') && clips.has('accent') && clips.has('double'))
    assert.ok(headMinY < -5, 'emphasis should produce a visible nod')
    assert.ok(headMaxX - headMinX > 4, 'head should shift weight across phrases')
    let lastAccent = -100
    for (let i = 0; i < phrases.length; i++) {
      if (i > 0) assert.notEqual(phrases[i].phraseId, phrases[i - 1].phraseId)
      if (phrases[i].mode !== 'accent') continue
      assert.ok(i - lastAccent >= GUITAR_PERFORMANCE.accentCooldown)
      if (i + 1 < phrases.length) assert.equal(phrases[i + 1].mode, 'release')
      lastAccent = i
    }
  })

  it('only samples randomness at phrase boundaries, not on individual frames', () => {
    let calls = 0
    const animation = new GuitarHandAnimation(() => {}, () => {
      calls++
      return 0.3
    })
    animation.start()
    advance(animation, GUITAR_PERFORMANCE.enterMs + 1)
    const count = calls
    advance(animation, 1000, 5)
    assert.equal(calls, count)
  })

  it('does not race through a backlog when rendering resumes after a long pause', () => {
    const a = fixture()
    const b = fixture()
    a.animation.start()
    b.animation.start()
    a.animation.update(60000)
    b.animation.update(GUITAR_PERFORMANCE.maxFrameMs)
    assert.deepEqual(a.animation.snapshot, b.animation.snapshot)
  })
})
