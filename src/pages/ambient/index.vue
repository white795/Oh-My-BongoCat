<script setup lang="ts">
import type { UnlistenFn } from '@tauri-apps/api/event'

import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

import workingVerbs from '@/assets/ambient-working-verbs.md?raw'
import { INVOKE_KEY, LISTEN_KEY } from '@/constants'

import AgentStar from './AgentStar.vue'

type AmbientStatus = 'idle' | 'working' | 'waiting' | 'done'
type AmbientSource = 'codex' | 'claude'

interface SessionInfo {
  sessionId: string
  source: AmbientSource
  state: AmbientStatus
}

interface AmbientSnapshot {
  state: AmbientStatus
  sequence: number
  source?: AmbientSource | null
  sessions: SessionInfo[]
}

const MAX_VISIBLE_STARS = 5
const FALLBACK_WORKING_WORDS = ['Working']
const WORD_ROTATION_MS = 6200
const WORD_EXIT_MS = 360
const WORD_ENTER_MS = 420

const sessions = ref<SessionInfo[]>([])
const word = ref('')
const wordPhase = ref<'word-exit' | 'word-enter'>()

const workingWords = parseWorkingWords(workingVerbs)
let latestSequence = -1
let currentWord = ''
let wordTimer: number | undefined
let wordExitTimer: number | undefined
let wordEnterTimer: number | undefined
let unlisten: UnlistenFn | undefined

const visibleSessions = computed(() => sessions.value.slice(0, MAX_VISIBLE_STARS))
const overflowCount = computed(() => Math.max(0, sessions.value.length - MAX_VISIBLE_STARS))
const anyWorking = computed(() => sessions.value.some(s => s.state === 'working'))

const wordSource = computed<'codex' | 'claude' | 'mixed'>(() => {
  const workingSources = new Set(
    sessions.value.filter(s => s.state === 'working').map(s => s.source),
  )
  if (workingSources.size !== 2) return [...workingSources][0] ?? 'codex'
  return 'mixed'
})

function parseWorkingWords(markdown: string) {
  const words = markdown
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim()
      return trimmed.startsWith('- ') ? trimmed.slice(2).trim() : undefined
    })
    .filter((value): value is string => Boolean(value))

  return words.length ? words : FALLBACK_WORKING_WORDS
}

function clearWordTransitions() {
  window.clearTimeout(wordExitTimer)
  window.clearTimeout(wordEnterTimer)
  wordExitTimer = undefined
  wordEnterTimer = undefined
  wordPhase.value = undefined
}

async function startWordEnter() {
  const { nextTick } = await import('vue')
  wordPhase.value = undefined
  await nextTick()
  wordPhase.value = 'word-enter'
  wordEnterTimer = window.setTimeout(() => {
    wordPhase.value = undefined
    wordEnterTimer = undefined
  }, WORD_ENTER_MS)
}

function transitionWordTo(nextWord: string) {
  if (word.value === nextWord && wordPhase.value !== 'word-exit') return

  clearWordTransitions()

  if (!word.value) {
    word.value = nextWord
    void startWordEnter()
    return
  }

  wordPhase.value = 'word-exit'
  wordExitTimer = window.setTimeout(() => {
    word.value = nextWord
    wordExitTimer = undefined
    void startWordEnter()
  }, WORD_EXIT_MS)
}

function chooseWorkingWord() {
  if (workingWords.length === 1) {
    currentWord = workingWords[0]
  } else {
    let nextWord = currentWord
    while (nextWord === currentWord) {
      nextWord = workingWords[Math.floor(Math.random() * workingWords.length)]
    }
    currentWord = nextWord
  }

  transitionWordTo(currentWord)
}

function stopWordAnimation() {
  window.clearInterval(wordTimer)
  wordTimer = undefined
  clearWordTransitions()
  word.value = ''
  currentWord = ''
}

watch(anyWorking, (isWorking) => {
  if (isWorking && !wordTimer) {
    chooseWorkingWord()
    wordTimer = window.setInterval(chooseWorkingWord, WORD_ROTATION_MS)
  } else if (!isWorking) {
    stopWordAnimation()
  }
})

function render(snapshot: AmbientSnapshot) {
  if (typeof snapshot.sequence === 'number' && snapshot.sequence < latestSequence) return
  latestSequence = snapshot.sequence ?? latestSequence

  sessions.value = snapshot.sessions ?? []
}

onMounted(async () => {
  unlisten = await listen<AmbientSnapshot>(LISTEN_KEY.CODEX_AMBIENT_SNAPSHOT, ({ payload }) => {
    render(payload)
  })

  const snapshot = await invoke<AmbientSnapshot>(INVOKE_KEY.GET_CODEX_AMBIENT_SNAPSHOT)
    .catch(() => undefined)
  if (snapshot) render(snapshot)
})

onUnmounted(() => {
  unlisten?.()
  stopWordAnimation()
})
</script>

<template>
  <main
    class="ambient-scene"
    :data-word-source="wordSource"
  >
    <div
      v-if="sessions.length > 0"
      class="indicator-bar"
    >
      <div class="stars-row">
        <AgentStar
          v-for="session in visibleSessions"
          :key="session.sessionId"
          :source="session.source"
          :state="session.state"
        />
        <span
          v-if="overflowCount > 0"
          class="overflow-mark"
        >+{{ overflowCount }}</span>
      </div>
      <span
        v-if="anyWorking"
        class="indicator-word"
        :class="wordPhase"
      >{{ word }}</span>
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

.ambient-scene {
  position: fixed;
  inset: 0;
  pointer-events: none;
}

/* ── indicator bar ─────────────────────────────────────────────────────── */

.indicator-bar {
  position: fixed;
  bottom: 10px;
  left: 50%;
  display: flex;
  align-items: center;
  gap: 8px;
  transform: translateX(-50%);
}

.stars-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

/* ── overflow mark ─────────────────────────────────────────────────────── */

.overflow-mark {
  color: rgba(180, 180, 200, 0.7);
  font-family: 'Segoe UI', system-ui, sans-serif;
  font-size: 10px;
  font-weight: 500;
  line-height: 22px;
}

/* ── word slot ─────────────────────────────────────────────────────────── */

.indicator-word {
  --word-color: rgba(163, 200, 253, 0.95);
  --word-glow: rgba(96, 160, 248, 0.76);
  --word-glow-soft: rgba(96, 160, 248, 0.54);
  --word-glow-strong: rgba(96, 160, 248, 0.92);

  max-width: 170px;
  overflow: hidden;
  color: var(--word-color);
  font-family: 'Segoe UI', 'Microsoft YaHei UI', system-ui, sans-serif;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.035em;
  line-height: 22px;
  text-align: left;
  text-overflow: ellipsis;
  text-shadow: 0 0 7px var(--word-glow);
  white-space: nowrap;
  animation: working-word-glow 2.4s ease-in-out infinite;
}

.ambient-scene[data-word-source='claude'] .indicator-word {
  --word-color: rgba(232, 160, 135, 0.95);
  --word-glow: rgba(210, 130, 100, 0.78);
  --word-glow-soft: rgba(210, 130, 100, 0.56);
  --word-glow-strong: rgba(210, 130, 100, 0.92);
}

.ambient-scene[data-word-source='mixed'] .indicator-word {
  --word-color: rgba(214, 196, 255, 0.9);
  --word-glow: rgba(170, 148, 228, 0.72);
  --word-glow-soft: rgba(170, 148, 228, 0.5);
  --word-glow-strong: rgba(170, 148, 228, 0.88);
}

.indicator-word.word-exit {
  animation: word-exit-left 360ms ease-in both;
}

.indicator-word.word-enter {
  animation: word-enter-from-right 420ms cubic-bezier(0.16, 0.82, 0.32, 1) both;
}

/* ── keyframes ─────────────────────────────────────────────────────────── */

@keyframes working-word-glow {
  0%,
  100% {
    opacity: 0.62;
    text-shadow: 0 0 5px var(--word-glow-soft);
  }
  50% {
    opacity: 0.96;
    text-shadow: 0 0 10px var(--word-glow-strong);
  }
}

@keyframes word-exit-left {
  from {
    clip-path: inset(0 0 0 0);
    opacity: 0.92;
    transform: translate(0);
  }
  to {
    clip-path: inset(0 100% 0 0);
    opacity: 0;
    transform: translate(-12px);
  }
}

@keyframes word-enter-from-right {
  from {
    clip-path: inset(0 0 0 100%);
    opacity: 0;
    transform: translate(12px);
  }
  to {
    clip-path: inset(0 0 0 0);
    opacity: 0.92;
    transform: translate(0);
  }
}
</style>
