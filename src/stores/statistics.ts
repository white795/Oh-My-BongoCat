import { invoke } from '@tauri-apps/api/core'
import { saveNow } from '@tauri-store/pinia'
import { defineStore } from 'pinia'
import { reactive, ref, toRaw } from 'vue'

import type { ActivityCounts } from '@/utils/statistics'

import {
  mergeActivityBatch,
  normalizeStatistics,
  STATISTICS_SCHEMA_VERSION,
} from '@/utils/statistics'

export const STATISTICS_STORE_ID = 'statistics'

export const useStatisticsStore = defineStore(STATISTICS_STORE_ID, () => {
  const schemaVersion = ref<typeof STATISTICS_SCHEMA_VERSION>(STATISTICS_SCHEMA_VERSION)
  const daily = reactive<Record<string, ActivityCounts>>({})

  const commitActivityBatch = (batch: Record<string, ActivityCounts>) => {
    mergeActivityBatch({ schemaVersion: schemaVersion.value, daily }, batch)
  }

  const flushNow = async () => {
    const state = {
      schemaVersion: schemaVersion.value,
      daily: structuredClone(toRaw(daily)),
    }

    await invoke('plugin:pinia|patch', { id: STATISTICS_STORE_ID, state })
    await saveNow(STATISTICS_STORE_ID)
  }

  return {
    schemaVersion,
    daily,
    commitActivityBatch,
    flushNow,
  }
}, {
  tauri: {
    hooks: {
      beforeFrontendSync: normalizeStatistics,
    },
    saveOnChange: true,
    saveStrategy: 'throttle',
    saveInterval: 10_000,
  },
})
