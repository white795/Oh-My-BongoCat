<script setup lang="ts">
import { useNow } from '@vueuse/core'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { StatisticsAggregation } from '@/utils/statistics'

import { useGeneralStore } from '@/stores/general'
import { useStatisticsStore } from '@/stores/statistics'
import {
  activityTotal,
  aggregateStatistics,
  getRecentDailyHistory,
  STATISTICS_SCHEMA_VERSION,
} from '@/utils/statistics'

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

const history = computed(() => {
  return getRecentDailyHistory(statistics.value, 14, now.value).map(item => ({
    ...item,
    total: activityTotal(item.counts),
  }))
})

const historyMaximum = computed(() => {
  return Math.max(...history.value.map(item => item.total), 1)
})

function formatCount(value: number) {
  return new Intl.NumberFormat(generalStore.appearance.language).format(value)
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

        <div class="mt-3 flex flex-col gap-1.5">
          <div
            v-for="item in history"
            :key="item.date"
            class="grid grid-cols-[5.5rem_1fr_4.5rem] items-center gap-2 text-3"
          >
            <span class="tabular-nums color-text-tertiary">{{ item.date.slice(5) }}</span>

            <div class="h-2 overflow-hidden bg-[--ant-color-fill-secondary] rounded-full">
              <div
                class="h-full transition-all bg-blue-5 rounded-full"
                :style="{ width: `${(item.total / historyMaximum) * 100}%` }"
              />
            </div>

            <span class="text-right font-medium tabular-nums">{{ formatCount(item.total) }}</span>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
