<!-- Les moyens de paiement en grosses tuiles tactiles (un seul choix, flèches du clavier). -->
<script setup lang="ts">
import { METHODS, METHOD_ORDER } from '../labels'
import type { PaymentMethod } from '../types'

const model = defineModel<PaymentMethod>({ required: true })

function move(step: number) {
  const index = METHOD_ORDER.indexOf(model.value)

  model.value = METHOD_ORDER[(index + step + METHOD_ORDER.length) % METHOD_ORDER.length]
}
</script>

<template>
  <div
    class="method-tiles"
    role="radiogroup"
    aria-label="Moyen de paiement"
    @keydown.right.prevent="move(1)"
    @keydown.left.prevent="move(-1)"
  >
    <button
      v-for="method in METHOD_ORDER"
      :key="method"
      type="button"
      role="radio"
      class="method-tile"
      :class="{ 'method-tile--active': model === method }"
      :style="{ '--tile-color': `var(--v-theme-${METHODS[method].color})` }"
      :aria-checked="model === method"
      :tabindex="model === method ? 0 : -1"
      @click="model = method"
    >
      <VIcon
        :icon="METHODS[method].icon"
        size="30"
      />
      <span class="method-tile__label">{{ METHODS[method].label }}</span>
    </button>
  </div>
</template>

<style scoped>
.method-tiles {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.method-tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-block-size: 84px;
  padding: 10px 6px;
  border: 1.5px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 12px;
  background: rgb(var(--v-theme-surface));
  color: rgba(var(--v-theme-on-surface), var(--v-high-emphasis-opacity));
  cursor: pointer;
  transition: border-color 0.12s ease, background-color 0.12s ease, color 0.12s ease;
}

.method-tile :deep(.v-icon) {
  color: rgb(var(--tile-color));
}

.method-tile:hover {
  background: rgba(var(--tile-color), 0.08);
}

.method-tile--active,
.method-tile--active:hover {
  border-color: rgb(var(--tile-color));
  background: rgba(var(--tile-color), 0.14);
}

.method-tile__label {
  font-size: 0.9375rem;
  font-weight: 600;
  line-height: 1.2;
  text-align: center;
}

.method-tile:focus-visible {
  outline: 2px solid rgb(var(--tile-color));
  outline-offset: 2px;
}

@media (max-width: 599px) {
  .method-tiles {
    gap: 8px;
  }

  .method-tile {
    min-block-size: 76px;
  }
}
</style>
