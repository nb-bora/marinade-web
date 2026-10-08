<!-- Une table du plan de salle : couleur selon l'état, session et montant en cours. -->
<script setup lang="ts">
import { TABLE_STATE, plural } from '../labels'
import { tableState } from '../service'
import type { TableView } from '../types'
import { formatRelative } from '@/lib/format'

const props = defineProps<{
  view: TableView
  now: Date
}>()

defineEmits<{ select: [] }>()

const state = computed(() => tableState(props.view))
const look = computed(() => TABLE_STATE[state.value])

const COLOR: Record<string, string> = {
  success: 'success',
  error: 'error',
  info: 'info',
  warning: 'warning',
  neutral: 'secondary',
}

const color = computed(() => COLOR[look.value.tone])

const since = computed(() => props.view.session ? formatRelative(props.view.session.opened_at, props.now) : null)

const label = computed(() => {
  const { table, session, covers } = props.view

  return `Table ${table.numero}, ${look.value.label.toLowerCase()}${session && covers ? `, ${plural(covers, 'couvert')}` : ''}`
})
</script>

<template>
  <button
    type="button"
    class="table-tile"
    :class="`table-tile--${state}`"
    :style="{ '--tile-color': `var(--v-theme-${color})` }"
    :aria-label="label"
    @click="$emit('select')"
  >
    <span class="d-flex align-center justify-space-between gap-2 w-100">
      <span class="table-tile__number">{{ view.table.numero }}</span>
      <VIcon
        :icon="look.icon"
        size="22"
        class="table-tile__icon"
      />
    </span>

    <span class="table-tile__body">
      <template v-if="view.session">
        <span class="table-tile__amount">
          <AppMoney
            v-if="view.total !== null"
            :amount="view.total"
          />
          <span
            v-else
            class="text-medium-emphasis text-body-1"
          >Pas encore de commande</span>
        </span>
        <span class="text-body-2 text-medium-emphasis">
          <template v-if="view.covers">{{ plural(view.covers, 'couvert') }} · </template>{{ since }}
        </span>
      </template>
      <template v-else>
        <span class="text-body-1 font-weight-medium">{{ look.label }}</span>
        <span class="text-body-2 text-medium-emphasis">{{ plural(view.table.capacite, 'place') }}</span>
      </template>
    </span>
  </button>
</template>

<style scoped>
.table-tile {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  inline-size: 100%;
  min-block-size: 132px;
  padding: 14px 16px;
  border: 1px solid rgba(var(--tile-color), 0.45);
  border-inline-start: 6px solid rgb(var(--tile-color));
  border-radius: 12px;
  background: rgba(var(--tile-color), 0.1);
  color: rgb(var(--v-theme-on-surface));
  text-align: start;
  transition: transform 0.12s ease, box-shadow 0.12s ease, background-color 0.12s ease;
}

.table-tile:hover {
  background: rgba(var(--tile-color), 0.16);
  box-shadow: 0 4px 14px rgba(var(--tile-color), 0.25);
  transform: translateY(-1px);
}

.table-tile:active {
  transform: scale(0.98);
}

.table-tile:focus-visible {
  outline: 3px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}

.table-tile--libre {
  background: rgba(var(--tile-color), 0.06);
}

.table-tile--maintenance {
  border-style: dashed;
  opacity: 0.75;
}

.table-tile__number {
  font-size: 1.75rem;
  font-weight: 700;
  line-height: 1.1;
  overflow-wrap: anywhere;
}

.table-tile__icon {
  color: rgb(var(--tile-color));
}

.table-tile__body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-inline-size: 0;
}

.table-tile__amount {
  font-size: 1.25rem;
  font-weight: 700;
  line-height: 1.3;
}

@media (prefers-reduced-motion: reduce) {
  .table-tile {
    transition: none;
  }
}
</style>
