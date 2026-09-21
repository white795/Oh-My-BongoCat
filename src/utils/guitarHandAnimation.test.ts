/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { GuitarHandAnimation } from './guitarHandAnimation.ts'
import { GUITAR_CLIPS, GUITAR_HEAD, GUITAR_PERFORMANCE, GUITAR_PHRASES } from './guitarPerformance.ts'

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

describe('guitar performance', () => {
  it('provides distinct authored actions and beat-aligned phrases with safe keyframe ordering', () => {
    assert.equal(Object.keys(GUITAR_CLIPS).length, 7)
    assert.equal(new Set(GUITAR_PHRASES.map(phrase => phrase.id)).size, 10)
    for (const keys of [...Object.values(GUITAR_CLIPS), ...GUITAR_PHRASES.map(phrase => phrase.head)]) {
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
    }
  })

  it('enters from the current cursor pose without snapping to zero', () => {
    const { animation, writes } = fixture()
    animation.start({ x: 19, y: -8 }, { x: -18, y: 12 })
    assert.deepEqual(writes, [['ParamMouseX', 19], ['ParamMouseY', -8], ['ParamAngleX', -18], ['ParamAngleY', 12]])
    animation.update(1)
    near(animation.snapshot.pose.x, 19, 0.01)
    near(animation.snapshot.pose.y, -8, 0.01)
    near(animation.snapshot.head.x, -18, 0.01)
    near(animation.snapshot.head.y, 12, 0.01)
  })

  it('does not write parameters when guitar is inactive', () => {
    const { animation, writes } = fixture()
    animation.update(16)
    assert.deepEqual(writes, [])
  })

  it('adds head and body follow-through without taking over the face or hair channels', () => {
    const { animation, writes } = fixture()
    animation.start()
    writes.length = 0
    advance(animation, 700)
    writes.splice(0, writes.length - 4)
    assert.deepEqual(writes.map(([id]) => id), ['ParamMouseX', 'ParamMouseY', 'ParamAngleX', 'ParamAngleY'])
    assert.ok(writes.some(([, value]) => value !== 0))
    assert.ok(writes.slice(2).some(([, value]) => value !== 0))
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
      let handMin = Infinity
      let handMax = -Infinity
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
        handMin = Math.min(handMin, pose.x)
        handMax = Math.max(handMax, pose.x)
      }
      assert.ok(longestStillMs >= 500, `${phrase.id}: allow at least half a second of near stillness`)
      assert.ok(handMax - handMin > 5, `${phrase.id}: hands should continue playing while the head rests`)
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
    const slowPose = slow.writes.slice(-4)
    const fastPose = fast.writes.slice(-4)
    for (let i = 0; i < 4; i++) near(slowPose[i][1], fastPose[i][1])
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
      near(animation.snapshot.head.x, key.x * (key.x < 0 ? GUITAR_HEAD.left : GUITAR_HEAD.right) * weight)
      near(animation.snapshot.head.y, key.y * (key.y < 0 ? GUITAR_HEAD.press : GUITAR_HEAD.lift) * weight)
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
      assert.ok(lifted.y > 18, `${phrase.id}: lift should prepare the main strum`)
      assert.ok(pressed.y < -22, `${phrase.id}: press should land close to the hand's main strum`)
      assert.ok(Math.abs(pressed.x - lifted.x) < 6, `${phrase.id}: the nod should not be hidden by a lateral sweep`)
      advance(animation, (holdBeat - pressBeat) * beatMs)
      near(animation.snapshot.head.y, pressed.y)
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

  it('leaves from the current pose and finishes at the mouse target within a short transition', () => {
    const { animation, writes } = fixture()
    animation.start()
    advance(animation, 850)
    const before = animation.snapshot
    writes.length = 0
    animation.stop({ x: -22, y: 13 }, { x: 21, y: -14 })
    assert.deepEqual(animation.snapshot.pose, before.pose)
    assert.deepEqual(animation.snapshot.head, before.head)
    assert.deepEqual(writes, [])
    advance(animation, GUITAR_PERFORMANCE.exitMs)
    near(animation.snapshot.pose.x, -22)
    near(animation.snapshot.pose.y, 13)
    near(animation.snapshot.head.x, 21)
    near(animation.snapshot.head.y, -14)
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
