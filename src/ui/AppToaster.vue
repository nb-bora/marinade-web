<script setup lang="ts">
import { useToastStore } from '@/stores/toast.store'

const store = useToastStore()
</script>

<template>
  <div
    class="app-toaster"
    aria-live="polite"
  >
    <VSnackbar
      v-for="(toast, index) in store.items"
      :key="toast.id"
      model-value
      :color="toast.color"
      :timeout="toast.color === 'error' ? 8000 : 4000"
      :style="{ 'margin-block-end': `${index * 64}px` }"
      location="bottom end"
      @update:model-value="store.dismiss(toast.id)"
    >
      {{ toast.text }}
      <template #actions>
        <VBtn
          icon="ri-close-line"
          size="small"
          variant="text"
          aria-label="Fermer"
          @click="store.dismiss(toast.id)"
        />
      </template>
    </VSnackbar>
  </div>
</template>
