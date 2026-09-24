<script setup lang="ts">
import type { GuitarNote } from '@/utils/guitarEffectEngine'

defineProps<{
  notes: readonly GuitarNote[]
  mirrored: boolean
}>()

function noteStyle(note: GuitarNote) {
  return {
    '--note-color': note.color,
    '--note-accent-color': note.accentColor,
    '--note-offset-x': `${note.offsetX}px`,
    '--note-mid-drift-x': `${note.midDriftX}px`,
    '--note-mid-drift-y': `${note.midDriftY}px`,
    '--note-drift-x': `${note.driftX}px`,
    '--note-drift-y': `${note.driftY}px`,
    '--note-rotation': `${note.rotation}deg`,
    '--note-scale': String(note.scale),
    '--note-duration': `${note.durationMs}ms`,
  }
}
</script>

<template>
  <div
    aria-hidden="true"
    class="guitar-note-layer"
    :class="{ mirrored }"
  >
    <span
      v-for="note in notes"
      :key="note.id"
      class="guitar-note"
      :data-variant="note.variant"
      :style="noteStyle(note)"
    >
      <svg
        v-if="note.variant === 'single'"
        class="note-symbol"
        viewBox="0 0 64 72"
      >
        <ellipse
          cx="19"
          cy="57"
          rx="12"
          ry="8"
          transform="rotate(-16 19 57)"
        />
        <rect
          height="41"
          rx="3"
          width="6"
          x="27"
          y="15"
        />
        <path
          class="note-accent"
          d="M30 15C42 13 51 7 55 12C58 20 50 29 39 30C46 25 49 20 48 16L30 22Z"
        />
      </svg>

      <svg
        v-else-if="note.variant === 'double'"
        class="note-symbol"
        viewBox="0 0 72 72"
      >
        <ellipse
          cx="18"
          cy="57"
          rx="11"
          ry="7.5"
          transform="rotate(-14 18 57)"
        />
        <ellipse
          cx="50"
          cy="50"
          rx="11"
          ry="7.5"
          transform="rotate(-14 50 50)"
        />
        <path
          class="note-accent"
          d="M26 17V56H32V29L58 23V49H64V10L26 18ZM32 23V18L58 12V17Z"
        />
      </svg>

      <svg
        v-else-if="note.variant === 'accent'"
        class="note-symbol"
        viewBox="0 0 72 72"
      >
        <ellipse
          cx="25"
          cy="57"
          rx="12"
          ry="8"
          transform="rotate(-16 25 57)"
        />
        <rect
          height="42"
          rx="3"
          width="6"
          x="33"
          y="14"
        />
        <path d="M36 15C49 13 57 8 61 13C63 21 55 29 45 30C51 25 54 21 53 17L36 22Z" />
        <path
          class="note-accent note-spark"
          d="M16 10L18.6 16.4L25 19L18.6 21.6L16 28L13.4 21.6L7 19L13.4 16.4ZM54 38L55.6 41.4L59 43L55.6 44.6L54 48L52.4 44.6L49 43L52.4 41.4Z"
        />
      </svg>

      <svg
        v-else-if="note.variant === 'whole'"
        class="note-symbol"
        viewBox="0 0 64 72"
      >
        <ellipse
          class="note-open-head"
          cx="32"
          cy="39"
          rx="20"
          ry="12"
          transform="rotate(-12 32 39)"
        />
        <path
          class="note-accent-stroke"
          d="M18 43C25 48 39 48 47 39"
        />
      </svg>

      <svg
        v-else-if="note.variant === 'half'"
        class="note-symbol"
        viewBox="0 0 64 72"
      >
        <ellipse
          class="note-open-head"
          cx="22"
          cy="57"
          rx="13"
          ry="8"
          transform="rotate(-15 22 57)"
        />
        <rect
          class="note-accent"
          height="43"
          rx="3"
          width="6"
          x="31"
          y="14"
        />
      </svg>

      <svg
        v-else-if="note.variant === 'quarter'"
        class="note-symbol"
        viewBox="0 0 64 72"
      >
        <ellipse
          cx="22"
          cy="57"
          rx="13"
          ry="8"
          transform="rotate(-15 22 57)"
        />
        <rect
          class="note-accent"
          height="43"
          rx="3"
          width="6"
          x="31"
          y="14"
        />
      </svg>

      <svg
        v-else-if="note.variant === 'chord'"
        class="note-symbol"
        viewBox="0 0 72 76"
      >
        <ellipse
          cx="25"
          cy="60"
          rx="12"
          ry="7.5"
          transform="rotate(-14 25 60)"
        />
        <ellipse
          class="note-accent"
          cx="39"
          cy="47"
          rx="12"
          ry="7.5"
          transform="rotate(-14 39 47)"
        />
        <ellipse
          cx="26"
          cy="34"
          rx="12"
          ry="7.5"
          transform="rotate(-14 26 34)"
        />
        <path
          class="note-accent"
          d="M47 8H53V48H47ZM31 30H50V36H31ZM30 56H50V62H30Z"
        />
      </svg>

      <svg
        v-else-if="note.variant === 'triplet'"
        class="note-symbol"
        viewBox="0 0 100 76"
      >
        <ellipse
          cx="17"
          cy="61"
          rx="10"
          ry="7"
          transform="rotate(-14 17 61)"
        />
        <ellipse
          class="note-accent"
          cx="48"
          cy="56"
          rx="10"
          ry="7"
          transform="rotate(-14 48 56)"
        />
        <ellipse
          cx="79"
          cy="51"
          rx="10"
          ry="7"
          transform="rotate(-14 79 51)"
        />
        <path d="M24 23H30V60H24ZM55 19H61V55H55ZM86 14H92V50H86Z" />
        <path
          class="note-accent"
          d="M24 22L92 12V20L24 30Z"
        />
        <text
          class="note-mark"
          x="53"
          y="15"
        >3</text>
      </svg>

      <svg
        v-else-if="note.variant === 'sharp'"
        class="note-symbol"
        viewBox="0 0 90 72"
      >
        <path
          class="note-accent-stroke accidental-sharp"
          d="M19 20L16 55M31 18L28 53M11 32L37 26M10 44L36 38"
        />
        <ellipse
          cx="61"
          cy="57"
          rx="11"
          ry="7.5"
          transform="rotate(-14 61 57)"
        />
        <rect
          height="41"
          rx="3"
          width="6"
          x="69"
          y="15"
        />
        <path d="M72 15C80 14 85 10 88 13C89 19 84 25 76 27L72 28Z" />
      </svg>

      <svg
        v-else-if="note.variant === 'flat'"
        class="note-symbol"
        viewBox="0 0 90 72"
      >
        <path
          class="note-accent"
          clip-rule="evenodd"
          d="M16 17H21V34C25 30 33 30 36 35C40 43 33 52 16 58V17ZM21 39V50C29 46 33 42 31 38C30 35 25 36 21 39Z"
          fill-rule="evenodd"
        />
        <ellipse
          cx="61"
          cy="57"
          rx="11"
          ry="7.5"
          transform="rotate(-14 61 57)"
        />
        <rect
          height="41"
          rx="3"
          width="6"
          x="69"
          y="15"
        />
        <path d="M72 15C80 14 85 10 88 13C89 19 84 25 76 27L72 28Z" />
      </svg>

      <svg
        v-else-if="note.variant === 'sixteenth'"
        class="note-symbol"
        viewBox="0 0 116 72"
      >
        <ellipse
          cx="17"
          cy="58"
          rx="10"
          ry="7"
          transform="rotate(-14 17 58)"
        />
        <ellipse
          cx="42"
          cy="55"
          rx="10"
          ry="7"
          transform="rotate(-14 42 55)"
        />
        <ellipse
          cx="67"
          cy="52"
          rx="10"
          ry="7"
          transform="rotate(-14 67 52)"
        />
        <ellipse
          cx="92"
          cy="49"
          rx="10"
          ry="7"
          transform="rotate(-14 92 49)"
        />
        <path d="M24 18H30V57H24ZM49 15H55V54H49ZM74 12H80V51H74ZM99 9H105V48H99Z" />
        <path
          class="note-accent"
          d="M24 18L105 8V15L24 25ZM24 29L105 19V26L24 36Z"
        />
      </svg>

      <svg
        v-else-if="note.variant === 'eighthRest'"
        class="note-symbol"
        viewBox="0 0 64 72"
      >
        <circle
          class="note-accent"
          cx="43"
          cy="14"
          r="7"
        />
        <path d="M39 18C29 18 23 24 25 32C27 40 35 42 42 37L29 67H20L35 31C31 33 28 31 28 28C28 24 33 22 39 24Z" />
      </svg>

      <svg
        v-else
        class="note-symbol"
        viewBox="0 0 64 72"
      >
        <path
          class="note-accent"
          d="M39 5L24 24L37 37L29 46C21 51 21 63 32 68C26 61 29 56 37 54C45 52 46 44 40 39L32 32L45 16Z"
        />
      </svg>
    </span>
  </div>
</template>

<style scoped>
.guitar-note-layer {
  position: absolute;
  inset: 0;
  z-index: 3;
  overflow: hidden;
  pointer-events: none;
}

.guitar-note {
  position: absolute;
  top: 62%;
  left: 54%;
  width: clamp(18px, 7vw, 34px);
  height: auto;
  color: var(--note-color);
  opacity: 0;
  filter: drop-shadow(0 0 3px color-mix(in srgb, currentcolor 84%, transparent))
    drop-shadow(0 0 8px color-mix(in srgb, currentcolor 46%, transparent));
  transform: translate3d(calc(-50% + var(--note-offset-x)), -50%, 0) scale(0.55);
  transform-origin: center;
  animation: guitar-note-drift var(--note-duration) cubic-bezier(0.2, 0.72, 0.24, 1) forwards;
  will-change: transform, opacity;
}

.guitar-note[data-variant='whole'] {
  width: clamp(22px, 8vw, 38px);
}

.guitar-note[data-variant='chord'] {
  width: clamp(23px, 8.5vw, 40px);
}

.guitar-note[data-variant='triplet'] {
  width: clamp(38px, 12vw, 58px);
}

.guitar-note[data-variant='sixteenth'] {
  width: clamp(40px, 13vw, 62px);
}

.guitar-note:is([data-variant='sharp'], [data-variant='flat']) {
  width: clamp(27px, 9vw, 44px);
}

.guitar-note:is([data-variant='rest'], [data-variant='eighthRest']) {
  width: clamp(16px, 6vw, 30px);
}

.note-symbol {
  display: block;
  width: 100%;
  overflow: visible;
  fill: currentcolor;
}

.note-accent {
  fill: var(--note-accent-color);
}

.note-open-head {
  fill: color-mix(in srgb, currentcolor 8%, transparent);
  stroke: currentcolor;
  stroke-width: 6;
}

.note-accent-stroke {
  fill: none;
  stroke: var(--note-accent-color);
  stroke-linecap: round;
  stroke-width: 4;
}

.accidental-sharp {
  stroke-width: 5;
}

.note-mark {
  fill: var(--note-accent-color);
  font-family: system-ui, sans-serif;
  font-size: 20px;
  font-weight: 800;
  text-anchor: middle;
}

.mirrored .note-symbol {
  transform: scaleX(-1);
}

.note-spark {
  opacity: 0.9;
}

@keyframes guitar-note-drift {
  0% {
    opacity: 0;
    transform: translate3d(calc(-50% + var(--note-offset-x)), -50%, 0) rotate(0deg) scale(0.55);
  }

  14% {
    opacity: 0.94;
  }

  52% {
    opacity: 0.86;
    transform: translate3d(
        calc(-50% + var(--note-offset-x) + var(--note-mid-drift-x)),
        calc(-50% + var(--note-mid-drift-y)),
        0
      )
      scale(0.82);
  }

  76% {
    opacity: 0.66;
  }

  100% {
    opacity: 0;
    transform: translate3d(calc(-50% + var(--note-offset-x) + var(--note-drift-x)), calc(-50% + var(--note-drift-y)), 0)
      rotate(var(--note-rotation)) scale(var(--note-scale));
  }
}

@media (prefers-reduced-motion: reduce) {
  .guitar-note {
    animation-timing-function: ease-out;
  }

  @keyframes guitar-note-drift {
    0% {
      opacity: 0;
      transform: translate3d(calc(-50% + var(--note-offset-x)), -50%, 0) scale(0.7);
    }

    20% {
      opacity: 0.9;
    }

    100% {
      opacity: 0;
      transform: translate3d(calc(-50% + var(--note-offset-x) + 30px), calc(-50% + 8px), 0) scale(0.9);
    }
  }
}
</style>
