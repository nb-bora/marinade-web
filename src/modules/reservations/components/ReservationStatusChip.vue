<!-- Statut d'une réservation, en français, avec sa couleur. -->
<script setup lang="ts">
import { presentStatus } from '../labels'

const props = defineProps<{ status: string }>()

const view = computed(() => presentStatus(props.status))
</script>

<template>
  <AppStatusChip
    :label="view.label"
    :tone="view.tone"
    :icon="view.icon"
  />
</template>
