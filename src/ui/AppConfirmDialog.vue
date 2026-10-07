<script setup lang="ts">
import { useConfirmState } from '@/composables/useConfirm'

const { pending } = useConfirmState()

const isOpen = computed({
  get: () => pending.value !== null,
  set: open => {
    if (!open)
      settle(false)
  },
})

function settle(accepted: boolean) {
  pending.value?.resolve(accepted)
  pending.value = null
}
</script>

<template>
  <VDialog
    v-model="isOpen"
    max-width="440"
  >
    <VCard v-if="pending">
      <VCardTitle class="pt-5 px-6">
        {{ pending.title }}
      </VCardTitle>
      <VCardText
        v-if="pending.text"
        class="px-6"
      >
        {{ pending.text }}
      </VCardText>
      <VCardActions class="px-6 pb-5">
        <VSpacer />
        <VBtn
          variant="text"
          color="secondary"
          @click="settle(false)"
        >
          {{ pending.cancelLabel ?? 'Annuler' }}
        </VBtn>
        <VBtn
          :color="pending.danger ? 'error' : 'primary'"
          variant="flat"
          @click="settle(true)"
        >
          {{ pending.confirmLabel ?? 'Confirmer' }}
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
