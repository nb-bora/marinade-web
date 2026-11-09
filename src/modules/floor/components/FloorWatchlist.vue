<!--
  « À surveiller » : les tables qui demandent un geste (paiement à encaisser, table à libérer, table
  occupée depuis longtemps). Affiché à droite du plan tant qu'aucune table n'est choisie.
-->
<script setup lang="ts">
import type { WatchItem, WatchKind } from '../composables/useFloorMetrics'
import { compactMoney, elapsedTone, formatElapsed } from '../composables/useFloorMetrics'
import { locationOf } from '../service'
import type { TableView } from '../types'

defineProps<{ items: WatchItem[] }>()

defineEmits<{ select: [view: TableView] }>()

const KIND: Record<WatchKind, { label: string; icon: string; color: string }> = {
  paying: { label: 'À encaisser', icon: 'ri-hand-coin-line', color: 'error' },
  settled: { label: 'À libérer', icon: 'ri-door-open-line', color: 'warning' },
  long: { label: 'Occupée depuis longtemps', icon: 'ri-time-line', color: 'warning' },
}
</script>

<template>
  <VCard
    class="watch"
    data-tour="floor-watch"
  >
    <VCardItem>
      <template #prepend>
        <VAvatar
          :color="items.length ? 'warning' : 'success'"
          variant="tonal"
          rounded="lg"
        >
          <VIcon :icon="items.length ? 'ri-eye-line' : 'ri-shield-check-line'" />
        </VAvatar>
      </template>
      <VCardTitle>À surveiller</VCardTitle>
      <VCardSubtitle>{{ items.length ? `${items.length} table${items.length > 1 ? 's' : ''} demande${items.length > 1 ? 'nt' : ''} un geste` : 'Le service se déroule bien' }}</VCardSubtitle>
    </VCardItem>

    <VCardText v-if="!items.length">
      <div class="d-flex flex-column align-center text-center gap-2 pa-2">
        <VIcon
          icon="ri-cursor-line"
          size="28"
          class="text-medium-emphasis"
        />
        <div class="text-body-2 text-medium-emphasis">
          Aucune table à encaisser, à libérer ou occupée depuis longtemps. Touchez une table du plan pour voir son détail.
        </div>
      </div>
    </VCardText>

    <ul
      v-else
      class="watch__list"
    >
      <li
        v-for="item in items"
        :key="item.view.table.id"
      >
        <button
          type="button"
          class="watch__row"
          @click="$emit('select', item.view)"
        >
          <span
            class="watch__num"
            :style="{ '--c': `var(--v-theme-${KIND[item.kind].color})` }"
          >{{ item.view.table.numero }}</span>
          <span class="watch__text">
            <span class="watch__title">{{ KIND[item.kind].label }}</span>
            <span class="watch__meta">
              {{ locationOf(item.view.table) }}
              <template v-if="item.minutes !== null"> · <span :class="`watch__time watch__time--${elapsedTone(item.minutes)}`">{{ formatElapsed(item.minutes) }}</span></template>
              <template v-if="item.kind === 'paying' && (item.view.amountDue ?? item.view.total)"> · {{ compactMoney(item.view.amountDue ?? item.view.total) }}</template>
            </span>
          </span>
          <VIcon
            :icon="KIND[item.kind].icon"
            size="20"
            :color="KIND[item.kind].color"
          />
        </button>
      </li>
    </ul>
  </VCard>
</template>

<style scoped lang="scss">
.watch {
  border: 1px solid rgba(var(--v-border-color), 0.14);
  border-radius: 16px;
  box-shadow: 0 1px 2px rgba(var(--v-theme-on-surface), 0.04) !important;
}

.watch__list {
  list-style: none;
  margin: 0;
  max-block-size: 420px;
  overflow-y: auto;
  padding: 0 0.75rem 0.9rem;
}

.watch__row {
  align-items: center;
  background: transparent;
  border: 0;
  border-radius: 12px;
  color: inherit;
  cursor: pointer;
  display: flex;
  font: inherit;
  gap: 0.75rem;
  inline-size: 100%;
  padding: 0.5rem 0.55rem;
  text-align: start;
  transition: background 0.15s ease;

  &:hover {
    background: rgba(var(--v-theme-on-surface), 0.05);
  }

  &:focus-visible {
    outline: 2px solid rgb(var(--v-theme-primary));
    outline-offset: -2px;
  }
}

.watch__num {
  align-items: center;
  background: rgba(var(--c), 0.14);
  border-radius: 10px;
  color: rgb(var(--c));
  display: inline-flex;
  flex-shrink: 0;
  font-size: 0.85rem;
  font-weight: 700;
  justify-content: center;
  min-inline-size: 42px;
  padding: 0.45rem 0.5rem;
}

.watch__text {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-inline-size: 0;
}

.watch__title {
  font-size: 0.9rem;
  font-weight: 600;
}

.watch__meta {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.78rem;
}

.watch__time {
  font-weight: 600;

  &--warn { color: rgb(var(--v-theme-warning)); }
  &--late { color: rgb(var(--v-theme-error)); }
}
</style>
