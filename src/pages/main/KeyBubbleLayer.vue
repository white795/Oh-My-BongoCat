<script setup lang="ts">
import type { KeyBubble } from '@/utils/keyBubble'

import { MIKUCAT_KEY_BUBBLE } from '@/utils/keyBubble'

defineProps<{
  bubble?: KeyBubble
  mirrored: boolean
}>()
</script>

<template>
  <svg
    aria-hidden="true"
    class="key-bubble-layer"
    :viewBox="`0 0 ${MIKUCAT_KEY_BUBBLE.width} ${MIKUCAT_KEY_BUBBLE.height}`"
  >
    <g
      v-if="bubble"
      :key="bubble.id"
      :style="{
        '--bubble-pop-duration': `${MIKUCAT_KEY_BUBBLE.popMs}ms`,
        '--bubble-fade-duration': `${MIKUCAT_KEY_BUBBLE.fadeOutMs}ms`,
        '--bubble-drift-duration': `${MIKUCAT_KEY_BUBBLE.driftMs}ms`,
        '--bubble-drift-x': `${(bubble.offsetX < 0 ? -1 : 1) * MIKUCAT_KEY_BUBBLE.driftX}px`,
        '--bubble-drift-y': `${MIKUCAT_KEY_BUBBLE.driftY}px`,
        '--bubble-exit-x': `${(bubble.offsetX < 0 ? -1 : 1) * MIKUCAT_KEY_BUBBLE.exitX}px`,
        '--bubble-exit-y': `${MIKUCAT_KEY_BUBBLE.exitY}px`,
        '--bubble-initial-scale': MIKUCAT_KEY_BUBBLE.initialScale,
        '--bubble-initial-scale-y': MIKUCAT_KEY_BUBBLE.initialScaleY,
        '--bubble-entry-opacity': MIKUCAT_KEY_BUBBLE.entryOpacity,
        '--bubble-visible-opacity': MIKUCAT_KEY_BUBBLE.visibleOpacity,
        '--bubble-settled-opacity': MIKUCAT_KEY_BUBBLE.settledOpacity,
      }"
      :transform="`translate(${bubble.offsetX} ${bubble.offsetY})`"
    >
      <g class="key-bubble-rise">
        <g class="key-bubble-drift">
          <g
            class="key-bubble"
            :class="{ 'key-bubble-leaving': bubble.phase === 'leaving' }"
          >
            <g
              class="key-bubble-pop"
              :style="{
                transformOrigin: `${mirrored ? MIKUCAT_KEY_BUBBLE.centerX * 2 - MIKUCAT_KEY_BUBBLE.tailX : MIKUCAT_KEY_BUBBLE.tailX}px ${MIKUCAT_KEY_BUBBLE.tailY}px`,
              }"
            >
              <image
                :height="MIKUCAT_KEY_BUBBLE.height"
                :href="bubble.src"
                :transform="mirrored ? `translate(${MIKUCAT_KEY_BUBBLE.centerX * 2} 0) scale(-1 1)` : undefined"
                :width="MIKUCAT_KEY_BUBBLE.width"
              />
            </g>
          </g>
        </g>
      </g>
    </g>
  </svg>
</template>

<style scoped>
.key-bubble-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.key-bubble {
  transform: translate(0, 0);
  opacity: 1;
  transition:
    opacity var(--bubble-fade-duration) ease-out,
    transform var(--bubble-fade-duration) ease-out;
}

.key-bubble-leaving {
  transform: translate(var(--bubble-exit-x), var(--bubble-exit-y));
  opacity: 0;
}

.key-bubble-pop {
  transform-box: view-box;
  animation: key-bubble-pop var(--bubble-pop-duration) ease-out both;
}

.key-bubble-rise {
  animation: key-bubble-rise var(--bubble-drift-duration) cubic-bezier(0.2, 0.65, 0.4, 1) both;
}

.key-bubble-drift {
  /* Different axis timings form one continuous arc, without looping or restarting on input. */
  animation: key-bubble-drift var(--bubble-drift-duration) cubic-bezier(0.4, 0, 0.35, 1) both;
}

@keyframes key-bubble-pop {
  0% {
    transform: rotate(-2deg) scale(var(--bubble-initial-scale), var(--bubble-initial-scale-y));
    opacity: var(--bubble-entry-opacity);
  }

  65% {
    transform: rotate(0.5deg) scale(1.025, 1.015);
  }

  100% {
    transform: rotate(0deg) scale(1, 1);
    opacity: 1;
  }
}

@keyframes key-bubble-rise {
  from {
    transform: translateY(0);
  }

  to {
    transform: translateY(var(--bubble-drift-y));
  }
}

@keyframes key-bubble-drift {
  from {
    transform: translateX(0);
    opacity: var(--bubble-visible-opacity);
  }

  to {
    transform: translateX(var(--bubble-drift-x));
    opacity: var(--bubble-settled-opacity);
  }
}
</style>
