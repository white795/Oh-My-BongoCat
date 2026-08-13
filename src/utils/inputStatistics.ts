import type { ActivityCategory, ActivityCounts } from './statistics.ts'

import { createEmptyCounts, getLocalDateKey } from './statistics.ts'

export type DeviceActivityKind = 'KeyboardPress' | 'KeyboardRelease' | 'MousePress' | 'MouseRelease' | 'MouseMove'

export class InputActivityEdges {
  private readonly activeKeys = new Set<string>()

  handle(kind: DeviceActivityKind, value: string): ActivityCategory | undefined {
    if (kind === 'KeyboardRelease') {
      this.activeKeys.delete(value)

      return
    }

    if (kind === 'KeyboardPress') {
      if (this.activeKeys.has(value)) return

      this.activeKeys.add(value)

      return 'keyboard'
    }

    if (kind === 'MousePress') return 'mouse'
  }

  releaseKey(key: string): void {
    this.activeKeys.delete(key)
  }

  reset(): void {
    this.activeKeys.clear()
  }
}

export class ActivityBuffer {
  private pending: Record<string, ActivityCounts> = {}

  record(category: ActivityCategory, date = new Date()): void {
    const dateKey = getLocalDateKey(date)
    const counts = this.pending[dateKey] ??= createEmptyCounts()

    counts[category] += 1
  }

  drain(): Record<string, ActivityCounts> {
    const pending = this.pending

    this.pending = {}

    return pending
  }

  get empty(): boolean {
    return Object.keys(this.pending).length === 0
  }
}
