/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { COMPLETION_ANIMATION, CompletionAnimation } from './completionAnimation.ts'

describe('completion animation', () => {
  it('plays one authored dot-eyes gesture once and returns to the latest mouse pose', () => {
    const writes = new Map<string, number>()
    const animation = new CompletionAnimation((id, value) => writes.set(id, value))

    assert.equal(animation.start({ x: -8, y: 5 }), true)
    assert.equal(animation.snapshot.phase, 'playing')

    animation.update(COMPLETION_ANIMATION.popAtMs)

    assert.ok(animation.snapshot.head.y >= 10, 'the completion beat should visibly lift the head')
    assert.ok(animation.snapshot.body.y >= 5, 'the body should support the completion beat')
    assert.ok(
      Math.abs(animation.snapshot.leftEar.x) >= 0.2
      && Math.abs(animation.snapshot.rightEar.x) >= 0.2,
      'both ears should react to the completion beat',
    )
    assert.equal(writes.has('Param21'), false)
    assert.equal(writes.has('Param23'), false)

    animation.update(COMPLETION_ANIMATION.actionMs - COMPLETION_ANIMATION.popAtMs, { x: 7, y: -4 })
    assert.equal(animation.snapshot.phase, 'leaving')

    animation.update(COMPLETION_ANIMATION.returnMs, { x: 7, y: -4 })

    assert.equal(animation.snapshot.phase, 'idle')
    assert.deepEqual(animation.snapshot.head, { x: 7, y: -4 })
  })

  it('lets a new presentation preempt the one-shot from its current pose', () => {
    const animation = new CompletionAnimation(() => {})

    animation.start()
    animation.update(760)
    const before = animation.snapshot

    assert.equal(animation.stop({ x: -6, y: 3 }), true)
    assert.equal(animation.snapshot.phase, 'leaving')
    assert.deepEqual(animation.snapshot.head, before.head)
    assert.deepEqual(animation.snapshot.body, before.body)

    animation.update(COMPLETION_ANIMATION.preemptExitMs, { x: -6, y: 3 })

    assert.equal(animation.snapshot.phase, 'idle')
    assert.deepEqual(animation.snapshot.head, { x: -6, y: 3 })
  })

  it('does not restart while the same completion gesture is already active', () => {
    const animation = new CompletionAnimation(() => {})

    assert.equal(animation.start(), true)
    animation.update(500)
    const before = animation.snapshot

    assert.equal(animation.start(), false)
    assert.deepEqual(animation.snapshot.head, before.head)
    assert.equal(animation.snapshot.elapsedMs, before.elapsedMs)
  })
})
