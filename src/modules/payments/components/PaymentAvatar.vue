<!-- Pastille d'un paiement : couleur et icône de son statut. -->
<script setup lang="ts">
import { presentStatus } from '../statuses'

const props = withDefaults(defineProps<{ status: string; size?: number }>(), { size: 40 })

const TONE_COLOR = { success: 'success', error: 'error', warning: 'warning', info: 'info', neutral: 'secondary' } as const

const view = computed(() => presentStatus(props.status))
</script>

<template>
  <VAvatar
    :color="TONE_COLOR[view.tone]"
    variant="tonal"
    rounded
    :size="size"
  >
    <VIcon
      :icon="view.icon"
      :size="Math.round(size * 0.55)"
    />
  </VAvatar>
</template>
