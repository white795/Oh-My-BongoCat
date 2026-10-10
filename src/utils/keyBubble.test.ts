/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

import { createKeyBubbleOffset, getKeyBubbleFile, MIKUCAT_KEY_BUBBLE } from './keyBubble.ts'

describe('default-mode keyboard bubbles', () => {
  it('keeps the small random offset within its configured bounds and moves the base position upward', () => {
    const { jitterX, jitterY, offsetY } = MIKUCAT_KEY_BUBBLE
    assert.ok(offsetY + jitterY < 0, 'even the lowest offset should remain above the original placement')
    for (const random of [0, 0.5, 1]) {
      assert.deepEqual(createKeyBubbleOffset(() => random), {
        offsetX: (random * 2 - 1) * jitterX,
        offsetY: offsetY + (random * 2 - 1) * jitterY,
      })
    }
  })

  it('selects the matching commissioned bubble for every letter and digit', () => {
    for (const letter of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
      assert.equal(getKeyBubbleFile(`Key${letter}`), `Key_${letter}.png`)
    }
    for (const digit of '0123456789') {
      for (const prefix of ['Num', 'Kp', 'Digit']) {
        assert.equal(getKeyBubbleFile(`${prefix}${digit}`), `Key_${digit}.png`)
      }
    }
  })

  it('normalizes the native modifier and arrow names without requiring extra artwork', () => {
    const keys = {
      Tab: 'Tab',
      Shift: 'Shift',
      ShiftLeft: 'Shift',
      ShiftRight: 'Shift',
      Space: 'Space',
      Escape: 'Escape',
      Backspace: 'Backspace',
      UpArrow: 'ArrowUp',
      DownArrow: 'ArrowDown',
      LeftArrow: 'ArrowLeft',
      RightArrow: 'ArrowRight',
      ArrowUp: 'ArrowUp',
      ArrowDown: 'ArrowDown',
      ArrowLeft: 'ArrowLeft',
      ArrowRight: 'ArrowRight',
    }
    for (const [input, name] of Object.entries(keys)) {
      assert.equal(getKeyBubbleFile(input), `Key_${name}.png`)
    }
    for (const input of ['Return', 'ControlLeft', 'Alt', 'F1', '', '__proto__', '../../Key_A']) {
      assert.equal(getKeyBubbleFile(input), undefined)
    }
  })

  it('ships all 45 PNG bubbles in the model runtime resources with their original canvas size', () => {
    const root = new URL('../../src-tauri/assets/models/mikucat/resources/input-bubbles/', import.meta.url)
    const names = [
      ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      ...'0123456789',
      'Tab',
      'Shift',
      'Space',
      'Escape',
      'Backspace',
      'ArrowUp',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
    ]
    const expected = names.map(name => `Key_${name}.png`).sort()
    assert.deepEqual(readdirSync(root).sort(), expected)
    for (const file of expected) {
      const png = readFileSync(new URL(file, root))
      assert.equal(png.toString('ascii', 1, 4), 'PNG', file)
      assert.equal(png.readUInt32BE(16), MIKUCAT_KEY_BUBBLE.width, file)
      assert.equal(png.readUInt32BE(20), MIKUCAT_KEY_BUBBLE.height, file)
    }
  })
})
