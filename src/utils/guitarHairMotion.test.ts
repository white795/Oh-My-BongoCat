/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { GuitarHairMotion } from './guitarHairMotion.ts'
import { MIKUCAT_V2_HAIR_CHANNELS } from './modelParameterOwnership.ts'

const movingHead = {
  pose: { x: 18, y: -12 },
  velocity: { x: 0.055, y: -0.04 },
}

function advance(
  motion: GuitarHairMotion,
  milliseconds: number,
  step: number,
  head = movingHead,
) {
  for (let elapsed = 0; elapsed < milliseconds;) {
    const delta = Math.min(step, milliseconds - elapsed)
    motion.update(delta, head.pose, head.velocity)
    elapsed += delta
  }
}

describe('guitar hair secondary motion', () => {
  it('turns one shared head gesture into delayed movement for every detached hair channel', () => {
    const motion = new GuitarHairMotion()
    motion.reset()

    advance(motion, 180, 10)

    const values = motion.snapshot
    assert.deepEqual(Object.keys(values).sort(), Object.values(MIKUCAT_V2_HAIR_CHANNELS).sort())
    for (const [id, value] of Object.entries(values)) {
      assert.ok(Math.abs(value) > 0.05, `${id} should respond to the moving head`)
      assert.ok(Math.abs(value) < 24, `${id} should remain a secondary movement`)
    }
    assert.notEqual(values.Param2, values.Param3, 'the two sides should not move as one rigid sheet')
    assert.notEqual(values.Param4, values.Param5, 'the two ponytails should keep slightly different inertia')
  })

  it('keeps moving after the head stops, then damps back to its resting pose', () => {
    const motion = new GuitarHairMotion()
    motion.reset()
    advance(motion, 160, 10)
    const atStop = motion.snapshot.Param4

    motion.update(80, movingHead.pose, { x: 0, y: 0 })
    const followThrough = motion.snapshot.Param4
    assert.notEqual(followThrough, atStop, 'the ponytail should retain follow-through after the driving edge')

    advance(motion, 2500, 10, {
      pose: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
    })
    for (const [id, value] of Object.entries(motion.snapshot)) {
      assert.ok(Math.abs(value) < 0.05, `${id} should settle after the head returns to rest`)
    }
  })

  it('produces nearly the same secondary pose at 30 and 60 FPS', () => {
    const slow = new GuitarHairMotion()
    const fast = new GuitarHairMotion()
    slow.reset()
    fast.reset()

    advance(slow, 1200, 1000 / 30)
    advance(fast, 1200, 1000 / 60)

    for (const id of Object.values(MIKUCAT_V2_HAIR_CHANNELS)) {
      assert.ok(
        Math.abs(slow.snapshot[id] - fast.snapshot[id]) < 0.15,
        `${id} should not visibly depend on frame rate`,
      )
    }
  })
})
