<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { useTours } from '@/composables/useTours'

/**
 * Visite guidée : met en valeur l'élément de l'étape courante et affiche une bulle d'explication.
 * À monter une seule fois (dans le gabarit) ; l'état vient de `useTours()`.
 */
const tours = useTours()
const { current, currentStep, step, isLast } = tours

const MARGIN = 12
const BUBBLE_WIDTH = 340
const PAD = 6

interface Box { top: number; left: number; width: number; height: number }

const box = ref<Box | null>(null)
const bubbleEl = ref<HTMLElement | null>(null)
const bubbleHeight = ref(220)
const viewport = reactive({ width: window.innerWidth, height: window.innerHeight })

let target: Element | null = null
let token = 0

function isUsable(rect: DOMRect): boolean {
  return rect.width > 0 && rect.height > 0 && rect.right > 0 && rect.left < window.innerWidth
}

function measure(): void {
  viewport.width = window.innerWidth
  viewport.height = window.innerHeight

  if (!target?.isConnected) {
    box.value = null

    return
  }

  const rect = target.getBoundingClientRect()

  if (!isUsable(rect)) {
    box.value = null

    return
  }

  // Une cible plus grande que l'écran est mise en valeur sur sa partie visible seulement.
  const top = Math.max(rect.top - PAD, MARGIN)
  const left = Math.max(rect.left - PAD, MARGIN)
  const bottom = Math.min(rect.bottom + PAD, window.innerHeight - MARGIN)
  const right = Math.min(rect.right + PAD, window.innerWidth - MARGIN)

  box.value = bottom > top && right > left ? { top, left, width: right - left, height: bottom - top } : null
}

/** Cherche l'élément cible, en attendant jusqu'à 2 s qu'une nouvelle page l'affiche. */
async function locate(): Promise<void> {
  const mine = ++token

  target = null
  box.value = null

  const selector = currentStep.value?.target

  if (selector) {
    for (let attempt = 0; attempt < 20; attempt++) {
      if (mine !== token)
        break

      const found = Array.from(document.querySelectorAll(selector)).find(element => isUsable(element.getBoundingClientRect()))

      if (found) {
        target = found
        found.scrollIntoView({ block: found.getBoundingClientRect().height > window.innerHeight * 0.6 ? 'start' : 'center', behavior: 'instant' as ScrollBehavior })

        break
      }

      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  if (mine !== token)
    return

  await nextTick()
  measure()
  bubbleHeight.value = bubbleEl.value?.offsetHeight ?? bubbleHeight.value
  bubbleEl.value?.querySelector<HTMLElement>('[data-tour-next]')?.focus({ preventScroll: true })
}

watch([() => tours.currentTour.value, step], () => {
  if (currentStep.value)
    locate().catch(() => {})
  else
    token++
}, { immediate: true, flush: 'post' })

useEventListener(window, 'resize', measure)
useEventListener(window, 'scroll', measure, { capture: true, passive: true })

useEventListener(window, 'keydown', (event: KeyboardEvent) => {
  if (event.key === 'Escape' && current.value) {
    event.stopPropagation()
    tours.close()
  }
}, { capture: true })

const bubbleStyle = computed(() => {
  const width = Math.min(BUBBLE_WIDTH, viewport.width - MARGIN * 2)
  const height = bubbleHeight.value
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, Math.max(min, max)))

  if (!box.value)
    return { width: `${width}px`, top: `${(viewport.height - height) / 2}px`, left: `${(viewport.width - width) / 2}px` }

  const area = box.value

  const space = {
    top: area.top,
    bottom: viewport.height - (area.top + area.height),
    left: area.left,
    right: viewport.width - (area.left + area.width),
  }

  const fits = (side: keyof typeof space) =>
    side === 'top' || side === 'bottom' ? space[side] >= height + MARGIN * 2 : space[side] >= width + MARGIN * 2

  const preferred = currentStep.value?.position
  const side = preferred && fits(preferred) ? preferred : (['bottom', 'top', 'right', 'left'] as const).find(fits)

  // Aucune place autour (cible plus grande que l'écran) : la bulle se pose en bas à droite de l'écran.
  if (!side) {
    return {
      width: `${width}px`,
      top: `${Math.max(MARGIN, viewport.height - height - MARGIN * 2)}px`,
      left: `${Math.max(MARGIN, viewport.width - width - MARGIN * 2)}px`,
    }
  }

  let top: number
  let left: number

  if (side === 'top' || side === 'bottom') {
    left = area.left + area.width / 2 - width / 2
    top = side === 'bottom' ? area.top + area.height + MARGIN : area.top - height - MARGIN
  }
  else {
    top = area.top + area.height / 2 - height / 2
    left = side === 'right' ? area.left + area.width + MARGIN : area.left - width - MARGIN
  }

  return {
    width: `${width}px`,
    top: `${clamp(top, MARGIN, viewport.height - height - MARGIN)}px`,
    left: `${clamp(left, MARGIN, viewport.width - width - MARGIN)}px`,
  }
})

const spotlightStyle = computed(() => box.value
  ? { top: `${box.value.top}px`, left: `${box.value.left}px`, width: `${box.value.width}px`, height: `${box.value.height}px` }
  : undefined)
</script>

<template>
  <Teleport to="body">
    <div
      v-if="current && currentStep"
      class="tour-overlay"
    >
      <!-- Bloque les clics pendant la visite ; sans cible, il assombrit aussi l'écran. -->
      <div
        class="tour-blocker"
        :class="{ 'tour-blocker--dim': !box }"
      />

      <div
        v-if="box"
        class="tour-spotlight"
        :style="spotlightStyle"
      />

      <section
        ref="bubbleEl"
        class="tour-bubble elevation-8"
        :style="bubbleStyle"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-live="polite"
      >
        <div class="d-flex align-start justify-space-between gap-2">
          <div>
            <div class="text-caption text-medium-emphasis">
              {{ current.title }} · étape {{ step + 1 }} sur {{ current.steps.length }}
            </div>
            <h2
              id="tour-title"
              class="text-h6 mt-1"
            >
              {{ currentStep.title }}
            </h2>
          </div>

          <IconBtn
            size="small"
            aria-label="Quitter la visite"
            @click="tours.close()"
          >
            <VIcon icon="ri-close-line" />
          </IconBtn>
        </div>

        <p class="text-body-2 mt-2 mb-4">
          {{ currentStep.text }}
        </p>

        <div class="d-flex align-center gap-2">
          <VBtn
            variant="text"
            size="small"
            color="secondary"
            @click="tours.skip()"
          >
            Passer
          </VBtn>

          <VSpacer />

          <VBtn
            v-if="step > 0"
            variant="tonal"
            size="small"
            color="secondary"
            @click="tours.previous()"
          >
            Précédent
          </VBtn>

          <VBtn
            size="small"
            data-tour-next
            @click="tours.next()"
          >
            {{ isLast ? 'Terminer' : 'Suivant' }}
          </VBtn>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style lang="scss" scoped>
.tour-overlay {
  position: fixed;
  inset: 0;
  z-index: 2400;
  pointer-events: none;
}

.tour-blocker {
  position: absolute;
  inset: 0;
  pointer-events: auto;

  &--dim {
    background: rgba(0, 0, 0, 55%);
  }
}

.tour-spotlight {
  position: absolute;
  border: 2px solid rgb(var(--v-theme-primary));
  border-radius: 8px;
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 55%);
  transition: top 0.2s ease, left 0.2s ease, width 0.2s ease, height 0.2s ease;
  pointer-events: none;
}

.tour-bubble {
  position: absolute;
  padding: 1rem 1.25rem;
  border-radius: 12px;
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
  pointer-events: auto;
  transition: top 0.2s ease, left 0.2s ease;
}

@media (prefers-reduced-motion: reduce) {
  .tour-spotlight,
  .tour-bubble {
    transition: none;
  }
}
</style>
