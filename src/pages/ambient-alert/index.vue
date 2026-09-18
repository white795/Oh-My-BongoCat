<script setup lang="ts">
import type { UnlistenFn } from '@tauri-apps/api/event'

import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { nextTick, onMounted, onUnmounted, ref } from 'vue'

import { INVOKE_KEY, LISTEN_KEY } from '@/constants'

type AmbientAlertKind = 'waiting' | 'done'

interface AmbientAlertPayload {
  kind: AmbientAlertKind
  generation: number
  durationMs: number
}

const activeAlert = ref<AmbientAlertPayload>()

let latestGeneration = 0
let completionTimer: number | undefined
let unlisten: UnlistenFn | undefined

function clearCompletionTimer() {
  window.clearTimeout(completionTimer)
  completionTimer = undefined
}

async function completeAlert(generation: number) {
  if (activeAlert.value?.generation !== generation) return

  activeAlert.value = undefined
  completionTimer = undefined
  await invoke(INVOKE_KEY.COMPLETE_AGENT_AMBIENT_ALERT, { generation }).catch(() => undefined)
}

async function renderAlert(payload: AmbientAlertPayload) {
  if (payload.generation <= latestGeneration) return

  latestGeneration = payload.generation
  clearCompletionTimer()
  activeAlert.value = undefined
  await nextTick()
  if (payload.generation !== latestGeneration) return

  activeAlert.value = payload
  completionTimer = window.setTimeout(() => {
    void completeAlert(payload.generation)
  }, payload.durationMs)
}

onMounted(async () => {
  unlisten = await listen<AmbientAlertPayload>(LISTEN_KEY.AGENT_AMBIENT_ALERT, ({ payload }) => {
    void renderAlert(payload)
  })
})

onUnmounted(() => {
  unlisten?.()
  clearCompletionTimer()
})
</script>

<template>
  <main class="alert-scene">
    <div
      v-if="activeAlert"
      :key="activeAlert.generation"
      class="edge-alert"
      :data-kind="activeAlert.kind"
    >
      <span class="edge edge-top" />
      <span class="edge edge-right" />
      <span class="edge edge-bottom" />
      <span class="edge edge-left" />
    </div>
  </main>
</template>

<style scoped>
:global(html),
:global(body),
:global(#app) {
  width: 100%;
  height: 100%;
  margin: 0;
  overflow: hidden;
  background: transparent !important;
}

.alert-scene,
.edge-alert {
  position: fixed;
  inset: 0;
  pointer-events: none;
}

.edge {
  position: absolute;
  display: block;
  opacity: 0;
  will-change: opacity, transform;
}

.edge-top,
.edge-bottom {
  right: 0;
  left: 0;
  height: 6px;
}

.edge-top {
  top: 0;
}

.edge-bottom {
  bottom: 0;
}

.edge-right,
.edge-left {
  top: 0;
  bottom: 0;
  width: 6px;
}

.edge-right {
  right: 0;
}

.edge-left {
  left: 0;
}

.edge-alert[data-kind='waiting'] .edge {
  background: rgba(255, 126, 72, 0.72);
  box-shadow:
    0 0 12px rgba(255, 82, 54, 0.88),
    0 0 28px rgba(255, 154, 74, 0.58);
  filter: blur(3px);
  animation: waiting-edge-breathe 1400ms cubic-bezier(0.45, 0, 0.55, 1) 2;
}

.edge-alert[data-kind='waiting'] .edge-top,
.edge-alert[data-kind='waiting'] .edge-bottom {
  height: 7px;
}

.edge-alert[data-kind='waiting'] .edge-right,
.edge-alert[data-kind='waiting'] .edge-left {
  width: 7px;
}

.edge-alert[data-kind='done'] .edge {
  overflow: visible;
  opacity: 1;
}

.edge-alert[data-kind='done'] .edge::before {
  position: absolute;
  content: '';
  background: rgba(137, 255, 177, 0.86);
  box-shadow:
    0 0 12px rgba(81, 232, 137, 0.88),
    0 0 26px rgba(122, 255, 174, 0.58);
  filter: blur(3px);
}

.edge-alert[data-kind='done'] .edge-top::before,
.edge-alert[data-kind='done'] .edge-bottom::before {
  top: 0;
  bottom: 0;
  left: -38%;
  width: 38%;
  animation: done-edge-horizontal 1800ms cubic-bezier(0.2, 0.72, 0.25, 1) both;
}

.edge-alert[data-kind='done'] .edge-right::before,
.edge-alert[data-kind='done'] .edge-left::before {
  top: -38%;
  right: 0;
  left: 0;
  height: 38%;
  animation: done-edge-vertical 1800ms cubic-bezier(0.2, 0.72, 0.25, 1) both;
}

.edge-alert[data-kind='done'] .edge::after {
  position: absolute;
  content: '';
  background: rgba(155, 255, 194, 0.74);
  box-shadow: 0 0 4px rgba(120, 245, 168, 0.44);
}

.edge-alert[data-kind='done'] .edge-top::after,
.edge-alert[data-kind='done'] .edge-bottom::after {
  left: -38%;
  width: 38%;
  height: 2px;
  animation: done-core-horizontal 1800ms cubic-bezier(0.2, 0.72, 0.25, 1) both;
}

.edge-alert[data-kind='done'] .edge-top::after {
  top: 0;
}

.edge-alert[data-kind='done'] .edge-bottom::after {
  bottom: 0;
}

.edge-alert[data-kind='done'] .edge-right::after,
.edge-alert[data-kind='done'] .edge-left::after {
  top: -38%;
  width: 2px;
  height: 38%;
  animation: done-core-vertical 1800ms cubic-bezier(0.2, 0.72, 0.25, 1) both;
}

.edge-alert[data-kind='done'] .edge-right::after {
  right: 0;
}

.edge-alert[data-kind='done'] .edge-left::after {
  left: 0;
}

@keyframes waiting-edge-breathe {
  0%,
  100% {
    opacity: 0;
  }
  50% {
    opacity: 0.78;
  }
}

@keyframes done-edge-horizontal {
  0% {
    opacity: 0;
    transform: translateX(0);
  }
  18%,
  78% {
    opacity: 0.65;
  }
  100% {
    opacity: 0;
    transform: translateX(365%);
  }
}

@keyframes done-edge-vertical {
  0% {
    opacity: 0;
    transform: translateY(0);
  }
  18%,
  78% {
    opacity: 0.65;
  }
  100% {
    opacity: 0;
    transform: translateY(365%);
  }
}

@keyframes done-core-horizontal {
  0% {
    opacity: 0;
    transform: translateX(0);
  }
  18%,
  78% {
    opacity: 0.93;
  }
  100% {
    opacity: 0;
    transform: translateX(365%);
  }
}

@keyframes done-core-vertical {
  0% {
    opacity: 0;
    transform: translateY(0);
  }
  18%,
  78% {
    opacity: 0.93;
  }
  100% {
    opacity: 0;
    transform: translateY(365%);
  }
}
</style>
