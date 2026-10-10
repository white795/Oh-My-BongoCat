export interface KeyBubble {
  readonly id: number
  readonly src: string
  readonly phase: 'visible' | 'leaving'
  readonly offsetX: number
  readonly offsetY: number
}

export const MIKUCAT_KEY_BUBBLE = {
  popMs: 180,
  initialScale: 0.92,
  initialScaleY: 0.86,
  driftMs: 1600,
  driftX: 12,
  driftY: -24,
  exitX: 6,
  exitY: -12,
  entryOpacity: 0.25,
  visibleOpacity: 0.95,
  settledOpacity: 0.86,
  holdMs: 600,
  fadeOutMs: 200,
  width: 1058,
  height: 1224,
  // Center of the visible bubble in the commissioned full-canvas PNGs.
  // Counter-mirror around this point to keep key labels readable.
  centerX: 781.5,
  centerY: 821.5,
  // Unfold from the bubble's tail instead of growing like a centered button.
  tailX: 708,
  tailY: 799,
  // Original artwork coordinates; scale together with the model.
  offsetY: -24,
  jitterX: 12,
  jitterY: 10,
} as const

export function createKeyBubbleOffset(random: () => number = Math.random) {
  return {
    offsetX: (random() * 2 - 1) * MIKUCAT_KEY_BUBBLE.jitterX,
    offsetY: MIKUCAT_KEY_BUBBLE.offsetY + (random() * 2 - 1) * MIKUCAT_KEY_BUBBLE.jitterY,
  }
}

const functionKeys = new Set([
  'Tab',
  'Shift',
  'Space',
  'Escape',
  'Backspace',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
])

const aliases = new Map([
  ['ShiftLeft', 'Shift'],
  ['ShiftRight', 'Shift'],
  ['UpArrow', 'ArrowUp'],
  ['DownArrow', 'ArrowDown'],
  ['LeftArrow', 'ArrowLeft'],
  ['RightArrow', 'ArrowRight'],
])

/** Select only available sprites; never use an unchecked device value as a path. */
export function getKeyBubbleFile(key: string): string | undefined {
  const name = /^Key([A-Z])$/.exec(key)?.[1]
    ?? /^(?:Num|Kp|Digit)(\d)$/.exec(key)?.[1]
    ?? aliases.get(key)
    ?? (functionKeys.has(key) ? key : undefined)

  return name ? `Key_${name}.png` : undefined
}
