<!--
  Pastilles d'état (libre, occupée, en paiement…) avec leur effectif : la légende du plan et le filtre
  de la liste des tables. Toucher une pastille filtre sur cet état, la toucher encore retire le filtre.
-->
<script setup lang="ts">
import type { PlanState } from '../labels'

export interface StatePill {
  state: PlanState
  label: string

  /** Couleur du thème Vuetify (success, warning, error…). */
  color: string
  count: number
}

defineProps<{
  items: StatePill[]
  label?: string
}>()

const model = defineModel<PlanState | null>({ default: null })

const toggle = (state: PlanState) => {
  model.value = model.value === state ? null : state
}
</script>

<template>
  <ul
    class="state-pills"
    :aria-label="label ?? 'États des tables, touchez un état pour filtrer'"
  >
    <li
      v-for="item in items"
      :key="item.state"
    >
      <button
        type="button"
        class="state-pill"
        :class="{ 'state-pill--on': model === item.state, 'state-pill--off': model && model !== item.state }"
        :aria-pressed="model === item.state"
        @click="toggle(item.state)"
      >
        <span
          class="state-pill__dot"
          :style="{ background: `rgb(var(--v-theme-${item.color}))` }"
        />
        <span class="text-body-2">{{ item.label }}</span>
        <span class="text-body-2 text-medium-emphasis tabular-nums">{{ item.count }}</span>
      </button>
    </li>
  </ul>
</template>

<style scoped lang="scss">
.state-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.state-pill {
  align-items: center;
  background: transparent;
  border: 1px solid rgba(var(--v-border-color), 0.2);
  border-radius: 999px;
  color: inherit;
  cursor: pointer;
  display: inline-flex;
  font: inherit;
  gap: 0.5rem;
  padding: 0.3rem 0.75rem;
  transition: background 0.15s ease, opacity 0.15s ease, border-color 0.15s ease;

  &:hover {
    background: rgba(var(--v-theme-on-surface), 0.05);
  }

  &:focus-visible {
    outline: 2px solid rgb(var(--v-theme-primary));
    outline-offset: 2px;
  }

  &--on {
    background: rgba(var(--v-theme-primary), 0.1);
    border-color: rgb(var(--v-theme-primary));
  }

  &--off {
    opacity: 0.55;
  }
}

.state-pill__dot {
  block-size: 14px;
  border-radius: 50%;
  display: inline-block;
  inline-size: 14px;
}

@media (prefers-reduced-motion: reduce) {
  .state-pill {
    transition: none;
  }
}
</style>
