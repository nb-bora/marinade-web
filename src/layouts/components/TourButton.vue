<script setup lang="ts">
import { useTours } from '@/composables/useTours'

// Bouton 💡 de la barre du haut : lance la visite guidée de l'écran affiché.
// Il reste disponible même quand la visite a déjà été vue (seul le point de rappel disparaît).
const route = useRoute()
const tours = useTours()

const tourId = computed(() => tours.tourForPath(route.path))
</script>

<template>
  <IconBtn
    v-if="tourId"
    aria-label="Découvrir cette page"
    @click="tours.start(tourId)"
  >
    <VBadge
      dot
      color="primary"
      :model-value="!tours.isDismissed(tourId)"
    >
      <VIcon icon="ri-lightbulb-line" />
    </VBadge>
    <VTooltip
      activator="parent"
      location="bottom"
    >
      Découvrir cette page
    </VTooltip>
  </IconBtn>
</template>
