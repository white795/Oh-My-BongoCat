import type { ActivityCounts, StatisticsData } from './statistics'

import { activityTotal, createEmptyCounts, getLocalDateKey } from './statistics'

export type StatisticsHeatmapLevel = 0 | 1 | 2 | 3 | 4

export interface StatisticsHeatmapDay {
  date: string
  counts: ActivityCounts
  total: number
  level: StatisticsHeatmapLevel
  isFuture: boolean
}

/**
 * Produces a Monday-first calendar grid that is safe to render as a GitHub-style
 * contribution graph. Days after the local current day remain blank.
 */
export function getStatisticsHeatmap(
  statistics: StatisticsData,
  weeks = 53,
  now = new Date(),
): StatisticsHeatmapDay[] {
  const weekCount = Number.isFinite(weeks) ? Math.max(1, Math.floor(weeks)) : 53
  const today = startOfLocalDay(now)
  const todayKey = getLocalDateKey(today)
  const start = new Date(today)
  const daysSinceMonday = (start.getDay() + 6) % 7

  start.setDate(start.getDate() - daysSinceMonday - ((weekCount - 1) * 7))

  const days = Array.from({ length: weekCount * 7 }, (_, index) => {
    const cursor = new Date(start)

    cursor.setDate(cursor.getDate() + index)

    const date = getLocalDateKey(cursor)
    const isFuture = date > todayKey
    const counts = isFuture
      ? createEmptyCounts()
      : { ...(statistics.daily[date] ?? createEmptyCounts()) }

    return {
      date,
      counts,
      total: activityTotal(counts),
      level: 0 as StatisticsHeatmapLevel,
      isFuture,
    }
  })

  const maximum = Math.max(...days.filter(day => !day.isFuture).map(day => day.total), 1)

  return days.map(day => ({
    ...day,
    level: getStatisticsHeatmapLevel(day.total, maximum),
  }))
}

/**
 * Spreads large input-count ranges over four visible blue levels without making
 * ordinary active days indistinguishable when one day has an unusually high total.
 */
export function getStatisticsHeatmapLevel(
  total: number,
  maximum: number,
): StatisticsHeatmapLevel {
  if (!Number.isFinite(total) || total <= 0) return 0

  const safeMaximum = Math.max(maximum, 1)
  const ratio = Math.log1p(total) / Math.log1p(safeMaximum)

  return Math.min(4, Math.max(1, Math.ceil(ratio * 4))) as StatisticsHeatmapLevel
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}
