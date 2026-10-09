<script setup lang="ts">
import type { AngryEffectInstance } from '@/utils/angryEffectEngine'

defineProps<{
  effects: readonly AngryEffectInstance[]
  mirrored: boolean
}>()

function effectStyle(effect: AngryEffectInstance) {
  return {
    '--angry-color': effect.color,
    '--angry-accent-color': effect.accentColor,
    '--angry-anchor-x': `${effect.anchorX}%`,
    '--angry-anchor-y': `${effect.anchorY}%`,
    '--angry-mid-drift-x': `${effect.midDriftX}px`,
    '--angry-mid-drift-y': `${effect.midDriftY}px`,
    '--angry-drift-x': `${effect.driftX}px`,
    '--angry-drift-y': `${effect.driftY}px`,
    '--angry-rotation': `${effect.rotation}deg`,
    '--angry-scale': String(effect.scale),
    '--angry-delay': `${effect.delayMs}ms`,
    '--angry-duration': `${effect.durationMs}ms`,
  }
}
</script>

<template>
  <div
    aria-hidden="true"
    class="angry-effect-layer"
    :class="{ mirrored }"
  >
    <span
      v-for="effect in effects"
      :key="effect.id"
      class="angry-effect"
      :data-anchor-region="effect.anchorRegion"
      :data-intensity="effect.intensity"
      :data-shape="effect.shape"
      :data-side="effect.side"
      :data-variant="effect.variant"
      :style="effectStyle(effect)"
    >
      <svg
        v-if="effect.variant === 'stress-arc'"
        class="effect-symbol stress-arc-symbol"
        viewBox="0 0 72 64"
      >
        <g v-if="effect.shape === 0">
          <path
            class="stress-line"
            d="M12 52C15 32 28 16 51 9"
          />
          <path
            class="stress-line stress-line-late"
            d="M27 56C29 42 39 30 57 24"
          />
          <path
            class="stress-glint"
            d="M54 10L61 6"
          />
        </g>
        <g v-else-if="effect.shape === 1">
          <path
            class="stress-line"
            d="M10 46C17 27 33 14 57 12"
          />
          <path
            class="stress-line stress-line-late"
            d="M16 57C26 40 40 31 61 31"
          />
          <path
            class="stress-line stress-line-last"
            d="M34 58C41 48 50 43 63 44"
          />
        </g>
        <g v-else>
          <path
            class="stress-line"
            d="M8 50C18 27 35 12 61 9"
          />
          <path
            class="stress-line stress-line-late"
            d="M16 60C28 38 45 26 66 27"
          />
          <path
            class="stress-glint"
            d="M52 14L64 8M57 27L68 26"
          />
        </g>
      </svg>

      <svg
        v-else-if="effect.variant === 'anger-knot'"
        class="effect-symbol anger-knot-symbol"
        viewBox="0 0 72 72"
      >
        <path
          class="knot-arc"
          d="M31 27C20 27 12 20 12 9"
        />
        <path
          class="knot-arc knot-arc-late"
          d="M41 27C52 27 60 20 60 9"
        />
        <path
          class="knot-arc knot-arc-later"
          d="M31 45C20 45 12 52 12 63"
        />
        <path
          class="knot-arc knot-arc-last"
          d="M41 45C52 45 60 52 60 63"
        />
      </svg>

      <svg
        v-else-if="effect.variant === 'cross-pop'"
        class="effect-symbol cross-pop-symbol"
        viewBox="0 0 64 64"
      >
        <g v-if="effect.shape === 0">
          <path d="M13 13C23 22 40 41 51 52" />
          <path
            class="cross-accent"
            d="M51 12C40 23 24 41 13 52"
          />
        </g>
        <g v-else-if="effect.shape === 1">
          <path d="M10 19C23 27 39 39 54 47" />
          <path
            class="cross-accent"
            d="M52 17C41 27 25 40 12 49"
          />
        </g>
        <g v-else>
          <path d="M18 8C24 23 39 43 47 56" />
          <path
            class="cross-accent"
            d="M48 9C39 23 26 43 17 55"
          />
        </g>
      </svg>

      <svg
        v-else-if="effect.variant === 'steam-puff'"
        class="effect-symbol steam-symbol"
        viewBox="0 0 72 64"
      >
        <g v-if="effect.shape === 0">
          <path
            class="steam-cloud"
            d="M12 52C4 49 3 41 8 36C12 31 18 31 23 34C21 26 28 20 35 21C42 21 46 26 46 32C52 28 61 30 64 37C67 44 62 52 54 54C43 57 22 56 12 52Z"
          />
          <path
            class="steam-wisp"
            d="M23 33C19 27 22 21 28 17M39 22C36 16 39 11 45 8"
          />
        </g>
        <g v-else-if="effect.shape === 1">
          <path
            class="steam-secondary"
            d="M8 47C2 41 7 33 15 34C14 27 22 23 28 27C30 19 42 18 47 25C55 21 66 28 64 37C71 42 66 52 57 52C45 57 19 55 8 47Z"
          />
          <path
            class="steam-cloud"
            d="M18 49C12 45 15 38 22 38C20 31 29 27 35 31C39 24 50 27 51 35C59 34 63 43 57 48C51 54 27 55 18 49Z"
          />
          <path
            class="steam-wisp"
            d="M20 34C16 28 20 21 27 19M39 29C34 23 38 15 46 12M55 33C51 28 54 23 60 21"
          />
        </g>
        <g v-else>
          <path
            class="steam-secondary"
            d="M7 48C1 42 5 33 14 33C13 25 23 20 30 25C34 16 47 17 50 27C61 23 70 33 65 43C61 54 17 59 7 48Z"
          />
          <path
            class="steam-cloud"
            d="M17 50C10 44 15 36 23 38C21 31 31 27 36 32C42 25 55 31 52 40C61 40 62 49 55 52C45 57 25 56 17 50Z"
          />
          <path
            class="steam-wisp"
            d="M18 35C12 29 18 20 27 19M36 30C30 23 35 13 44 11M54 34C49 28 53 20 61 19"
          />
        </g>
      </svg>

      <svg
        v-else
        class="effect-symbol spark-symbol"
        viewBox="0 0 64 64"
      >
        <g v-if="effect.shape === 0">
          <path d="M31 4L37 23L57 17L43 32L59 44L39 41L35 60L28 42L9 49L21 33L5 22L25 24Z" />
          <path
            class="spark-core"
            d="M31 18L35 28L46 26L38 34L44 42L34 39L31 49L28 39L18 43L24 34L18 27L28 29Z"
          />
        </g>
        <g v-else-if="effect.shape === 1">
          <path d="M18 4L23 19L38 24L23 29L18 44L13 29L0 24L13 19ZM48 22L52 33L63 37L52 41L48 53L44 41L33 37L44 33Z" />
          <circle
            class="spark-core"
            cx="18"
            cy="24"
            r="5"
          />
          <circle
            class="spark-core"
            cx="48"
            cy="37"
            r="4"
          />
        </g>
        <g v-else>
          <path d="M28 4C39 15 25 20 38 30C50 40 41 57 27 60C35 49 20 47 24 37C27 29 18 25 16 17C24 20 29 14 28 4Z" />
          <path
            class="spark-core"
            d="M29 25C37 33 27 37 34 43C37 47 34 53 29 55C31 48 24 46 27 40C30 35 25 32 24 28C27 30 29 28 29 25Z"
          />
        </g>
      </svg>
    </span>
  </div>
</template>

<style scoped>
.angry-effect-layer {
  position: absolute;
  inset: 0;
  z-index: 4;
  overflow: hidden;
  pointer-events: none;
}

.angry-effect {
  position: absolute;
  top: var(--angry-anchor-y);
  left: var(--angry-anchor-x);
  color: var(--angry-color);
  opacity: 0;
  filter: drop-shadow(0 0 3px color-mix(in srgb, currentcolor 82%, transparent))
    drop-shadow(0 0 8px color-mix(in srgb, var(--angry-accent-color) 44%, transparent));
  transform: translate3d(-50%, -50%, 0) scale(0.45);
  transform-origin: center;
  animation-delay: var(--angry-delay);
  animation-duration: var(--angry-duration);
  animation-fill-mode: forwards;
  will-change: transform, opacity;
}

.angry-effect[data-variant='stress-arc'] {
  width: clamp(22px, 8vw, 42px);
  animation-name: angry-stress-sweep;
  animation-timing-function: cubic-bezier(0.22, 0.76, 0.24, 1);
}

.angry-effect[data-variant='anger-knot'] {
  width: clamp(21px, 7.5vw, 38px);
  animation-name: angry-knot-bloom;
  animation-timing-function: cubic-bezier(0.18, 0.82, 0.24, 1);
}

.angry-effect[data-variant='cross-pop'] {
  width: clamp(12px, 4.5vw, 23px);
  animation-name: angry-cross-pop;
  animation-timing-function: cubic-bezier(0.18, 0.88, 0.28, 1);
}

.angry-effect[data-variant='steam-puff'] {
  width: clamp(27px, 10vw, 50px);
  animation-name: angry-steam-drift;
  animation-timing-function: cubic-bezier(0.16, 0.7, 0.24, 1);
}

.angry-effect[data-variant='heat-spark'] {
  width: clamp(14px, 5.5vw, 28px);
  animation-name: angry-heat-spark;
  animation-timing-function: cubic-bezier(0.18, 0.78, 0.28, 1);
}

.effect-symbol {
  display: block;
  width: 100%;
  overflow: visible;
}

.stress-arc-symbol {
  fill: none;
  stroke: currentcolor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 5.5;
}

.stress-line {
  stroke-dasharray: 82;
  stroke-dashoffset: 82;
  animation: angry-stress-draw var(--angry-duration) cubic-bezier(0.18, 0.7, 0.3, 1) var(--angry-delay) forwards;
}

.stress-line-late {
  animation-delay: calc(var(--angry-delay) + 70ms);
  stroke-width: 4.5;
}

.stress-line-last {
  animation-delay: calc(var(--angry-delay) + 130ms);
  stroke-width: 3.5;
}

.stress-glint {
  fill: none;
  stroke: var(--angry-accent-color);
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 3.5;
}

.anger-knot-symbol {
  fill: none;
  stroke: currentcolor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 9;
}

.knot-arc {
  stroke-dasharray: 42;
  stroke-dashoffset: 42;
  animation: angry-knot-draw var(--angry-duration) cubic-bezier(0.16, 0.74, 0.3, 1) var(--angry-delay) forwards;
}

.knot-arc-late {
  animation-delay: calc(var(--angry-delay) + 45ms);
}

.knot-arc-later {
  animation-delay: calc(var(--angry-delay) + 90ms);
}

.knot-arc-last {
  animation-delay: calc(var(--angry-delay) + 135ms);
}

.cross-pop-symbol {
  fill: none;
  stroke: currentcolor;
  stroke-linecap: round;
  stroke-width: 7;
}

.cross-accent {
  stroke: var(--angry-accent-color);
  stroke-width: 5.5;
}

.steam-cloud {
  fill: color-mix(in srgb, var(--angry-accent-color) 70%, white 30%);
  stroke: color-mix(in srgb, currentcolor 64%, white 36%);
  stroke-linejoin: round;
  stroke-width: 2.5;
}

.steam-secondary {
  fill: color-mix(in srgb, var(--angry-accent-color) 32%, transparent);
  stroke: color-mix(in srgb, currentcolor 38%, transparent);
  stroke-width: 2;
}

.steam-wisp {
  fill: none;
  stroke: color-mix(in srgb, var(--angry-accent-color) 84%, white 16%);
  stroke-linecap: round;
  stroke-width: 3.5;
}

.angry-effect[data-shape='1'] .steam-cloud {
  opacity: 0.88;
}

.angry-effect[data-shape='2'] .steam-secondary {
  opacity: 0.72;
}

.spark-symbol {
  fill: currentcolor;
}

.spark-core {
  fill: var(--angry-accent-color);
}

.mirrored .effect-symbol {
  transform: scaleX(-1);
}

@keyframes angry-stress-sweep {
  0% {
    opacity: 0;
    transform: translate3d(-50%, -50%, 0) rotate(calc(var(--angry-rotation) * -0.45)) scale(0.42);
  }

  22% {
    opacity: 0.88;
    transform: translate3d(-50%, -50%, 0) rotate(calc(var(--angry-rotation) * -0.12))
      scale(calc(var(--angry-scale) * 0.84));
  }

  58% {
    opacity: 0.76;
    transform: translate3d(calc(-50% + var(--angry-mid-drift-x)), calc(-50% + var(--angry-mid-drift-y)), 0)
      rotate(calc(var(--angry-rotation) * 0.62)) scale(var(--angry-scale));
  }

  100% {
    opacity: 0;
    transform: translate3d(calc(-50% + var(--angry-drift-x)), calc(-50% + var(--angry-drift-y)), 0)
      rotate(var(--angry-rotation)) scale(calc(var(--angry-scale) * 1.06));
  }
}

@keyframes angry-stress-draw {
  0% {
    opacity: 0;
    stroke-dashoffset: 82;
  }

  24% {
    opacity: 1;
    stroke-dashoffset: 18;
  }

  62% {
    opacity: 0.88;
    stroke-dashoffset: 0;
  }

  100% {
    opacity: 0;
    stroke-dashoffset: -18;
  }
}

@keyframes angry-knot-bloom {
  0% {
    opacity: 0;
    transform: translate3d(-50%, -50%, 0) rotate(calc(var(--angry-rotation) * -0.7)) scale(0.28);
  }

  24% {
    opacity: 0.96;
    transform: translate3d(-50%, -50%, 0) rotate(calc(var(--angry-rotation) * 0.2))
      scale(calc(var(--angry-scale) * 1.12));
  }

  46% {
    transform: translate3d(calc(-50% + var(--angry-mid-drift-x)), calc(-50% + var(--angry-mid-drift-y)), 0)
      rotate(calc(var(--angry-rotation) * 0.55)) scale(calc(var(--angry-scale) * 0.92));
  }

  72% {
    opacity: 0.86;
    transform: translate3d(calc(-50% + var(--angry-mid-drift-x)), calc(-50% + var(--angry-mid-drift-y)), 0)
      rotate(calc(var(--angry-rotation) * 0.72)) scale(var(--angry-scale));
  }

  100% {
    opacity: 0;
    transform: translate3d(calc(-50% + var(--angry-drift-x)), calc(-50% + var(--angry-drift-y)), 0)
      rotate(var(--angry-rotation)) scale(calc(var(--angry-scale) * 0.84));
  }
}

@keyframes angry-knot-draw {
  0% {
    opacity: 0;
    stroke-dashoffset: 42;
  }

  28% {
    opacity: 1;
    stroke-dashoffset: 10;
  }

  58% {
    opacity: 0.96;
    stroke-dashoffset: 0;
  }

  100% {
    opacity: 0;
    stroke-dashoffset: -9;
  }
}

@keyframes angry-cross-pop {
  0% {
    opacity: 0;
    transform: translate3d(-50%, -50%, 0) rotate(calc(var(--angry-rotation) * -0.75)) scale(0.18);
  }

  24% {
    opacity: 0.94;
    transform: translate3d(-50%, -50%, 0) rotate(calc(var(--angry-rotation) * -0.1))
      scale(calc(var(--angry-scale) * 1.18));
  }

  48% {
    opacity: 0.9;
    transform: translate3d(calc(-50% + var(--angry-mid-drift-x)), calc(-50% + var(--angry-mid-drift-y)), 0)
      rotate(calc(var(--angry-rotation) * 0.5)) scale(calc(var(--angry-scale) * 0.92));
  }

  100% {
    opacity: 0;
    transform: translate3d(calc(-50% + var(--angry-drift-x)), calc(-50% + var(--angry-drift-y)), 0)
      rotate(var(--angry-rotation)) scale(calc(var(--angry-scale) * 0.58));
  }
}

@keyframes angry-steam-drift {
  0% {
    opacity: 0;
    transform: translate3d(-50%, -50%, 0) rotate(calc(var(--angry-rotation) * -0.5)) scale(0.28);
  }

  20% {
    opacity: 0.78;
    transform: translate3d(-50%, -50%, 0) rotate(calc(var(--angry-rotation) * -0.18))
      scale(calc(var(--angry-scale) * 0.68));
  }

  56% {
    opacity: 0.68;
    transform: translate3d(calc(-50% + var(--angry-mid-drift-x)), calc(-50% + var(--angry-mid-drift-y)), 0)
      rotate(calc(var(--angry-rotation) * 0.36)) scale(calc(var(--angry-scale) * 1.02));
  }

  100% {
    opacity: 0;
    transform: translate3d(calc(-50% + var(--angry-drift-x)), calc(-50% + var(--angry-drift-y)), 0)
      rotate(var(--angry-rotation)) scale(calc(var(--angry-scale) * 1.24));
  }
}

@keyframes angry-heat-spark {
  0% {
    opacity: 0;
    transform: translate3d(-50%, -50%, 0) rotate(0deg) scale(0.25);
  }

  20% {
    opacity: 1;
    transform: translate3d(-50%, -50%, 0) rotate(calc(var(--angry-rotation) * -0.4))
      scale(calc(var(--angry-scale) * 1.15));
  }

  48% {
    opacity: 0.92;
    transform: translate3d(calc(-50% + var(--angry-mid-drift-x)), calc(-50% + var(--angry-mid-drift-y)), 0)
      rotate(calc(var(--angry-rotation) * 0.55)) scale(var(--angry-scale));
  }

  100% {
    opacity: 0;
    transform: translate3d(calc(-50% + var(--angry-drift-x)), calc(-50% + var(--angry-drift-y)), 0)
      rotate(calc(var(--angry-rotation) * 1.8)) scale(calc(var(--angry-scale) * 0.55));
  }
}

@media (prefers-reduced-motion: reduce) {
  .angry-effect {
    animation-timing-function: ease-out;
  }

  .angry-effect[data-variant='steam-puff'] {
    --angry-drift-x: 12px;
    --angry-drift-y: -18px;
  }

  .angry-effect[data-variant='heat-spark'] {
    --angry-drift-x: 16px;
    --angry-drift-y: -8px;
  }
}
</style>
