<script setup lang="ts">
import type { UnlistenFn } from '@tauri-apps/api/event'

import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'

import workingVerbs from '@/assets/ambient-working-verbs.md?raw'
import { INVOKE_KEY, LISTEN_KEY } from '@/constants'

type AmbientStatus = 'idle' | 'working' | 'waiting' | 'done'

interface AmbientSnapshot {
  state: AmbientStatus
  sequence: number
}

const WORKING_GLYPHS = ['·', '✦', '✧', '×', '✢', '✣', '✤', '✥', '✤', '✣', '✢', '×', '✧', '✦', '·']
const FALLBACK_WORKING_WORDS = ['Working']
const GLYPH_ROTATION_MS = 700
const WORD_ROTATION_MS = 6200
const WORD_EXIT_MS = 360
const WORD_ENTER_MS = 420
const WORKING_TO_WAITING_OUT_MS = 300
const WAITING_ARRIVAL_MS = 420
const WAITING_TO_WORKING_OUT_MS = 260
const WORKING_ARRIVAL_MS = 380
const WORKING_TO_DONE_OUT_MS = 220

const indicator = ref<HTMLElement>()
const displayState = ref<AmbientStatus>('idle')
const core = ref('')
const word = ref('')
const glyphCycling = ref(false)
const wordPhase = ref<'word-exit' | 'word-enter'>()
const stateTransition = ref<
  | 'working-to-waiting'
  | 'waiting-arrive'
  | 'waiting-to-working'
  | 'working-arrive'
  | 'working-to-done'
>()
const doneReplay = ref(false)
const indicatorClasses = computed(() => [
  stateTransition.value,
  { 'done-replay': doneReplay.value },
])

const workingWords = parseWorkingWords(workingVerbs)
let visibleState: AmbientStatus = 'idle'
let latestSequence = -1
let glyphIndex = 0
let workingGeneration = 0
let currentWord = ''
let glyphTimer: ReturnType<typeof window.setInterval> | undefined
let wordTimer: ReturnType<typeof window.setInterval> | undefined
let wordExitTimer: ReturnType<typeof window.setTimeout> | undefined
let wordEnterTimer: ReturnType<typeof window.setTimeout> | undefined
let workingToWaitingTimer: ReturnType<typeof window.setTimeout> | undefined
let waitingArrivalTimer: ReturnType<typeof window.setTimeout> | undefined
let waitingToWorkingTimer: ReturnType<typeof window.setTimeout> | undefined
let workingArrivalTimer: ReturnType<typeof window.setTimeout> | undefined
let workingToDoneTimer: ReturnType<typeof window.setTimeout> | undefined
let unlisten: UnlistenFn | undefined

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

async function animateWorkingGlyph(generation: number) {
  glyphCycling.value = false
  core.value = WORKING_GLYPHS[glyphIndex]
  await nextTick()

  if (generation !== workingGeneration || displayState.value !== 'working') return

  void indicator.value?.offsetWidth
  glyphCycling.value = true
}

function clearWordTransitions() {
  window.clearTimeout(wordExitTimer)
  window.clearTimeout(wordEnterTimer)
  wordExitTimer = undefined
  wordEnterTimer = undefined
  wordPhase.value = undefined
}

async function startWordEnter() {
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

function stopWorkingAnimation() {
  workingGeneration += 1
  window.clearInterval(glyphTimer)
  window.clearInterval(wordTimer)
  glyphTimer = undefined
  wordTimer = undefined
  glyphCycling.value = false
  clearWordTransitions()
}

function startWorkingAnimation() {
  workingGeneration += 1
  const generation = workingGeneration
  glyphIndex = 0
  void animateWorkingGlyph(generation)
  chooseWorkingWord()

  glyphTimer = window.setInterval(() => {
    glyphIndex = (glyphIndex + 1) % WORKING_GLYPHS.length
    void animateWorkingGlyph(generation)
  }, GLYPH_ROTATION_MS)
  wordTimer = window.setInterval(chooseWorkingWord, WORD_ROTATION_MS)
}

function clearStateTransitions() {
  window.clearTimeout(workingToWaitingTimer)
  window.clearTimeout(waitingArrivalTimer)
  window.clearTimeout(waitingToWorkingTimer)
  window.clearTimeout(workingArrivalTimer)
  window.clearTimeout(workingToDoneTimer)
  workingToWaitingTimer = undefined
  waitingArrivalTimer = undefined
  waitingToWorkingTimer = undefined
  workingArrivalTimer = undefined
  workingToDoneTimer = undefined
  stateTransition.value = undefined
}

function beginWorkingToWaitingTransition() {
  stopWorkingAnimation()
  clearStateTransitions()
  doneReplay.value = false
  stateTransition.value = 'working-to-waiting'

  workingToWaitingTimer = window.setTimeout(() => {
    stateTransition.value = undefined
    displayState.value = 'waiting'
    core.value = '?'
    word.value = ''
    currentWord = ''
    void indicator.value?.offsetWidth
    stateTransition.value = 'waiting-arrive'
    waitingArrivalTimer = window.setTimeout(() => {
      stateTransition.value = undefined
      waitingArrivalTimer = undefined
    }, WAITING_ARRIVAL_MS)
    workingToWaitingTimer = undefined
  }, WORKING_TO_WAITING_OUT_MS)
}

function beginWaitingToWorkingTransition() {
  if (displayState.value !== 'waiting') {
    clearStateTransitions()
    displayState.value = 'working'
    setCoreForState('working', false)
    return
  }

  stopWorkingAnimation()
  clearStateTransitions()
  doneReplay.value = false
  stateTransition.value = 'waiting-to-working'

  waitingToWorkingTimer = window.setTimeout(() => {
    stateTransition.value = undefined
    displayState.value = 'working'
    core.value = '·'
    word.value = ''
    currentWord = ''
    void indicator.value?.offsetWidth
    stateTransition.value = 'working-arrive'
    workingArrivalTimer = window.setTimeout(() => {
      stateTransition.value = undefined
      startWorkingAnimation()
      workingArrivalTimer = undefined
    }, WORKING_ARRIVAL_MS)
    waitingToWorkingTimer = undefined
  }, WAITING_TO_WORKING_OUT_MS)
}

function beginWorkingToDoneTransition() {
  stopWorkingAnimation()
  clearStateTransitions()
  doneReplay.value = false
  stateTransition.value = 'working-to-done'

  workingToDoneTimer = window.setTimeout(() => {
    stateTransition.value = undefined
    displayState.value = 'done'
    core.value = '✓'
    word.value = ''
    currentWord = ''
    void indicator.value?.offsetWidth
    doneReplay.value = true
    workingToDoneTimer = undefined
  }, WORKING_TO_DONE_OUT_MS)
}

function setCoreForState(state: AmbientStatus, replayDone: boolean) {
  stopWorkingAnimation()
  clearStateTransitions()
  doneReplay.value = false

  if (state === 'working') {
    startWorkingAnimation()
    return
  }

  word.value = ''
  currentWord = ''
  if (state === 'waiting') {
    core.value = '?'
    return
  }

  if (state === 'done') {
    core.value = '✓'
    if (replayDone) {
      void indicator.value?.offsetWidth
      doneReplay.value = true
    }
    return
  }

  core.value = ''
}

function render(snapshot: AmbientSnapshot) {
  if (typeof snapshot.sequence === 'number' && snapshot.sequence < latestSequence) return

  latestSequence = snapshot.sequence ?? latestSequence
  const nextState = snapshot.state || 'idle'
  const previousState = visibleState
  const stateChanged = nextState !== visibleState
  visibleState = nextState

  if (previousState === 'working' && nextState === 'waiting') {
    beginWorkingToWaitingTransition()
    return
  }

  if (previousState === 'waiting' && nextState === 'working') {
    beginWaitingToWorkingTransition()
    return
  }

  if (previousState === 'working' && nextState === 'done') {
    beginWorkingToDoneTransition()
    return
  }

  if (nextState === 'waiting' && stateTransition.value === 'working-to-waiting') return
  if (nextState === 'working' && stateTransition.value === 'waiting-to-working') return
  if (nextState === 'done' && stateTransition.value === 'working-to-done') return

  displayState.value = nextState
  if (stateChanged || nextState === 'done') {
    setCoreForState(nextState, nextState === 'done')
  }
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
  stopWorkingAnimation()
  clearStateTransitions()
})
</script>

<template>
  <main
    aria-hidden="true"
    class="ambient-scene"
    :data-state="displayState"
  >
    <div
      ref="indicator"
      class="agent-indicator"
      :class="indicatorClasses"
    >
      <div class="indicator-glow" />
      <div class="indicator-content">
        <span
          class="indicator-core"
          :class="{ 'glyph-cycle': glyphCycling }"
        >{{ core }}</span>
        <span
          class="indicator-word"
          :class="wordPhase"
        >{{ word }}</span>
      </div>
      <div class="indicator-ripple" />
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

.agent-indicator {
  position: fixed;
  bottom: 0;
  left: 50%;
  width: min(280px, 58vw);
  height: 46px;
  transform: translateX(-50%);
  opacity: 0;
  transition:
    opacity 220ms ease,
    filter 360ms ease;
}

.indicator-glow {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 26px;
  border-radius: 50%;
  background: transparent;
  filter: blur(5px);
  opacity: 0;
  transition:
    opacity 360ms ease,
    background 360ms ease;
}

.indicator-glow::before {
  position: absolute;
  top: 0;
  bottom: 0;
  left: -22%;
  width: 48%;
  border-radius: inherit;
  background: radial-gradient(
    ellipse at center,
    rgba(177, 219, 255, 0.92) 0%,
    rgba(105, 170, 239, 0.4) 33%,
    transparent 76%
  );
  content: '';
  opacity: 0;
  transition: opacity 240ms ease;
}

.indicator-content {
  position: absolute;
  bottom: 14px;
  left: 50%;
  display: flex;
  align-items: center;
  gap: 7px;
  transform: translateX(-50%);
}

.indicator-core {
  flex: 0 0 18px;
  width: 18px;
  color: transparent;
  font-family: 'Segoe UI Symbol', 'Noto Sans Symbols 2', sans-serif;
  font-size: 15px;
  font-weight: 600;
  line-height: 18px;
  text-align: center;
  text-shadow: none;
  transition:
    color 260ms ease,
    text-shadow 260ms ease;
}

.indicator-word {
  max-width: 170px;
  overflow: hidden;
  color: transparent;
  font-family: 'Segoe UI', 'Microsoft YaHei UI', system-ui, sans-serif;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.035em;
  line-height: 18px;
  text-align: left;
  text-overflow: ellipsis;
  text-shadow: none;
  white-space: nowrap;
  opacity: 0;
  transform: translateY(1px);
  transition:
    color 260ms ease,
    opacity 260ms ease,
    text-shadow 260ms ease;
}

.indicator-ripple {
  position: absolute;
  right: 15%;
  bottom: 8px;
  left: 15%;
  height: 1px;
  border-radius: 999px;
  background: linear-gradient(90deg, transparent, rgba(173, 255, 198, 0.9), transparent);
  opacity: 0;
  transform: scaleX(0.05);
  transform-origin: center;
}

.ambient-scene[data-state='working'] .agent-indicator,
.ambient-scene[data-state='waiting'] .agent-indicator,
.ambient-scene[data-state='done'] .agent-indicator {
  opacity: 1;
}

.ambient-scene[data-state='working'] .indicator-glow {
  opacity: 0.13;
}

.ambient-scene[data-state='working'] .indicator-glow::before {
  opacity: 1;
  animation: working-glow-flow 3.2s ease-in-out infinite alternate;
}

.ambient-scene[data-state='working'] .indicator-core {
  color: rgba(218, 238, 255, 0.92);
  text-shadow: 0 0 8px rgba(125, 191, 255, 0.72);
}

.ambient-scene[data-state='working'] .indicator-core.glyph-cycle {
  animation: working-glyph-cycle 700ms ease-in-out both;
}

.ambient-scene[data-state='working'] .indicator-word {
  color: rgba(194, 226, 255, 0.88);
  text-shadow: 0 0 7px rgba(111, 184, 255, 0.64);
  animation: working-word-glow 2.4s ease-in-out infinite;
}

.ambient-scene[data-state='working'] .indicator-word.word-exit {
  animation: word-exit-left 360ms ease-in both;
}

.ambient-scene[data-state='working'] .indicator-word.word-enter {
  animation: word-enter-from-right 420ms cubic-bezier(0.16, 0.82, 0.32, 1) both;
}

.ambient-scene[data-state='waiting'] .indicator-glow {
  opacity: 0.24;
  background: radial-gradient(
    ellipse at center,
    rgba(255, 207, 126, 0.86) 0%,
    rgba(234, 155, 61, 0.38) 33%,
    transparent 74%
  );
}

.ambient-scene[data-state='waiting'] .indicator-core {
  color: rgba(255, 220, 157, 0.98);
  text-shadow: 0 0 8px rgba(244, 168, 67, 0.78);
  animation: none;
}

.ambient-scene[data-state='working'] .agent-indicator.working-to-waiting .indicator-core {
  animation: working-to-waiting-core-out 300ms ease-in both;
}

.ambient-scene[data-state='working'] .agent-indicator.working-to-waiting .indicator-word {
  animation: working-to-waiting-word-out 300ms ease-in both;
}

.ambient-scene[data-state='working'] .agent-indicator.working-to-waiting .indicator-glow::before {
  animation: none;
  opacity: 0;
}

.ambient-scene[data-state='waiting'] .agent-indicator.waiting-arrive .indicator-core {
  animation: waiting-core-arrive 360ms cubic-bezier(0.16, 0.82, 0.32, 1) both;
}

.ambient-scene[data-state='waiting'] .agent-indicator.waiting-arrive .indicator-glow {
  animation: waiting-glow-arrive 420ms ease-out both;
}

.ambient-scene[data-state='waiting'] .agent-indicator.waiting-to-working .indicator-core {
  animation: waiting-to-working-core-out 260ms ease-in both;
}

.ambient-scene[data-state='waiting'] .agent-indicator.waiting-to-working .indicator-glow {
  animation: waiting-to-working-glow-out 260ms ease-in both;
}

.ambient-scene[data-state='working'] .agent-indicator.working-arrive .indicator-core {
  animation: working-core-arrive 380ms cubic-bezier(0.16, 0.82, 0.32, 1) both;
}

.ambient-scene[data-state='working'] .agent-indicator.working-arrive .indicator-glow::before {
  animation: working-glow-arrive 380ms ease-out both;
}

.ambient-scene[data-state='working'] .agent-indicator.working-to-done .indicator-core {
  animation: working-to-done-core-out 220ms ease-in both;
}

.ambient-scene[data-state='working'] .agent-indicator.working-to-done .indicator-word {
  animation: working-to-done-word-out 220ms ease-in both;
}

.ambient-scene[data-state='working'] .agent-indicator.working-to-done .indicator-glow::before {
  animation: working-to-done-glow-out 220ms ease-in both;
}

.ambient-scene[data-state='waiting'] .indicator-word,
.ambient-scene[data-state='done'] .indicator-word {
  animation: none;
  opacity: 0;
}

.ambient-scene[data-state='done'] .indicator-glow {
  opacity: 0;
  background: radial-gradient(
    ellipse at center,
    rgba(153, 255, 187, 0.92) 0%,
    rgba(61, 194, 115, 0.4) 33%,
    transparent 74%
  );
}

.ambient-scene[data-state='done'] .indicator-core {
  color: rgba(203, 255, 216, 1);
  text-shadow: 0 0 8px rgba(103, 232, 147, 0.82);
}

.ambient-scene[data-state='done'] .agent-indicator.done-replay {
  animation: done-indicator-fade 5s ease-out both;
}

.ambient-scene[data-state='done'] .agent-indicator.done-replay .indicator-core {
  animation: done-core-in 260ms cubic-bezier(0.16, 0.82, 0.32, 1) both;
}

.ambient-scene[data-state='done'] .agent-indicator.done-replay .indicator-glow {
  animation: done-glow-fade 5s ease-out both;
}

.ambient-scene[data-state='done'] .agent-indicator.done-replay .indicator-ripple {
  animation: done-ripple-out 800ms cubic-bezier(0.16, 0.76, 0.25, 1) both;
}

@keyframes working-glyph-cycle {
  0%,
  100% {
    opacity: 0.72;
    transform: scale(0.94);
  }
  50% {
    opacity: 1;
    transform: scale(1.06);
  }
}

@keyframes working-word-glow {
  0%,
  100% {
    opacity: 0.62;
    text-shadow: 0 0 5px rgba(111, 184, 255, 0.46);
  }
  50% {
    opacity: 0.96;
    text-shadow: 0 0 10px rgba(111, 184, 255, 0.8);
  }
}

@keyframes working-glow-flow {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(250%);
  }
}

@keyframes word-exit-left {
  from {
    clip-path: inset(0 0 0 0);
    opacity: 0.92;
    transform: translate(0, 1px);
  }
  to {
    clip-path: inset(0 100% 0 0);
    opacity: 0;
    transform: translate(-12px, 1px);
  }
}

@keyframes word-enter-from-right {
  from {
    clip-path: inset(0 0 0 100%);
    opacity: 0;
    transform: translate(12px, 1px);
  }
  to {
    clip-path: inset(0 0 0 0);
    opacity: 0.92;
    transform: translate(0, 1px);
  }
}

@keyframes working-to-waiting-core-out {
  from {
    opacity: 1;
    transform: scale(1) rotate(0);
  }
  to {
    opacity: 0;
    transform: scale(0.52) rotate(-24deg);
  }
}

@keyframes working-to-waiting-word-out {
  from {
    clip-path: inset(0 0 0 0);
    opacity: 0.9;
    transform: translate(0, 1px);
  }
  to {
    clip-path: inset(0 100% 0 0);
    opacity: 0;
    transform: translate(-14px, 1px);
  }
}

@keyframes waiting-core-arrive {
  from {
    opacity: 0;
    transform: scale(0.56);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes waiting-glow-arrive {
  from {
    opacity: 0;
    transform: scaleX(0.58);
  }
  to {
    opacity: 0.24;
    transform: scaleX(1);
  }
}

@keyframes waiting-to-working-core-out {
  from {
    opacity: 1;
    transform: scale(1);
  }
  to {
    opacity: 0;
    transform: scale(0.58) rotate(18deg);
  }
}

@keyframes waiting-to-working-glow-out {
  from {
    opacity: 0.24;
    transform: scaleX(1);
  }
  to {
    opacity: 0;
    transform: scaleX(0.62);
  }
}

@keyframes working-core-arrive {
  from {
    opacity: 0;
    transform: scale(0.58);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes working-glow-arrive {
  from {
    opacity: 0;
    transform: translateX(30%) scaleX(0.7);
  }
  to {
    opacity: 1;
    transform: translateX(0) scaleX(1);
  }
}

@keyframes working-to-done-core-out {
  from {
    opacity: 1;
    transform: scale(1) rotate(0);
  }
  to {
    opacity: 0;
    transform: scale(0.54) rotate(22deg);
  }
}

@keyframes working-to-done-word-out {
  from {
    clip-path: inset(0 0 0 0);
    opacity: 0.9;
    transform: translate(0, 1px);
  }
  to {
    clip-path: inset(0 100% 0 0);
    opacity: 0;
    transform: translate(-14px, 1px);
  }
}

@keyframes working-to-done-glow-out {
  from {
    opacity: 1;
    transform: translateX(0) scaleX(1);
  }
  to {
    opacity: 0;
    transform: translateX(34%) scaleX(0.56);
  }
}

@keyframes done-core-in {
  from {
    opacity: 0;
    transform: scale(0.55);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes done-ripple-out {
  0% {
    opacity: 0;
    transform: scaleX(0.05);
  }
  16% {
    opacity: 0.95;
  }
  100% {
    opacity: 0;
    transform: scaleX(1);
  }
}

@keyframes done-glow-fade {
  0% {
    opacity: 0;
    transform: scaleX(0.22);
  }
  4% {
    opacity: 0.4;
  }
  78% {
    opacity: 0.24;
  }
  100% {
    opacity: 0;
    transform: scaleX(1.1);
  }
}

@keyframes done-indicator-fade {
  0% {
    opacity: 0;
  }
  4% {
    opacity: 1;
  }
  82% {
    opacity: 0.9;
  }
  100% {
    opacity: 0;
  }
}
</style>
