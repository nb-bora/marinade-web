<script setup lang="ts">
defineProps<{
  title: string
  subtitle?: string
}>()
</script>

<template>
  <header class="app-page-header d-flex flex-wrap align-center justify-space-between gap-4 mb-6">
    <div class="min-w-0">
      <h1 class="text-h4 font-weight-semibold text-truncate">
        {{ title }}
      </h1>
      <p
        v-if="subtitle"
        class="text-body-1 text-medium-emphasis mb-0 mt-1"
      >
        {{ subtitle }}
      </p>
    </div>

    <div
      v-if="$slots.actions"
      class="d-flex flex-wrap align-center gap-3"
    >
      <slot name="actions" />
    </div>
  </header>
</template>
