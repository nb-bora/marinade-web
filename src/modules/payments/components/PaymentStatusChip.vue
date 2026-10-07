<script setup lang="ts">
import { presentStatus } from '../statuses'

const props = defineProps<{
  status: string
}>()

const view = computed(() => presentStatus(props.status))
</script>

<template>
  <AppStatusChip
    :label="view.label"
    :tone="view.tone"
    :icon="view.icon"
  />
</template>
