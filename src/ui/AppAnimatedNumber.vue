<!--
  Compte jusqu'à `value` en moins d'une seconde (ease-out) : les chiffres « arrivent » à l'ouverture
  de l'écran et glissent d'une valeur à l'autre à chaque actualisation. Sans animation si
  l'utilisateur a demandé de réduire les mouvements. Le contenu s'écrit via le slot (`current`).
-->
<script setup lang="ts">
import { usePreferredReducedMotion } from '@vueuse/core'

const props = withDefaults(defineProps<{ value: number; duration?: number }>(), { duration: 800 })

const reduced = usePreferredReducedMotion()
const current = ref(0)

let frame = 0

function animateTo(target: number) {
  cancelAnimationFrame(frame)

  if (reduced.value === 'reduce' || current.value === target) {
    current.value = target

    return
  }

  const from = current.value
  const start = performance.now()

  const step = (now: number) => {
    const t = Math.min(1, (now - start) / props.duration)
    const eased = 1 - (1 - t) ** 3

    current.value = from + (target - from) * eased
    if (t < 1)
      frame = requestAnimationFrame(step)
  }

  frame = requestAnimationFrame(step)
}

watch(() => props.value, animateTo, { immediate: true })
onBeforeUnmount(() => cancelAnimationFrame(frame))
</script>

<template>
  <slot :current="Math.round(current)" />
</template>
