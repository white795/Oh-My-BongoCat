/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { ANGRY_ANIMATION, AngryAnimation } from './angryAnimation.ts'
import { MIKUCAT_ANGRY_POSE_PARAMETERS, MIKUCAT_LEEK_HAND_CHANNELS, MIKUCAT_NORMAL_LEFT_HAND_CHANNELS, MIKUCAT_V2_HAIR_CHANNELS } from './modelParameterOwnership.ts'

const angryFootParameters = [
  'Param36',
  'Param37',
  'Param40',
  'Param38',
  'Param39',
  'Param41',
]

function advance(animation: AngryAnimation, milliseconds: number, step = 10) {
  for (let elapsed = 0; elapsed < milliseconds;) {
    const delta = Math.min(step, milliseconds - elapsed)
    animation.update(delta)
    elapsed += delta
  }
}

describe('MikuCat angry animation', () => {
  it('enters one restrained annoyed loop without creating work on repeated start', () => {
    const writes = new Map<string, number>()
    const animation = new AngryAnimation((id, value) => writes.set(id, value))

    assert.equal(animation.setIntent({ intensity: 'annoyed' }), true)
    assert.equal(animation.start({ x: 12, y: -8 }), true)
    assert.equal(animation.start({ x: 12, y: -8 }), false)
    assert.equal(animation.snapshot.phase, 'entering')

    advance(animation, ANGRY_ANIMATION.enterMs)

    assert.equal(animation.snapshot.phase, 'playing')
    assert.equal(animation.snapshot.intensity, 'annoyed')
    assert.deepEqual(animation.snapshot.requestedIntent, { intensity: 'annoyed' })
    assert.ok(animation.snapshot.head.y < 0, 'annoyed should settle into a restrained forward/down pose')
    assert.ok(animation.snapshot.body.y < 0, 'the body should support the annoyed head pose')
    assert.notDeepEqual(animation.snapshot.leftEar, animation.snapshot.rightEar)
    assert.deepEqual(
      [...writes.keys()].sort(),
      [
        ...MIKUCAT_ANGRY_POSE_PARAMETERS,
        ...Object.values(MIKUCAT_V2_HAIR_CHANNELS),
        ...Object.values(MIKUCAT_LEEK_HAND_CHANNELS),
      ].sort(),
    )
    assert.ok(writes.has(MIKUCAT_LEEK_HAND_CHANNELS.x))
    assert.ok(writes.has(MIKUCAT_LEEK_HAND_CHANNELS.y))
    assert.ok(writes.has(MIKUCAT_NORMAL_LEFT_HAND_CHANNELS.x))
    assert.ok(writes.has(MIKUCAT_NORMAL_LEFT_HAND_CHANNELS.y))
    for (const id of ['Param9', 'Param10', 'Param11', 'Param12', 'Param13', 'Param21', 'Param22', 'Param23', 'Param24', 'Param34', 'ParamMouseLeftDown', 'ParamMouseRightDown']) {
      assert.equal(writes.has(id), false, `${id} must not be owned by the angry pose`)
    }
    for (const id of angryFootParameters) {
      assert.equal(writes.has(id), false, `${id} must remain on model physics below furious`)
    }
  })

  it('leaves foot physics unwritten in every angry intensity', () => {
    for (const intensity of ['annoyed', 'impatient', 'furious'] as const) {
      const writes = new Set<string>()
      const animation = new AngryAnimation(id => writes.add(id))
      animation.setIntent({ intensity })
      animation.start()
      advance(animation, ANGRY_ANIMATION.enterMs + 1500)

      for (const id of angryFootParameters) {
        assert.equal(writes.has(id), false, `${intensity} must not write ${id}`)
      }
    }
  })

  it('keeps position and velocity continuous across the annoyed loop boundary', () => {
    const animation = new AngryAnimation(() => {})
    animation.start()
    advance(animation, ANGRY_ANIMATION.enterMs)
    advance(animation, ANGRY_ANIMATION.annoyedLoopMs - 0.1, 10)
    const before = animation.snapshot

    animation.update(0.2)
    const after = animation.snapshot

    assert.equal(after.phase, 'playing')
    assert.ok(Math.hypot(after.head.x - before.head.x, after.head.y - before.head.y) < 0.02)
    assert.ok(Math.hypot(
      after.headVelocity.x - before.headVelocity.x,
      after.headVelocity.y - before.headVelocity.y,
    ) < 0.002)
  })

  it('makes the restrained side look readable instead of hiding it in idle-sized motion', () => {
    const animation = new AngryAnimation(() => {})
    animation.start()
    advance(animation, ANGRY_ANIMATION.enterMs)
    const samples = []

    for (let elapsed = 0; elapsed < ANGRY_ANIMATION.annoyedLoopMs; elapsed += 100) {
      samples.push(animation.snapshot)
      advance(animation, 100)
    }

    const span = (values: number[]) => Math.max(...values) - Math.min(...values)
    assert.ok(span(samples.map(sample => sample.head.x)) >= 7, 'the slow side look needs a readable head arc')
    assert.ok(span(samples.map(sample => sample.head.y)) >= 3, 'the head needs visible forward/down weight')
    assert.ok(span(samples.map(sample => sample.body.x)) >= 3, 'the body must support the side look')
    assert.ok(span(samples.map(sample => sample.leftEar.x)) >= 0.3, 'the leading ear needs visible asymmetry')
  })

  it('holds still before two sharp impatient prompts with a heavier delayed body response', () => {
    const animation = new AngryAnimation(() => {})

    assert.equal(animation.setIntent({ intensity: 'impatient' }), true)
    animation.start()
    advance(animation, ANGRY_ANIMATION.enterMs)

    assert.equal(animation.snapshot.intensity, 'impatient')
    const resting = animation.snapshot
    const frameMs = ANGRY_ANIMATION.impatientLoopMs / 16
    advance(animation, frameMs * 3)
    const held = animation.snapshot
    assert.ok(Math.hypot(held.head.x - resting.head.x, held.head.y - resting.head.y) < 1.5)
    assert.ok(Math.hypot(held.body.x - resting.body.x, held.body.y - resting.body.y) < 1.5)
    assert.ok(Math.hypot(held.leekHand.x, held.leekHand.y) < 0.5, 'the leek hand should hold still before prompting')
    assert.ok(Math.hypot(held.normalLeftHand.x, held.normalLeftHand.y) < 0.5, 'the supporting left hand should also hold still before prompting')

    advance(animation, frameMs)
    const prepared = animation.snapshot
    advance(animation, frameMs)
    const firstPush = animation.snapshot
    advance(animation, frameMs)
    const rebound = animation.snapshot
    advance(animation, frameMs)
    const secondPrepared = animation.snapshot
    advance(animation, frameMs)
    const secondPush = animation.snapshot
    advance(animation, frameMs)
    const bodyFollow = animation.snapshot

    assert.ok(firstPush.head.y < prepared.head.y - 9, 'the first prompt should break sharply from the hold')
    assert.ok(rebound.head.y > firstPush.head.y + 8, 'the two prompts need a readable rebound between them')
    assert.ok(secondPush.head.y < secondPrepared.head.y - 15, 'the second prompt should carry distinctly more weight')
    assert.ok(secondPush.head.y < firstPush.head.y - 5, 'the second prompt must be heavier than the first')
    assert.ok(bodyFollow.body.y < secondPush.body.y - 6, 'body weight should arrive after the head')
    assert.ok(bodyFollow.head.y > secondPush.head.y + 6, 'the head should already be recovering as the body follows')
    assert.ok(secondPush.head.y <= -21, 'the stronger prompt needs enough head travel to remain visible in Live2D')
    assert.ok(bodyFollow.body.y <= -24, 'the delayed body response needs a readable full-model silhouette')
    assert.ok(Math.abs(bodyFollow.body.x) >= 8, 'the body needs lateral weight instead of moving vertically in place')
    const handTravel = (from: typeof prepared, to: typeof prepared) => Math.hypot(
      to.leekHand.x - from.leekHand.x,
      to.leekHand.y - from.leekHand.y,
    )
    assert.ok(handTravel(prepared, firstPush) >= 20 && handTravel(prepared, firstPush) <= 24, 'the first leek swing should remain visible after reducing its range')
    assert.ok(Math.hypot(rebound.leekHand.x, rebound.leekHand.y) < Math.hypot(firstPush.leekHand.x, firstPush.leekHand.y), 'the leek should pull back between prompts')
    assert.ok(handTravel(secondPrepared, secondPush) >= 35 && handTravel(secondPrepared, secondPush) <= 40, 'the second leek swing should stay stronger without approaching the full range')
    assert.ok(Math.hypot(secondPush.leekHand.x, secondPush.leekHand.y) > Math.hypot(firstPush.leekHand.x, firstPush.leekHand.y) + 10, 'the second leek swing should be heavier than the first')
    assert.ok(Math.hypot(bodyFollow.leekHand.x, bodyFollow.leekHand.y) >= 15, 'the leek hand should follow through after the second swing')
    assert.ok(Math.hypot(rebound.normalLeftHand.x, rebound.normalLeftHand.y) >= 5, 'the supporting hand should answer the first swing with a small delay')
    assert.ok(Math.hypot(bodyFollow.normalLeftHand.x, bodyFollow.normalLeftHand.y) >= 8, 'the supporting hand should follow the heavier second swing')
    assert.ok(Math.hypot(bodyFollow.normalLeftHand.x, bodyFollow.normalLeftHand.y) < Math.hypot(bodyFollow.leekHand.x, bodyFollow.leekHand.y), 'the supporting hand must remain subordinate to the leek hand')

    const authoredEarPeak = Math.max(...[
      prepared,
      firstPush,
      rebound,
      secondPush,
      bodyFollow,
    ].flatMap(sample => [
      Math.abs(sample.leftEar.x),
      Math.abs(sample.leftEar.y),
      Math.abs(sample.rightEar.x),
      Math.abs(sample.rightEar.y),
    ]))
    assert.ok(authoredEarPeak <= 0.2, 'active ear motion must not amplify the expression-rigged ear response')
  })

  it('keeps position and velocity continuous across the impatient loop boundary', () => {
    const animation = new AngryAnimation(() => {})
    animation.setIntent({ intensity: 'impatient' })
    animation.start()
    advance(animation, ANGRY_ANIMATION.enterMs)
    advance(animation, ANGRY_ANIMATION.impatientLoopMs - 0.1, 10)
    const before = animation.snapshot

    animation.update(0.2)
    const after = animation.snapshot

    assert.equal(after.phase, 'playing')
    assert.ok(Math.hypot(after.head.x - before.head.x, after.head.y - before.head.y) < 0.03)
    assert.ok(Math.hypot(
      after.headVelocity.x - before.headVelocity.x,
      after.headVelocity.y - before.headVelocity.y,
    ) < 0.003)
  })

  it('leaves from the current pose and returns every authored pose channel to neutral', () => {
    const animation = new AngryAnimation(() => {})
    animation.start({ x: 9, y: -6 })
    advance(animation, ANGRY_ANIMATION.enterMs + 1300)
    const active = animation.snapshot

    assert.equal(animation.stop(), true)
    assert.equal(animation.snapshot.phase, 'leaving')
    assert.deepEqual(animation.snapshot.head, active.head)
    assert.equal(animation.stop(), false)

    advance(animation, ANGRY_ANIMATION.exitMs)

    assert.equal(animation.snapshot.phase, 'idle')
    for (const pose of [
      animation.snapshot.head,
      animation.snapshot.body,
      animation.snapshot.leftEar,
      animation.snapshot.rightEar,
      animation.snapshot.leekHand,
      animation.snapshot.normalLeftHand,
    ]) {
      assert.ok(Math.hypot(pose.x, pose.y) < 1e-6)
    }
  })

  it('builds furious around one sustained multi-direction leek flurry without leaving the ground', () => {
    const animation = new AngryAnimation(() => {})

    assert.equal(animation.setIntent({ intensity: 'furious' }), true)
    animation.start()
    advance(animation, ANGRY_ANIMATION.enterMs)

    assert.equal(animation.snapshot.intensity, 'furious')
    assert.deepEqual(animation.snapshot.requestedIntent, { intensity: 'furious' })
    const frameMs = ANGRY_ANIMATION.furiousLoopMs / 25
    const stable = animation.snapshot
    advance(animation, frameMs * 4)
    const windup = animation.snapshot
    const flurry: Array<typeof stable> = []
    for (let frame = 5; frame <= 16; frame++) {
      advance(animation, frameMs)
      flurry.push(animation.snapshot)
    }
    advance(animation, frameMs * 4)
    const settled = animation.snapshot

    const handX = flurry.map(sample => sample.leekHand.x)
    const handY = flurry.map(sample => sample.leekHand.y)
    const horizontalDirections = handX.slice(1).map((value, index) => Math.sign(value - handX[index]))
    const horizontalReversals = horizontalDirections.slice(1).filter((direction, index) => (
      direction !== 0 && horizontalDirections[index] !== 0 && direction !== horizontalDirections[index]
    )).length
    const handTravel = flurry.slice(1).map((sample, index) => Math.hypot(
      sample.leekHand.x - flurry[index].leekHand.x,
      sample.leekHand.y - flurry[index].leekHand.y,
    ))
    const leftHandX = flurry.map(sample => sample.normalLeftHand.x)
    const leftHandDirections = leftHandX.slice(1).map((value, index) => Math.sign(value - leftHandX[index]))
    const leftHandReversals = leftHandDirections.slice(1).filter((direction, index) => (
      direction !== 0 && leftHandDirections[index] !== 0 && direction !== leftHandDirections[index]
    )).length
    const finalWindupTravel = handTravel.at(-2) ?? Infinity
    const finalStrike = handTravel.at(-1) ?? 0

    assert.ok(windup.leekHand.y > stable.leekHand.y + 10, 'the flurry needs a readable raised wind-up')
    assert.ok(Math.max(...handX) - Math.min(...handX) >= 38, 'the leek should sweep broadly across both sides')
    assert.ok(Math.max(...handY) - Math.min(...handY) >= 32, 'the flurry needs diagonal rather than horizontal-only strikes')
    assert.ok(horizontalReversals >= 7, 'the authored flurry should keep changing direction instead of repeating one swing')
    assert.ok(handTravel.filter(distance => distance >= 24).length >= 7, 'most of the flurry should remain visibly active')
    assert.ok(finalWindupTravel <= 5, 'the final raised pose needs a short hold so the smash reads separately from the flurry')
    assert.ok(finalStrike >= 45, 'the flurry should finish with one distinctly heavier downward strike')
    assert.ok(leftHandReversals <= 4, 'the supporting hand should carry body weight instead of mirroring every leek strike')
    assert.ok(flurry.every(sample => sample.body.y <= -8), 'furious must stay grounded instead of simulating a jump')
    assert.ok(Math.hypot(flurry.at(-1)!.normalLeftHand.x, flurry.at(-1)!.normalLeftHand.y) < Math.hypot(flurry.at(-1)!.leekHand.x, flurry.at(-1)!.leekHand.y), 'the empty left hand must remain a supporting accent')
    assert.ok(Math.abs(settled.body.y - stable.body.y) <= 2, 'the loop should recover to its stable furious hold')
  })

  it('keeps the furious hold continuous when the jump loop wraps', () => {
    const animation = new AngryAnimation(() => {})
    animation.setIntent({ intensity: 'furious' })
    animation.start()
    advance(animation, ANGRY_ANIMATION.enterMs)
    advance(animation, ANGRY_ANIMATION.furiousLoopMs - 0.1, 10)
    const before = animation.snapshot

    animation.update(0.2)
    const after = animation.snapshot

    assert.equal(after.phase, 'playing')
    for (const name of ['head', 'body', 'leekHand', 'normalLeftHand'] as const) {
      assert.ok(Math.hypot(after[name].x - before[name].x, after[name].y - before[name].y) < 0.05, `${name} should not jump at the furious loop boundary`)
    }
  })
})
