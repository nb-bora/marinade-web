<script setup lang="ts">
import { describeError } from '@/lib/http/errorMessages'

defineProps<{
  error: unknown
}>()

defineEmits<{ retry: [] }>()
</script>

<template>
  <VAlert
    type="error"
    variant="tonal"
    class="app-error-state"
  >
    <div class="d-flex flex-wrap align-center justify-space-between gap-3">
      <span>{{ describeError(error) }}</span>
      <VBtn
        size="small"
        variant="outlined"
        color="error"
        prepend-icon="ri-refresh-line"
        @click="$emit('retry')"
      >
        Réessayer
      </VBtn>
    </div>
  </VAlert>
</template>
