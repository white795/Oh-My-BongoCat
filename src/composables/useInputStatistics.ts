import type { Event as TauriEvent, UnlistenFn } from '@tauri-apps/api/event'

import { emit, listen } from '@tauri-apps/api/event'
import { nextTick, onUnmounted } from 'vue'

import { LISTEN_KEY } from '@/constants'
import { useStatisticsStore } from '@/stores/statistics'
import { ActivityBuffer, InputActivityEdges } from '@/utils/inputStatistics'
import { isWindows } from '@/utils/platform'

import { useCatStore } from '../stores/cat'
import { useTauriListen } from './useTauriListen'

interface FlushRequest {
  requestId: string
}

const BATCH_INTERVAL = 1_000
const FLUSH_TIMEOUT = 1_500

export function useInputStatistics() {
  const statisticsStore = useStatisticsStore()
  const catStore = useCatStore()
  const buffer = new ActivityBuffer()
  const edges = new InputActivityEdges()
  const releaseTimers = new Map<string, ReturnType<typeof setTimeout>>()
  let batchTimer: ReturnType<typeof setTimeout> | undefined

  const flushPending = () => {
    if (batchTimer) {
      clearTimeout(batchTimer)
      batchTimer = void 0
    }

    if (buffer.empty) return

    statisticsStore.commitActivityBatch(buffer.drain())
  }

  const flushAndSave = async () => {
    flushPending()

    await nextTick()
    await statisticsStore.flushNow()
  }

  const scheduleFlush = () => {
    batchTimer ??= setTimeout(flushPending, BATCH_INTERVAL)
  }

  const scheduleKeyFallbackRelease = (key: string) => {
    const currentTimer = releaseTimers.get(key)

    if (currentTimer) clearTimeout(currentTimer)

    if (!isWindows && key !== 'CapsLock') return

    const configuredDelay = catStore.model.autoReleaseDelay * 1_000
    const delay = key === 'CapsLock' ? 100 : Math.max(configuredDelay, 1_000)
    const timer = setTimeout(() => {
      edges.releaseKey(key)
      releaseTimers.delete(key)
    }, delay)

    releaseTimers.set(key, timer)
  }

  const recordDeviceActivity = (kind: Parameters<InputActivityEdges['handle']>[0], value: unknown) => {
    const eventValue = typeof value === 'string' ? value : ''

    if (kind === 'KeyboardRelease') {
      const timer = releaseTimers.get(eventValue)

      if (timer) clearTimeout(timer)

      releaseTimers.delete(eventValue)
    } else if (kind === 'KeyboardPress') {
      scheduleKeyFallbackRelease(eventValue)
    }

    const category = edges.handle(kind, eventValue)

    if (!category) return

    buffer.record(category)
    scheduleFlush()

    return category
  }

  useTauriListen<FlushRequest>(LISTEN_KEY.FLUSH_STATISTICS, async ({ payload }) => {
    try {
      await flushAndSave()
    } finally {
      await emit(LISTEN_KEY.STATISTICS_FLUSHED, payload)
    }
  })

  onUnmounted(() => {
    flushPending()
    edges.reset()

    for (const timer of releaseTimers.values()) clearTimeout(timer)

    releaseTimers.clear()
  })

  return {
    recordDeviceActivity,
  }
}

export async function flushStatisticsBeforeExit(): Promise<void> {
  const requestId = crypto.randomUUID()
  let unlisten: UnlistenFn | undefined
  let timeout: ReturnType<typeof setTimeout> | undefined

  try {
    let resolveFlushed: () => void
    const flushed = new Promise<void>((resolve) => {
      resolveFlushed = resolve
    })

    unlisten = await listen<FlushRequest>(LISTEN_KEY.STATISTICS_FLUSHED, ({ payload }: TauriEvent<FlushRequest>) => {
      if (payload.requestId === requestId) resolveFlushed()
    })

    await emit(LISTEN_KEY.FLUSH_STATISTICS, { requestId })

    await Promise.race([
      flushed,
      new Promise<void>((resolve) => {
        timeout = setTimeout(resolve, FLUSH_TIMEOUT)
      }),
    ])
  } catch (error) {
    console.error('Failed to flush input statistics before exit', error)
  } finally {
    if (timeout) clearTimeout(timeout)

    unlisten?.()
  }
}
