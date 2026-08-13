export const STATISTICS_SCHEMA_VERSION = 1 as const

export const ACTIVITY_CATEGORIES = ['keyboard', 'mouse', 'controller'] as const

export type ActivityCategory = typeof ACTIVITY_CATEGORIES[number]

export interface ActivityCounts {
  keyboard: number
  mouse: number
  controller: number
}

export interface StatisticsData extends Record<string, unknown> {
  schemaVersion: typeof STATISTICS_SCHEMA_VERSION
  daily: Record<string, ActivityCounts>
}

export interface StatisticsAggregation {
  today: ActivityCounts
  yesterday: ActivityCounts
  thisWeek: ActivityCounts
  thisMonth: ActivityCounts
  total: ActivityCounts
}

export interface DailyHistoryItem {
  date: string
  counts: ActivityCounts
}

export function createEmptyCounts(): ActivityCounts {
  return {
    keyboard: 0,
    mouse: 0,
    controller: 0,
  }
}

export function createEmptyStatistics(): StatisticsData {
  return {
    schemaVersion: STATISTICS_SCHEMA_VERSION,
    daily: {},
  }
}

export function getLocalDateKey(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export function incrementActivity(
  statistics: StatisticsData,
  category: ActivityCategory,
  date = new Date(),
  amount = 1,
): void {
  if (!Number.isSafeInteger(amount) || amount <= 0) return

  const dateKey = getLocalDateKey(date)
  const counts = statistics.daily[dateKey] ??= createEmptyCounts()

  counts[category] = safeAdd(counts[category], amount)
}

export function mergeActivityBatch(
  statistics: StatisticsData,
  batch: Record<string, ActivityCounts>,
): void {
  for (const [date, incoming] of Object.entries(batch)) {
    if (!isValidDateKey(date)) continue

    const counts = statistics.daily[date] ??= createEmptyCounts()

    for (const category of ACTIVITY_CATEGORIES) {
      const amount = normalizeCount(incoming[category])

      counts[category] = safeAdd(counts[category], amount)
    }
  }
}

export function activityTotal(counts: ActivityCounts): number {
  return ACTIVITY_CATEGORIES.reduce((total, category) => {
    return safeAdd(total, counts[category])
  }, 0)
}

export function aggregateStatistics(
  statistics: StatisticsData,
  now = new Date(),
): StatisticsAggregation {
  const todayKey = getLocalDateKey(now)
  const yesterday = startOfLocalDay(now)
  yesterday.setDate(yesterday.getDate() - 1)

  const weekStart = startOfLocalDay(now)
  const daysSinceMonday = (weekStart.getDay() + 6) % 7
  weekStart.setDate(weekStart.getDate() - daysSinceMonday)

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  return {
    today: copyCounts(statistics.daily[todayKey]),
    yesterday: copyCounts(statistics.daily[getLocalDateKey(yesterday)]),
    thisWeek: aggregateRange(statistics.daily, getLocalDateKey(weekStart), todayKey),
    thisMonth: aggregateRange(statistics.daily, getLocalDateKey(monthStart), todayKey),
    total: aggregateRange(statistics.daily),
  }
}

export function getRecentDailyHistory(
  statistics: StatisticsData,
  days: number,
  now = new Date(),
): DailyHistoryItem[] {
  if (!Number.isFinite(days) || days <= 0) return []

  const cursor = startOfLocalDay(now)
  cursor.setDate(cursor.getDate() - Math.floor(days) + 1)

  return Array.from({ length: Math.floor(days) }, () => {
    const date = getLocalDateKey(cursor)
    const item = {
      date,
      counts: copyCounts(statistics.daily[date]),
    }

    cursor.setDate(cursor.getDate() + 1)

    return item
  })
}

export function normalizeStatistics(input: unknown): StatisticsData {
  const statistics = createEmptyStatistics()

  if (!isRecord(input) || !isRecord(input.daily)) return statistics

  const entries = Object.entries(input.daily)
    .filter(([date]) => isValidDateKey(date))
    .sort(([left], [right]) => left.localeCompare(right))

  for (const [date, value] of entries) {
    if (!isRecord(value)) continue

    statistics.daily[date] = {
      keyboard: normalizeCount(value.keyboard),
      mouse: normalizeCount(value.mouse),
      controller: normalizeCount(value.controller),
    }
  }

  return statistics
}

function aggregateRange(
  daily: StatisticsData['daily'],
  startDate?: string,
  endDate?: string,
): ActivityCounts {
  const total = createEmptyCounts()

  for (const [date, counts] of Object.entries(daily)) {
    if (startDate && date < startDate) continue
    if (endDate && date > endDate) continue

    for (const category of ACTIVITY_CATEGORIES) {
      total[category] = safeAdd(total[category], counts[category])
    }
  }

  return total
}

function copyCounts(counts?: ActivityCounts): ActivityCounts {
  return counts ? { ...counts } : createEmptyCounts()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isValidDateKey(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)

  if (!match) return false

  const [, yearValue, monthValue, dayValue] = match
  const year = Number(yearValue)
  const month = Number(monthValue)
  const day = Number(dayValue)
  const date = new Date(year, month - 1, day)

  return date.getFullYear() === year
    && date.getMonth() === month - 1
    && date.getDate() === day
}

function normalizeCount(value: unknown): number {
  return Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : 0
}

function safeAdd(left: number, right: number): number {
  return Math.min(left + right, Number.MAX_SAFE_INTEGER)
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}
