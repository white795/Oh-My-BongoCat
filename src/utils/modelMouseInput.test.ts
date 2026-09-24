/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

import { ModelMouseInput } from './modelMouseInput.ts'

function fixture() {
  const writes: Array<[string, number]> = []
  const input = new ModelMouseInput((id, value) => writes.push([id, value]))
  return { input, writes }
}

describe('model mouse input ownership', () => {
  it('preserves ordinary mouse movement and button values before guitar is selected', () => {
    const { input, writes } = fixture()
    input.write('ParamMouseY', 15, input.begin())
    input.write('ParamMouseRightDown', true)
    assert.deepEqual(writes, [['ParamMouseY', 15], ['ParamMouseRightDown', 1]])
  })

  it('returns the MikuCat head, hands and buttons to neutral when guitar takes control', () => {
    const { input, writes } = fixture()
    input.setEnabled(false)
    assert.deepEqual(Object.fromEntries(writes), {
      ParamMouseX: 0,
      ParamMouseY: 0,
      ParamAngleX: 0,
      ParamAngleY: 0,
      ParamMouseLeftDown: 0,
      ParamMouseRightDown: 0,
    })
    assert.equal(input.accepts(input.begin()), false)
  })

  it('ignores movement and button events while guitar owns the pose', () => {
    const { input, writes } = fixture()
    input.setEnabled(false)
    writes.length = 0
    input.write('ParamMouseX', 30)
    input.write('ParamMouseRightDown', true)
    assert.deepEqual(writes, [])
  })

  it('resumes fresh mouse updates after leaving guitar but rejects a delayed old update', () => {
    const { input, writes } = fixture()
    const oldToken = input.begin()!
    input.setEnabled(false)
    input.setEnabled(true)
    writes.length = 0
    input.write('ParamAngleX', 30, oldToken)
    assert.equal(input.accepts(oldToken), false)
    input.write('ParamMouseX', -12, input.begin())
    assert.deepEqual(writes, [['ParamMouseX', -12]])
  })

  it('does not reset the pose again when guitar is selected repeatedly', () => {
    const { input, writes } = fixture()
    input.setEnabled(false)
    writes.length = 0
    input.setEnabled(false)
    assert.deepEqual(writes, [])
  })

  it('remembers current mouse targets while guitar owns the model, without writing them', () => {
    const { input, writes } = fixture()
    input.setEnabled(false)
    writes.length = 0
    const token = input.begin()
    assert.equal(input.isCurrent(token), true)
    input.write('ParamMouseX', 18, token)
    input.write('ParamMouseY', -7, token)
    assert.equal(input.latest('ParamMouseX'), 18)
    assert.equal(input.latest('ParamMouseY'), -7)
    assert.deepEqual(writes, [])
    input.reset()
    assert.equal(input.latest('ParamMouseX'), undefined)
    input.write('ParamMouseX', 30, token)
    assert.equal(input.latest('ParamMouseX'), undefined)
  })

  it('restores input on model reload without applying a delayed update from the previous model', () => {
    const { input, writes } = fixture()
    const oldToken = input.begin()!
    input.setEnabled(false)
    input.reset()
    writes.length = 0
    input.write('ParamMouseY', 30, oldToken)
    input.write('ParamMouseY', 8, input.begin())
    assert.deepEqual(writes, [['ParamMouseY', 8]])
  })
})

it('uses the normalized default face with guitar hands in the packaged expression', () => {
  const path = '../../src-tauri/assets/models/mikucat/expressions/guitar.exp3.json'
  const expression = JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
  const parameters = Object.fromEntries(expression.Parameters.map(
    (parameter: { Id: string, Value: number, Blend: string }) => [parameter.Id, [parameter.Value, parameter.Blend]],
  ))
  assert.deepEqual(parameters, {
    Param9: [0, 'Add'],
    Param10: [0, 'Add'],
    Param11: [0, 'Add'],
    Param12: [-60, 'Add'],
    Param13: [-60, 'Add'],
  })
  assert.equal(expression.FadeInTime, 0.3)
  assert.equal(expression.FadeOutTime, 0.3)
})
