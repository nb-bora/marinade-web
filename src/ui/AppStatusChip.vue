<script setup lang="ts">
export type StatusTone = 'success' | 'warning' | 'error' | 'info' | 'neutral'

withDefaults(defineProps<{
  label: string
  tone?: StatusTone
  icon?: string
}>(), {
  tone: 'neutral',
})

const COLORS: Record<StatusTone, string> = {
  success: 'success',
  warning: 'warning',
  error: 'error',
  info: 'info',
  neutral: 'secondary',
}
</script>

<template>
  <VChip
    :color="COLORS[tone]"
    variant="tonal"
    size="small"
    label
    class="font-weight-medium"
  >
    <VIcon
      v-if="icon"
      :icon="icon"
      start
      size="14"
    />
    {{ label }}
  </VChip>
</template>
