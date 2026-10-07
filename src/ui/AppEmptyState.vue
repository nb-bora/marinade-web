<script setup lang="ts">
defineProps<{
  icon: string
  title: string
  text?: string
}>()
</script>

<template>
  <div class="app-empty-state d-flex flex-column align-center text-center pa-8 gap-2">
    <VAvatar
      color="secondary"
      variant="tonal"
      size="64"
    >
      <VIcon
        :icon="icon"
        size="32"
      />
    </VAvatar>
    <h3 class="text-h6 mt-2">
      {{ title }}
    </h3>
    <p
      v-if="text"
      class="text-body-2 text-medium-emphasis mb-0 app-empty-state__text"
    >
      {{ text }}
    </p>
    <div
      v-if="$slots.default"
      class="mt-3"
    >
      <slot />
    </div>
  </div>
</template>

<style scoped>
.app-empty-state__text {
  max-inline-size: 28rem;
}
</style>
