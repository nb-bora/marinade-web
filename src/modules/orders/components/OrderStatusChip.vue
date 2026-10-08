<script setup lang="ts">
import { presentOrder } from '../labels'

const props = defineProps<{ status: string }>()

const view = computed(() => presentOrder(props.status))
</script>

<template>
  <AppStatusChip
    :label="view.label"
    :tone="view.tone"
    :icon="view.icon"
  />
</template>
