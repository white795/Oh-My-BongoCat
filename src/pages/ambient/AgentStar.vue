<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

type AmbientStatus = 'idle' | 'working' | 'waiting' | 'done'
type AmbientSource = 'codex' | 'claude'

const props = defineProps<{
  source: AmbientSource
  state: AmbientStatus
}>()
const GLYPHS = ['·', '✦', '✧', '×', '✢', '✣', '✤', '✥', '✤', '✣', '✢', '×', '✧', '✦', '·']
const GLYPH_MS = 700
const EXIT_MS = 220
const ENTER_MS = 300

const starEl = ref<HTMLElement>()
const displayState = ref<AmbientStatus>('idle')
const core = ref('')
const glyphCycling = ref(false)
const coreTransition = ref<'exit' | 'enter'>()
const doneReplay = ref(false)

let glyphGen = 0
let glyphIdx = 0
let glyphTimer: number | undefined
let exitTimer: number | undefined
let enterTimer: number | undefined

function stopGlyphs() {
  glyphGen++
  clearInterval(glyphTimer)
  glyphTimer = undefined
  glyphCycling.value = false
}

async function cycleGlyph(gen: number) {
  glyphCycling.value = false
  core.value = GLYPHS[glyphIdx]
  await nextTick()
  if (gen !== glyphGen || displayState.value !== 'working') return
  void starEl.value?.offsetWidth
  glyphCycling.value = true
}

function startGlyphs() {
  glyphGen++
  const gen = glyphGen
  glyphIdx = 0
  void cycleGlyph(gen)
  glyphTimer = window.setInterval(() => {
    glyphIdx = (glyphIdx + 1) % GLYPHS.length
    void cycleGlyph(gen)
  }, GLYPH_MS)
}

function clearTimers() {
  clearTimeout(exitTimer)
  clearTimeout(enterTimer)
  exitTimer = undefined
  enterTimer = undefined
  coreTransition.value = undefined
}

function setStateDirect(state: AmbientStatus) {
  stopGlyphs()
  clearTimers()
  doneReplay.value = false
  displayState.value = state

  if (state === 'working') {
    startGlyphs()
  } else if (state === 'waiting') {
    core.value = '?'
  } else if (state === 'done') {
    core.value = '✓'
    void nextTick().then(() => {
      doneReplay.value = true
    })
  } else {
    core.value = ''
  }
}

function animateTransition(to: AmbientStatus) {
  stopGlyphs()
  clearTimers()
  doneReplay.value = false
  coreTransition.value = 'exit'

  exitTimer = window.setTimeout(() => {
    setStateDirect(to)
    coreTransition.value = 'enter'
    enterTimer = window.setTimeout(() => {
      coreTransition.value = undefined
    }, ENTER_MS)
  }, EXIT_MS)
}

watch(() => props.state, (next, prev) => {
  if (next === prev) return
  if (coreTransition.value) {
    setStateDirect(next)
    return
  }
  if (!prev || prev === 'idle') {
    setStateDirect(next)
  } else {
    animateTransition(next)
  }
})

onMounted(() => {
  if (props.state !== 'idle') setStateDirect(props.state)
})

onUnmounted(() => {
  stopGlyphs()
  clearTimers()
})
</script>

<template>
  <div
    ref="starEl"
    class="agent-star"
    :class="{ 'done-replay': doneReplay }"
    :data-source="source"
    :data-state="displayState"
  >
    <div class="star-glow" />
    <span
      class="star-core"
      :class="[coreTransition, { 'glyph-cycle': glyphCycling }]"
    >{{ core }}</span>
    <div class="star-ripple" />
  </div>
</template>

<style scoped>
.agent-star {
  --identity-core: rgba(170, 206, 254, 0.98);
  --identity-core-glow: rgba(96, 160, 248, 0.88);
  --identity-halo-inner: rgba(158, 198, 253, 0.94);
  --identity-halo-outer: rgba(96, 160, 248, 0.52);
  --waiting-ring: rgba(239, 68, 68, 0.9);
  --waiting-halo-inner: rgba(248, 92, 92, 0.8);

  position: relative;
  flex: 0 0 auto;
  width: 22px;
  height: 22px;
}

.agent-star[data-source='claude'] {
  --identity-core: rgba(235, 165, 140, 0.98);
  --identity-core-glow: rgba(210, 130, 100, 0.9);
  --identity-halo-inner: rgba(230, 158, 132, 0.93);
  --identity-halo-outer: rgba(210, 130, 100, 0.52);
}

/* ── glow ──────────────────────────────────────────────────────────────── */

.star-glow {
  position: absolute;
  bottom: -3px;
  left: 50%;
  width: 26px;
  height: 14px;
  border-radius: 50%;
  filter: blur(4px);
  opacity: 0;
  transform: translateX(-50%);
  transition:
    opacity 300ms ease,
    background 300ms ease;
}

.agent-star[data-state='working'] .star-glow {
  opacity: 0.5;
  background: radial-gradient(
    ellipse at center,
    var(--identity-halo-inner) 0%,
    var(--identity-halo-outer) 40%,
    transparent 72%
  );
  animation: star-glow-pulse 2.4s ease-in-out infinite;
}

.agent-star[data-state='waiting'] .star-glow {
  opacity: 0.45;
  background: radial-gradient(
    ellipse at center,
    var(--waiting-halo-inner) 0%,
    rgba(198, 24, 24, 0.4) 40%,
    transparent 72%
  );
}

.agent-star[data-state='done'] .star-glow {
  opacity: 0;
}

.agent-star[data-state='done'].done-replay .star-glow {
  animation: star-done-glow 1.6s ease-out both;
}

/* ── core glyph ────────────────────────────────────────────────────────── */

.star-core {
  position: relative;
  display: block;
  width: 22px;
  color: transparent;
  font-family: 'Segoe UI Symbol', 'Noto Sans Symbols 2', sans-serif;
  font-size: 15px;
  font-weight: 600;
  line-height: 22px;
  text-align: center;
  text-shadow: none;
  transition:
    color 240ms ease,
    text-shadow 240ms ease;
}

.agent-star[data-state='working'] .star-core {
  color: var(--identity-core);
  text-shadow: 0 0 8px var(--identity-core-glow);
}

.agent-star[data-state='working'] .star-core.glyph-cycle {
  animation: star-glyph-cycle 700ms ease-in-out both;
}

.agent-star[data-state='waiting'] .star-core {
  color: var(--identity-core);
  text-shadow:
    0 0 4px var(--identity-core-glow),
    0 0 11px var(--waiting-ring);
  animation: none;
}

.agent-star[data-state='done'] .star-core {
  color: rgba(203, 255, 216, 1);
  text-shadow: 0 0 8px rgba(103, 232, 147, 0.82);
}

.agent-star[data-state='done'].done-replay .star-core {
  animation: star-core-enter 260ms cubic-bezier(0.16, 0.82, 0.32, 1) both;
}

/* ── transition classes ────────────────────────────────────────────────── */

.star-core.exit {
  animation: star-core-exit 220ms ease-in both;
}

.star-core.enter {
  animation: star-core-enter 300ms cubic-bezier(0.16, 0.82, 0.32, 1) both;
}

/* ── ripple (done only) ────────────────────────────────────────────────── */

.star-ripple {
  position: absolute;
  right: -4px;
  bottom: 1px;
  left: -4px;
  height: 1px;
  border-radius: 999px;
  background: linear-gradient(90deg, transparent, rgba(173, 255, 198, 0.9), transparent);
  opacity: 0;
  transform: scaleX(0.05);
  transform-origin: center;
}

.agent-star[data-state='done'].done-replay .star-ripple {
  animation: star-ripple-out 800ms cubic-bezier(0.16, 0.76, 0.25, 1) both;
}

/* ── keyframes ─────────────────────────────────────────────────────────── */

@keyframes star-glyph-cycle {
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

@keyframes star-glow-pulse {
  0%,
  100% {
    opacity: 0.35;
  }
  50% {
    opacity: 0.58;
  }
}

@keyframes star-core-exit {
  from {
    opacity: 1;
    transform: scale(1) rotate(0);
  }
  to {
    opacity: 0;
    transform: scale(0.52) rotate(-20deg);
  }
}

@keyframes star-core-enter {
  from {
    opacity: 0;
    transform: scale(0.52);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes star-ripple-out {
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

@keyframes star-done-glow {
  0% {
    opacity: 0;
  }
  12% {
    opacity: 0.4;
  }
  70% {
    opacity: 0.22;
  }
  100% {
    opacity: 0;
  }
}
</style>
