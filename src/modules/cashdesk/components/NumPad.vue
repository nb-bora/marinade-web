<!-- Pavé numérique tactile pour saisir un montant entier (FCFA). -->
<script setup lang="ts">
const model = defineModel<number>({ required: true })

const MAX = 999_999_999

function press(digits: string) {
  model.value = Math.min(Number(`${model.value || ''}${digits}`) || 0, MAX)
}

const erase = () => {
  model.value = Math.floor(model.value / 10)
}

const clear = () => {
  model.value = 0
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0']
</script>

<template>
  <div
    class="numpad"
    role="group"
    aria-label="Pavé numérique"
  >
    <VBtn
      v-for="digits in KEYS"
      :key="digits"
      variant="tonal"
      color="secondary"
      class="numpad__key"
      :aria-label="digits"
      @click="press(digits)"
    >
      {{ digits }}
    </VBtn>
    <VBtn
      variant="tonal"
      color="secondary"
      class="numpad__key"
      aria-label="Effacer le dernier chiffre"
      @click="erase"
      @dblclick="clear"
    >
      <VIcon
        icon="ri-delete-back-2-line"
        size="26"
      />
    </VBtn>
  </div>
</template>

<style scoped>
.numpad {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.numpad__key {
  block-size: 64px !important;
  font-size: 1.5rem;
  font-weight: 600;
  letter-spacing: 0;
}

@media (max-width: 599px) {
  .numpad__key {
    block-size: 56px !important;
  }
}
</style>
