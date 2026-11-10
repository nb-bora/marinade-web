<!-- Les moyens de paiement en grosses tuiles tactiles (un seul choix, flèches du clavier). -->
<script setup lang="ts">
import { METHODS, METHOD_ORDER } from '../labels'
import type { PaymentMethod } from '../types'

const model = defineModel<PaymentMethod>({ required: true })

const buttons = ref<HTMLButtonElement[]>([])

/** Les flèches changent de moyen ET déplacent le focus : sinon le clavier reste sur l'ancienne tuile. */
async function select(index: number) {
  const size = METHOD_ORDER.length
  const target = (index + size) % size

  model.value = METHOD_ORDER[target]
  await nextTick()
  buttons.value[target]?.focus()
}

const current = () => METHOD_ORDER.indexOf(model.value)
</script>

<template>
  <div
    class="method-tiles"
    role="radiogroup"
    aria-label="Moyen de paiement"
    @keydown.right.prevent="select(current() + 1)"
    @keydown.down.prevent="select(current() + 1)"
    @keydown.left.prevent="select(current() - 1)"
    @keydown.up.prevent="select(current() - 1)"
    @keydown.home.prevent="select(0)"
    @keydown.end.prevent="select(METHOD_ORDER.length - 1)"
  >
    <button
      v-for="method in METHOD_ORDER"
      :key="method"
      ref="buttons"
      type="button"
      role="radio"
      class="method-tile"
      :class="{ 'method-tile--active': model === method }"
      :style="{ '--tile-color': `var(--v-theme-${METHODS[method].color})` }"
      :aria-checked="model === method"
      :tabindex="model === method ? 0 : -1"
      @click="model = method"
    >
      <span class="method-tile__icon">
        <VIcon
          :icon="METHODS[method].icon"
          size="26"
        />
      </span>
      <span class="method-tile__label">{{ METHODS[method].label }}</span>
      <VIcon
        v-if="model === method"
        icon="ri-checkbox-circle-fill"
        size="18"
        class="method-tile__check"
      />
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
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-block-size: 96px;
  padding: 12px 6px;
  border: 1.5px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 16px;
  background: rgb(var(--v-theme-surface));
  color: rgba(var(--v-theme-on-surface), var(--v-high-emphasis-opacity));
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease;
}

.method-tile__icon {
  display: grid;
  place-items: center;
  inline-size: 44px;
  block-size: 44px;
  border-radius: 14px;
  background: rgba(var(--tile-color), 0.12);
  color: rgb(var(--tile-color));
}

.method-tile:hover {
  background: rgba(var(--tile-color), 0.06);
}

.method-tile--active,
.method-tile--active:hover {
  border-color: rgb(var(--tile-color));
  background: rgba(var(--tile-color), 0.12);
  box-shadow: 0 8px 20px -12px rgba(var(--tile-color), 0.7);
}

.method-tile__check {
  position: absolute;
  inset-block-start: 8px;
  inset-inline-end: 8px;
  color: rgb(var(--tile-color));
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
    min-block-size: 84px;
    gap: 6px;
  }

  .method-tile__icon {
    inline-size: 38px;
    block-size: 38px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .method-tile {
    transition: none;
  }
}
</style>
