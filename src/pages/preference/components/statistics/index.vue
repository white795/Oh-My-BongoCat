<script setup lang="ts">
import { useNow } from '@vueuse/core'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { StatisticsAggregation } from '@/utils/statistics'
import type { StatisticsHeatmapDay } from '@/utils/statisticsHeatmap'

import { useGeneralStore } from '@/stores/general'
import { useStatisticsStore } from '@/stores/statistics'
import {
  activityTotal,
  aggregateStatistics,
  STATISTICS_SCHEMA_VERSION,
} from '@/utils/statistics'
import { getStatisticsHeatmap } from '@/utils/statisticsHeatmap'

type PeriodKey = keyof StatisticsAggregation

const statisticsStore = useStatisticsStore()
const generalStore = useGeneralStore()
const selectedPeriod = ref<PeriodKey>('today')
const now = useNow({ interval: 60_000 })
const { t } = useI18n()

const statistics = computed(() => ({
  schemaVersion: STATISTICS_SCHEMA_VERSION,
  daily: statisticsStore.daily,
}))

const aggregation = computed(() => aggregateStatistics(statistics.value, now.value))
const selectedCounts = computed(() => aggregation.value[selectedPeriod.value])

const periods = computed<Array<{ key: PeriodKey, label: string }>>(() => [
  { key: 'today', label: t('pages.preference.statistics.labels.today') },
  { key: 'yesterday', label: t('pages.preference.statistics.labels.yesterday') },
  { key: 'thisWeek', label: t('pages.preference.statistics.labels.thisWeek') },
  { key: 'thisMonth', label: t('pages.preference.statistics.labels.thisMonth') },
  { key: 'total', label: t('pages.preference.statistics.labels.total') },
])

const breakdown = computed(() => [
  {
    key: 'keyboard',
    label: t('pages.preference.statistics.labels.keyboard'),
    value: selectedCounts.value.keyboard,
  },
  {
    key: 'mouse',
    label: t('pages.preference.statistics.labels.mouse'),
    value: selectedCounts.value.mouse,
  },
  {
    key: 'activity',
    label: t('pages.preference.statistics.labels.activity'),
    value: activityTotal(selectedCounts.value),
  },
])

const heatmap = computed(() => {
  return getStatisticsHeatmap(statistics.value, 53, now.value)
})

const heatmapWeeks = computed(() => {
  return Array.from({ length: Math.ceil(heatmap.value.length / 7) }, (_, index) => {
    return heatmap.value.slice(index * 7, (index + 1) * 7)
  })
})

const heatmapGridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${heatmapWeeks.value.length}, minmax(0, 1fr))`,
}))

const heatmapDateFormatter = computed(() => {
  return new Intl.DateTimeFormat(generalStore.appearance.language, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
})

const heatmapMonthFormatter = computed(() => {
  return new Intl.DateTimeFormat(generalStore.appearance.language, { month: 'short' })
})

const heatmapWeekdayFormatter = computed(() => {
  return new Intl.DateTimeFormat(generalStore.appearance.language, { weekday: 'short' })
})

const heatmapMonthLabels = computed(() => {
  return heatmapWeeks.value.map((week) => {
    const firstDayOfMonth = week.find(day => !day.isFuture && getDateFromKey(day.date).getDate() === 1)

    return firstDayOfMonth ? heatmapMonthFormatter.value.format(getDateFromKey(firstDayOfMonth.date)) : ''
  })
})

const heatmapWeekdayLabels = computed(() => {
  return heatmap.value.slice(0, 7).map((day, index) => {
    return [0, 2, 4].includes(index)
      ? heatmapWeekdayFormatter.value.format(getDateFromKey(day.date))
      : ''
  })
})

function formatCount(value: number) {
  return new Intl.NumberFormat(generalStore.appearance.language).format(value)
}

function formatHeatmapTitle(day: StatisticsHeatmapDay) {
  return [
    heatmapDateFormatter.value.format(getDateFromKey(day.date)),
    `${t('pages.preference.statistics.labels.activity')}: ${formatCount(day.total)}`,
    `${t('pages.preference.statistics.labels.keyboard')}: ${formatCount(day.counts.keyboard)}`,
    `${t('pages.preference.statistics.labels.mouse')}: ${formatCount(day.counts.mouse)}`,
  ].join(' · ')
}

function getDateFromKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number)

  return new Date(year, month - 1, day)
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <section class="b-1 b-solid p-4 bg-elevated b-border-sec rounded-lg">
      <div class="flex items-start justify-between gap-4">
        <div>
          <h2 class="m-0 text-5 font-semibold">
            {{ $t('pages.preference.statistics.labels.usage') }}
          </h2>

          <p class="mb-0 mt-1 text-3 color-text-tertiary">
            {{ $t('pages.preference.statistics.hints.localOnly') }}
          </p>
        </div>

        <div class="i-solar:shield-check-bold size-7 color-blue-5" />
      </div>

      <div class="grid grid-cols-2 mt-4 gap-2 lg:grid-cols-5">
        <button
          v-for="period in periods"
          :key="period.key"
          class="cursor-pointer b-1 b-solid p-3 text-left transition bg-transparent b-border-sec rounded-lg hover:b-blue-4"
          :class="{ 'b-blue-5! bg-blue-1! dark:bg-blue-9/20!': selectedPeriod === period.key }"
          type="button"
          @click="selectedPeriod = period.key"
        >
          <div class="text-3 color-text-tertiary">
            {{ period.label }}
          </div>

          <div class="mt-1 text-5 font-semibold tabular-nums">
            {{ formatCount(activityTotal(aggregation[period.key])) }}
          </div>
        </button>
      </div>
    </section>

    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <section class="b-1 b-solid p-4 bg-elevated b-border-sec rounded-lg">
        <h3 class="m-0 text-4 font-medium">
          {{ periods.find(period => period.key === selectedPeriod)?.label }}
        </h3>

        <div class="mt-3 flex flex-col gap-2">
          <div
            v-for="item in breakdown"
            :key="item.key"
            class="flex items-center justify-between bg-[--ant-color-fill-quaternary] px-3 py-2 rounded-md"
          >
            <span class="text-3.5 color-text-secondary">{{ item.label }}</span>
            <span class="font-semibold tabular-nums">{{ formatCount(item.value) }}</span>
          </div>
        </div>
      </section>

      <section class="b-1 b-solid p-4 bg-elevated b-border-sec rounded-lg">
        <h3 class="m-0 text-4 font-medium">
          {{ $t('pages.preference.statistics.labels.dailyHistory') }}
        </h3>

        <div class="statistics-heatmap mt-3 overflow-x-auto">
          <div
            class="min-w-180"
          >
            <div class="grid grid-cols-[2rem_minmax(0,1fr)] gap-1">
              <span />

              <div
                class="grid min-h-4 gap-1 text-2.5 color-text-tertiary"
                :style="heatmapGridStyle"
              >
                <span
                  v-for="(label, index) in heatmapMonthLabels"
                  :key="index"
                  class="whitespace-nowrap"
                >
                  {{ label }}
                </span>
              </div>
            </div>

            <div class="grid grid-cols-[2rem_minmax(0,1fr)] mt-1 gap-1">
              <div class="grid grid-rows-7 gap-1 text-2.5 leading-3 color-text-tertiary">
                <span
                  v-for="(label, index) in heatmapWeekdayLabels"
                  :key="index"
                  class="h-3 truncate"
                >
                  {{ label }}
                </span>
              </div>

              <div
                class="grid gap-1"
                :style="heatmapGridStyle"
              >
                <div
                  v-for="(week, index) in heatmapWeeks"
                  :key="index"
                  class="grid grid-rows-7 gap-1"
                >
                  <div
                    v-for="day in week"
                    :key="day.date"
                    :aria-label="day.isFuture ? void 0 : formatHeatmapTitle(day)"
                    class="heatmap-cell aspect-square rounded-[2px]"
                    :class="{ 'is-future': day.isFuture }"
                    :data-level="day.level"
                    role="img"
                    :title="day.isFuture ? '' : formatHeatmapTitle(day)"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.statistics-heatmap {
  --statistics-heatmap-level-0: var(--ant-color-fill-secondary);
  --statistics-heatmap-level-1: #dbeafe;
  --statistics-heatmap-level-2: #93c5fd;
  --statistics-heatmap-level-3: #3b82f6;
  --statistics-heatmap-level-4: #1d4ed8;
}

.heatmap-cell {
  background-color: var(--statistics-heatmap-level-0);
}

.heatmap-cell[data-level='1'] {
  background-color: var(--statistics-heatmap-level-1);
}

.heatmap-cell[data-level='2'] {
  background-color: var(--statistics-heatmap-level-2);
}

.heatmap-cell[data-level='3'] {
  background-color: var(--statistics-heatmap-level-3);
}

.heatmap-cell[data-level='4'] {
  background-color: var(--statistics-heatmap-level-4);
}

.heatmap-cell:not(.is-future):hover {
  outline: 1px solid var(--ant-color-text-secondary);
  outline-offset: 1px;
}

.heatmap-cell.is-future {
  visibility: hidden;
}

:global(.dark) .statistics-heatmap {
  --statistics-heatmap-level-1: #172554;
  --statistics-heatmap-level-2: #1e40af;
  --statistics-heatmap-level-3: #2563eb;
  --statistics-heatmap-level-4: #60a5fa;
}
</style>
