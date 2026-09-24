/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  MIKUCAT_GUITAR_OWNED_PARAMETERS,
  MIKUCAT_GUITAR_ROLES,
  MIKUCAT_V2_ANIMATION_PARAMETERS,
  MIKUCAT_V2_CHANNELS,
  MIKUCAT_V2_HAIR_CHANNELS,
  ModelParameterOwnership,
} from './modelParameterOwnership.ts'

const ranges = new Map(MIKUCAT_V2_ANIMATION_PARAMETERS.map(({ id, min, max }) => [id, { min, max }]))

describe('MikuCat V2 parameter manifest', () => {
  it('describes every independent animation axis once with its model range', () => {
    assert.deepEqual(MIKUCAT_V2_CHANNELS, {
      head: { x: 'ParamAngleX', y: 'ParamAngleY' },
      body: { x: 'Param14', y: 'Param15' },
      leftEar: { x: 'Param18', y: 'Param16' },
      rightEar: { x: 'Param17', y: 'Param19' },
      leftHand: { x: 'Param21', y: 'Param22' },
      rightHand: { x: 'Param23', y: 'Param24' },
      guitar: { x: 'Param34', y: 'Param35' },
    })
    assert.deepEqual(MIKUCAT_GUITAR_ROLES, {
      strummingHand: MIKUCAT_V2_CHANNELS.leftHand,
      frettingHand: MIKUCAT_V2_CHANNELS.rightHand,
    })
    assert.deepEqual(MIKUCAT_V2_HAIR_CHANNELS, {
      rightSide: 'Param2',
      leftSide: 'Param3',
      rightPonytail: 'Param4',
      leftPonytail: 'Param5',
      bangs: 'Param20',
      rightRibbonX: 'Param',
      rightRibbonY: 'Param27',
      leftRibbonX: 'Param28',
      leftRibbonY: 'Param29',
    })
    assert.equal(MIKUCAT_V2_ANIMATION_PARAMETERS.length, 14)
    assert.equal(new Set(MIKUCAT_V2_ANIMATION_PARAMETERS.map(parameter => parameter.id)).size, 14)
    assert.deepEqual(
      MIKUCAT_V2_ANIMATION_PARAMETERS.filter(parameter => parameter.id.startsWith('Param1') && parameter.max === 1),
      [
        { id: 'Param18', min: -1, max: 1 },
        { id: 'Param16', min: -1, max: 1 },
        { id: 'Param17', min: -1, max: 1 },
        { id: 'Param19', min: -1, max: 1 },
      ],
    )
    for (const id of Object.values(MIKUCAT_V2_HAIR_CHANNELS)) {
      assert.ok(MIKUCAT_GUITAR_OWNED_PARAMETERS.includes(id))
    }
  })
})

describe('model parameter ownership', () => {
  it('acquires atomically, rejects a competing writer and clamps writes to the live range', () => {
    const writes: Array<[string, number, number]> = []
    const ownership = new ModelParameterOwnership(
      (id, value, weight) => writes.push([id, value, weight]),
      id => ranges.get(id) ?? null,
    )
    const animation = Symbol('animation')
    const rival = Symbol('rival')
    const parameters = [MIKUCAT_V2_CHANNELS.head.x, MIKUCAT_V2_CHANNELS.leftEar.x]

    assert.equal(ownership.acquire(animation, parameters), true)
    assert.equal(ownership.acquire(rival, parameters), false)
    assert.equal(ownership.write(animation, 'ParamAngleX', 45), true)
    assert.equal(ownership.write(animation, 'Param18', -3), true)
    assert.equal(ownership.write(rival, 'ParamAngleX', 0), false)
    assert.deepEqual(writes, [
      ['ParamAngleX', 30, 1],
      ['Param18', -1, 1],
    ])
  })

  it('releases persistent overrides with zero weight before another writer can acquire them', () => {
    const writes: Array<[string, number, number]> = []
    const ownership = new ModelParameterOwnership(
      (id, value, weight) => writes.push([id, value, weight]),
      id => ranges.get(id) ?? null,
    )
    const animation = Symbol('animation')
    const next = Symbol('next')
    const parameters = [MIKUCAT_V2_CHANNELS.body.x, MIKUCAT_V2_CHANNELS.body.y]

    assert.equal(ownership.acquire(animation, parameters), true)
    ownership.write(animation, 'Param14', 12)
    assert.equal(ownership.release(animation), 2)
    assert.deepEqual(writes.slice(-2), [
      ['Param14', 0, 0],
      ['Param15', 0, 0],
    ])
    assert.equal(ownership.acquire(next, parameters), true)
  })

  it('does not partially acquire a capability when one model parameter is absent', () => {
    const ownership = new ModelParameterOwnership(
      () => assert.fail('an unavailable capability must not write'),
      id => id === 'Param15' ? null : ranges.get(id) ?? null,
    )
    const animation = Symbol('animation')
    const next = Symbol('next')

    assert.equal(ownership.acquire(animation, ['Param14', 'Param15']), false)
    assert.equal(ownership.acquire(next, ['Param14']), true)
  })
})
