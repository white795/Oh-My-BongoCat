/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { existsSync, readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const projectRoot = new URL('../../', import.meta.url)
const runtimeRoot = new URL('src-tauri/assets/models/mikucat/', projectRoot)

function readJSON<T>(path: string): T {
  return JSON.parse(readFileSync(new URL(path, runtimeRoot), 'utf8')) as T
}

describe('MikuCat V2 runtime assets', () => {
  it('keeps the proprietary design source outside Git', () => {
    const gitignore = readFileSync(new URL('.gitignore', projectRoot), 'utf8')
    assert.match(gitignore, /^\/mikucat-lived2d-v2\/$/m)
  })

  it('packages only normalized runtime references and the Heshui personal-use asset license', () => {
    const model = readJSON<{
      FileReferences: {
        Moc: string
        Textures: string[]
        Physics: string
        DisplayInfo: string
        Expressions: Array<{ Name: string, File: string }>
      }
      Groups: Array<{ Name: string, Ids: string[] }>
    }>('mikucat.model3.json')
    const expectedExpressions = [
      { Name: '默认', File: 'expressions/default.exp3.json' },
      { Name: '豆豆', File: 'expressions/dot-eyes.exp3.json' },
      { Name: '生气', File: 'expressions/angry.exp3.json' },
      { Name: '吉他', File: 'expressions/guitar.exp3.json' },
    ]

    assert.deepEqual(model.FileReferences, {
      Moc: 'mikucat.moc3',
      Textures: ['textures/texture_00.png'],
      Physics: 'mikucat.physics3.json',
      DisplayInfo: 'mikucat.cdi3.json',
      Expressions: expectedExpressions,
    })
    for (const file of [
      model.FileReferences.Moc,
      ...model.FileReferences.Textures,
      model.FileReferences.Physics,
      model.FileReferences.DisplayInfo,
      ...model.FileReferences.Expressions.map(expression => expression.File),
      'LICENSE',
    ]) {
      assert.ok(existsSync(new URL(file, runtimeRoot)), `missing runtime asset: ${file}`)
      assert.equal(file, file.trim(), `runtime reference has surrounding whitespace: ${file}`)
    }

    assert.deepEqual(model.Groups.find(group => group.Name === 'EyeBlink')?.Ids, [
      'ParamEyeLOpen',
      'ParamEyeROpen',
    ])
    const license = readFileSync(new URL('LICENSE', runtimeRoot), 'utf8')
    assert.match(license, /MikuCat Personal-Use Asset License/)
    assert.match(license, /Copyright \(c\) 2026 Heshui\. All rights reserved\./)
    assert.match(license, /personal, non-commercial use/)
    assert.match(license, /not covered by the MIT\s+License at the root of this repository/)
  })

  it('contains the independently controllable V2 animation channels', () => {
    const displayInfo = readJSON<{ Parameters: Array<{ Id: string }> }>('mikucat.cdi3.json')
    const parameterIds = new Set(displayInfo.Parameters.map(parameter => parameter.Id))
    const animationChannels = [
      'ParamAngleX',
      'ParamAngleY',
      'Param14',
      'Param15',
      'Param18',
      'Param16',
      'Param17',
      'Param19',
      'Param21',
      'Param22',
      'Param23',
      'Param24',
      'Param34',
      'Param35',
    ]

    assert.equal(parameterIds.size, 49)
    for (const id of animationChannels) assert.ok(parameterIds.has(id), `missing display parameter: ${id}`)

    const moc = readFileSync(new URL('mikucat.moc3', runtimeRoot))
    for (const id of animationChannels) assert.ok(moc.includes(Buffer.from(id)), `missing MOC parameter: ${id}`)
  })

  it('drives both ears from head motion without consuming eye-blink parameters', () => {
    const physics = readJSON<{
      Meta: { TotalInputCount: number }
      PhysicsSettings: Array<{
        Id: string
        Input: Array<{ Source: { Id: string }, Weight: number }>
        Output: Array<{ Destination: { Id: string } }>
      }>
    }>('mikucat.physics3.json')
    const setting = (id: string) => physics.PhysicsSettings.find(item => item.Id === id)!
    const inputs = (id: string) => setting(id).Input.map(item => item.Source.Id)
    const outputs = (id: string) => setting(id).Output.map(item => item.Destination.Id)

    assert.equal(physics.Meta.TotalInputCount, 26)
    assert.deepEqual(inputs('PhysicsSetting2'), ['ParamAngleX', 'ParamAngleY'])
    assert.deepEqual(outputs('PhysicsSetting2'), ['Param18', 'Param7'])
    assert.deepEqual(inputs('PhysicsSetting4'), ['ParamAngleX', 'ParamAngleY'])
    assert.deepEqual(outputs('PhysicsSetting4'), ['Param17', 'Param6'])
    assert.equal(
      ['PhysicsSetting2', 'PhysicsSetting4']
        .flatMap(id => inputs(id))
        .some(id => id === 'ParamEyeLOpen' || id === 'ParamEyeROpen'),
      false,
    )
  })
})
