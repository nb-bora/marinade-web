<!--
  Pavé numérique tactile pour saisir un montant entier (FCFA). Au clavier, les chiffres du pavé et de
  la rangée du haut saisissent aussi le montant, Retour arrière efface un chiffre et Échap remet à zéro,
  tant qu'aucun champ ni aucune fenêtre n'a le focus.
-->
<script setup lang="ts">
import { useEventListener } from '@vueuse/core'

const props = withDefaults(defineProps<{

  /** Le clavier physique est écouté (désactivé quand ce pavé n'est pas à l'écran). */
  keyboard?: boolean
}>(), { keyboard: true })

const model = defineModel<number>({ required: true })

const MAX = 999_999_999

function press(digits: string) {
  model.value = Math.min(Number(`${model.value || ''}${digits}`) || 0, MAX)
}

const erase = () => {
  model.value = Math.floor(model.value / 10)
}

const clear = () => {
  model.value = 0
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0']

/** Le clavier ne doit jamais voler la frappe d'un champ de saisie, d'un menu ou d'une fenêtre ouverte. */
function typingElsewhere(event: KeyboardEvent) {
  const target = event.target

  if (target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)))
    return true

  // Fenêtres et menus ouverts (pas les notifications, qui ne demandent aucune frappe).
  return document.querySelector('.v-dialog.v-overlay--active, .v-menu.v-overlay--active') !== null
}

useEventListener(window, 'keydown', (event: KeyboardEvent) => {
  if (!props.keyboard || event.ctrlKey || event.metaKey || event.altKey || typingElsewhere(event))
    return

  if (/^\d$/.test(event.key)) {
    event.preventDefault()
    press(event.key)
  }
  else if (event.key === 'Backspace') {
    event.preventDefault()
    erase()
  }
  else if (event.key === 'Escape' && model.value !== 0) {
    clear()
  }
})
</script>

<template>
  <div
    class="numpad"
    role="group"
    aria-label="Pavé numérique"
  >
    <VBtn
      v-for="digits in KEYS"
      :key="digits"
      variant="tonal"
      color="secondary"
      class="numpad__key"
      :aria-label="digits"
      @click="press(digits)"
    >
      {{ digits }}
    </VBtn>
    <VBtn
      variant="tonal"
      color="secondary"
      class="numpad__key"
      aria-label="Effacer le dernier chiffre (double clic : tout effacer)"
      @click="erase"
      @dblclick="clear"
    >
      <VIcon
        icon="ri-delete-back-2-line"
        size="26"
      />
    </VBtn>
  </div>
</template>

<style scoped>
.numpad {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.numpad__key {
  block-size: 64px !important;
  border-radius: 14px !important;
  font-size: 1.5rem;
  font-weight: 600;
  letter-spacing: 0;
}

@media (max-width: 599px) {
  .numpad__key {
    block-size: 56px !important;
  }
}
</style>
