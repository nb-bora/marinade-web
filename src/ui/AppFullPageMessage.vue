<script setup lang="ts">
defineProps<{
  icon: string
  title: string
  text?: string
  tone?: 'primary' | 'error' | 'warning' | 'secondary'
}>()
</script>

<template>
  <div class="app-full-page-message d-flex align-center justify-center pa-6">
    <div class="app-full-page-message__body text-center">
      <VAvatar
        :color="tone ?? 'primary'"
        variant="tonal"
        size="80"
        class="mb-6"
      >
        <VIcon
          :icon="icon"
          size="40"
        />
      </VAvatar>

      <h1 class="text-h4 font-weight-semibold mb-2">
        {{ title }}
      </h1>
      <p
        v-if="text"
        class="text-body-1 text-medium-emphasis mb-6"
      >
        {{ text }}
      </p>

      <div class="d-flex flex-wrap justify-center gap-3">
        <slot />
      </div>
    </div>
  </div>
</template>

<style scoped>
.app-full-page-message {
  min-block-size: 100dvh;
  background: rgb(var(--v-theme-background));
}

.app-full-page-message__body {
  max-inline-size: 30rem;
}
</style>
