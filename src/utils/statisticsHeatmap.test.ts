/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createEmptyStatistics, incrementActivity } from './statistics.ts'
import { getStatisticsHeatmap } from './statisticsHeatmap.ts'

describe('statistics heatmap', () => {
  it('builds Monday-aligned calendar weeks and leaves days after today blank', () => {
    const statistics = createEmptyStatistics()

    incrementActivity(statistics, 'keyboard', new Date(2026, 7, 3))
    incrementActivity(statistics, 'mouse', new Date(2026, 7, 12))

    const days = getStatisticsHeatmap(statistics, 2, new Date(2026, 7, 12, 12))

    assert.equal(days.length, 14)
    assert.equal(days[0].date, '2026-08-03')
    assert.equal(days[9].date, '2026-08-12')
    assert.deepEqual(days[9].counts, { keyboard: 0, mouse: 1, controller: 0 })
    assert.equal(days[9].isFuture, false)
    assert.equal(days[10].date, '2026-08-13')
    assert.equal(days[10].isFuture, true)
    assert.equal(days[10].total, 0)
    assert.equal(days[10].level, 0)
  })

  it('maps zero activity and logarithmic non-zero activity into five display levels', () => {
    const statistics = createEmptyStatistics()
    const now = new Date(2026, 7, 12, 12)

    incrementActivity(statistics, 'keyboard', new Date(2026, 7, 9), 1)
    incrementActivity(statistics, 'keyboard', new Date(2026, 7, 10), 10)
    incrementActivity(statistics, 'keyboard', new Date(2026, 7, 11), 100)
    incrementActivity(statistics, 'keyboard', now, 1000)

    const days = getStatisticsHeatmap(statistics, 2, now)
    const levels = Object.fromEntries(days.map(day => [day.date, [day.total, day.level]]))

    assert.deepEqual(levels['2026-08-09'], [1, 1])
    assert.deepEqual(levels['2026-08-10'], [10, 2])
    assert.deepEqual(levels['2026-08-11'], [100, 3])
    assert.deepEqual(levels['2026-08-12'], [1000, 4])
  })
})
