<script setup lang="ts">
withDefaults(defineProps<{
  label: string
  value: string
  icon: string
  hint?: string
  color?: 'primary' | 'success' | 'info' | 'warning' | 'error' | 'secondary'
  loading?: boolean
}>(), {
  color: 'primary',
})
</script>

<template>
  <VCard class="app-kpi-card h-100">
    <VCardText>
      <div class="d-flex align-center justify-space-between gap-3">
        <span class="text-body-2 text-medium-emphasis">{{ label }}</span>
        <VAvatar
          :color="color"
          variant="tonal"
          rounded
          size="36"
        >
          <VIcon
            :icon="icon"
            size="20"
          />
        </VAvatar>
      </div>

      <VSkeletonLoader
        v-if="loading"
        type="heading"
        class="mt-2 bg-transparent"
        width="140"
      />
      <div
        v-else
        class="app-kpi-card__value font-weight-semibold mt-2 tabular-nums"
      >
        {{ value }}
      </div>

      <div
        v-if="hint && !loading"
        class="text-caption text-medium-emphasis mt-1"
      >
        {{ hint }}
      </div>
    </VCardText>
  </VCard>
</template>

<style scoped>
.app-kpi-card__value {
  font-size: clamp(1.25rem, 1.1rem + 0.6vw, 1.625rem);
  line-height: 1.3;
  overflow-wrap: anywhere;
}
</style>
