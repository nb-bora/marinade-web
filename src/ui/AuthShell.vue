<script setup lang="ts">
import logo from '@images/logo.svg?raw'

defineProps<{
  title: string
  subtitle?: string
}>()
</script>

<template>
  <div class="auth-shell d-flex align-center justify-center pa-4">
    <div class="auth-shell__panel w-100">
      <div class="d-flex align-center justify-center gap-3 mb-6">
        <!-- eslint-disable vue/no-v-html -->
        <div
          class="d-flex"
          v-html="logo"
        />
        <!-- eslint-enable -->
        <span class="text-h5 font-weight-bold">Marinade</span>
      </div>

      <VCard class="pa-2 pa-sm-4">
        <VCardItem class="pb-0">
          <VCardTitle class="text-h5 font-weight-semibold text-wrap">
            {{ title }}
          </VCardTitle>
          <VCardSubtitle
            v-if="subtitle"
            class="text-wrap mt-1"
          >
            {{ subtitle }}
          </VCardSubtitle>
        </VCardItem>

        <VCardText class="pt-6">
          <slot />
        </VCardText>
      </VCard>

      <div
        v-if="$slots.footer"
        class="text-center mt-4 text-body-2"
      >
        <slot name="footer" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.auth-shell {
  min-block-size: 100dvh;
  background: rgb(var(--v-theme-background));
}

.auth-shell__panel {
  max-inline-size: 28rem;
}
</style>
