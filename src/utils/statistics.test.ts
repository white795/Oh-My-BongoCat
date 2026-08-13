/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  activityTotal,
  aggregateStatistics,
  createEmptyStatistics,
  getLocalDateKey,
  getRecentDailyHistory,
  incrementActivity,
  mergeActivityBatch,
  normalizeStatistics,
} from './statistics.ts'

describe('statistics core', () => {
  it('records keyboard and mouse activity in independent local-date buckets', () => {
    const statistics = createEmptyStatistics()
    const date = new Date(2026, 7, 12, 23, 59, 59)

    incrementActivity(statistics, 'keyboard', date)
    incrementActivity(statistics, 'keyboard', date)
    incrementActivity(statistics, 'mouse', date)

    assert.deepEqual(statistics.daily['2026-08-12'], {
      keyboard: 2,
      mouse: 1,
      controller: 0,
    })
    assert.equal(activityTotal(statistics.daily['2026-08-12']), 3)
  })

  it('uses the local date at event time and crosses midnight without rollover state', () => {
    const statistics = createEmptyStatistics()

    incrementActivity(statistics, 'keyboard', new Date(2026, 7, 12, 23, 59, 59))
    incrementActivity(statistics, 'keyboard', new Date(2026, 7, 13, 0, 0, 1))

    assert.equal(statistics.daily['2026-08-12'].keyboard, 1)
    assert.equal(statistics.daily['2026-08-13'].keyboard, 1)
    assert.equal(getLocalDateKey(new Date(2027, 0, 1)), '2027-01-01')
  })

  it('aggregates today, yesterday, ISO week, month, and lifetime total', () => {
    const statistics = normalizeStatistics({
      schemaVersion: 1,
      daily: {
        '2026-07-31': { keyboard: 1, mouse: 1, controller: 0 },
        '2026-08-01': { keyboard: 2, mouse: 0, controller: 0 },
        '2026-08-09': { keyboard: 3, mouse: 0, controller: 0 },
        '2026-08-10': { keyboard: 4, mouse: 1, controller: 0 },
        '2026-08-11': { keyboard: 5, mouse: 0, controller: 0 },
        '2026-08-12': { keyboard: 6, mouse: 2, controller: 0 },
      },
    })

    const result = aggregateStatistics(statistics, new Date(2026, 7, 12, 12))

    assert.deepEqual(result.today, { keyboard: 6, mouse: 2, controller: 0 })
    assert.deepEqual(result.yesterday, { keyboard: 5, mouse: 0, controller: 0 })
    assert.deepEqual(result.thisWeek, { keyboard: 15, mouse: 3, controller: 0 })
    assert.deepEqual(result.thisMonth, { keyboard: 20, mouse: 3, controller: 0 })
    assert.deepEqual(result.total, { keyboard: 21, mouse: 4, controller: 0 })
  })

  it('keeps month and year boundaries in separate daily buckets', () => {
    const statistics = createEmptyStatistics()

    incrementActivity(statistics, 'keyboard', new Date(2026, 6, 31))
    incrementActivity(statistics, 'keyboard', new Date(2026, 7, 1))
    incrementActivity(statistics, 'mouse', new Date(2026, 11, 31))
    incrementActivity(statistics, 'mouse', new Date(2027, 0, 1))

    assert.deepEqual(Object.keys(statistics.daily), [
      '2026-07-31',
      '2026-08-01',
      '2026-12-31',
      '2027-01-01',
    ])
    assert.equal(activityTotal(aggregateStatistics(statistics, new Date(2027, 0, 1)).total), 4)
  })

  it('normalizes malformed persisted state without retaining unsafe values', () => {
    const normalized = normalizeStatistics({
      schemaVersion: 99,
      daily: {
        '2026-02-29': { keyboard: 9, mouse: 9, controller: 9 },
        '2026-08-12': { keyboard: 12, mouse: -1, controller: 1.5 },
        '2026-08-13': { keyboard: Number.MAX_SAFE_INTEGER + 1, mouse: 2 },
        'unexpected': 'value',
      },
    })

    assert.deepEqual(normalized, {
      schemaVersion: 1,
      daily: {
        '2026-08-12': { keyboard: 12, mouse: 0, controller: 0 },
        '2026-08-13': { keyboard: 0, mouse: 2, controller: 0 },
      },
    })
    assert.deepEqual(normalizeStatistics(null), createEmptyStatistics())
  })

  it('returns a zero-filled recent history in chronological order', () => {
    const statistics = normalizeStatistics({
      daily: {
        '2026-08-10': { keyboard: 3, mouse: 1, controller: 0 },
        '2026-08-12': { keyboard: 2, mouse: 0, controller: 0 },
      },
    })

    assert.deepEqual(getRecentDailyHistory(statistics, 3, new Date(2026, 7, 12)), [
      { date: '2026-08-10', counts: { keyboard: 3, mouse: 1, controller: 0 } },
      { date: '2026-08-11', counts: { keyboard: 0, mouse: 0, controller: 0 } },
      { date: '2026-08-12', counts: { keyboard: 2, mouse: 0, controller: 0 } },
    ])
  })

  it('merges a buffered batch into daily history without replacing existing counts', () => {
    const statistics = normalizeStatistics({
      daily: {
        '2026-08-12': { keyboard: 10, mouse: 2, controller: 0 },
      },
    })

    mergeActivityBatch(statistics, {
      '2026-08-12': { keyboard: 3, mouse: 1, controller: 0 },
      '2026-08-13': { keyboard: 2, mouse: 0, controller: 0 },
    })

    assert.deepEqual(statistics.daily, {
      '2026-08-12': { keyboard: 13, mouse: 3, controller: 0 },
      '2026-08-13': { keyboard: 2, mouse: 0, controller: 0 },
    })
  })
})
