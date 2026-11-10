<!--
  Coque commune des fiches de plat et de boisson, en tiroir latéral : en-tête, fermeture (bouton et
  Échap), erreur avec « Réessayer », squelette de chargement. Le contenu de la fiche arrive en slot.
-->
<script setup lang="ts">
import { onKeyStroke } from '@vueuse/core'

defineProps<{
  title: string
  loading: boolean
  error: unknown

  /** La fiche est chargée : le slot peut s'afficher. */
  ready: boolean
}>()

defineEmits<{ retry: [] }>()

const open = defineModel<boolean>({ required: true })

onKeyStroke('Escape', () => {
  if (open.value)
    open.value = false
})
</script>

<template>
  <VNavigationDrawer
    v-model="open"
    location="end"
    temporary
    width="440"
    :aria-label="title"
    class="product-drawer"
  >
    <div class="product-drawer__bar">
      <h2 class="text-subtitle-1 font-weight-semibold">
        {{ title }}
      </h2>
      <IconBtn
        aria-label="Fermer la fiche"
        @click="open = false"
      >
        <VIcon icon="ri-close-line" />
      </IconBtn>
    </div>

    <AppErrorState
      v-if="error"
      class="ma-4"
      :error="error"
      @retry="$emit('retry')"
    />

    <VSkeletonLoader
      v-else-if="loading && !ready"
      class="pa-4"
      type="heading, list-item-two-line, list-item-two-line, list-item-two-line"
    />

    <slot v-else-if="ready" />
  </VNavigationDrawer>
</template>

<style scoped>
.product-drawer__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px 12px 20px;
  border-block-end: 1px solid rgba(var(--v-border-color), 0.3);
}
</style>
