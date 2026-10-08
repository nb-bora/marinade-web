<!-- Une session à encaisser : table, ancienneté, total, reste dû. Toute la tuile ouvre l'encaissement. -->
<script setup lang="ts">
import { SESSION_STATUS, present } from '../labels'
import type { CashSession } from '../types'
import { formatRelative } from '@/lib/format'

const props = defineProps<{
  row: CashSession
  now: Date
}>()

defineEmits<{ select: [] }>()

const name = computed(() => {
  if (props.row.table)
    return `Table ${props.row.table.numero}`

  return props.row.session.table_context || 'Sans table'
})

// Le contexte de la session dit déjà « 4 couverts · Terrasse » ; sans lui, l'emplacement de la table.
const detail = computed(() => props.row.table
  ? props.row.session.table_context || props.row.table.emplacement || ''
  : '')

const paid = computed(() => Number(props.row.invoice?.amount_paid ?? 0) > 0)
</script>

<template>
  <VCard
    class="session-tile h-100"
    tabindex="0"
    role="link"
    :aria-label="`Encaisser ${name}`"
    @click="$emit('select')"
    @keydown.enter="$emit('select')"
  >
    <VCardText class="d-flex flex-column gap-3 h-100">
      <div class="d-flex align-center gap-3">
        <VAvatar
          color="primary"
          variant="tonal"
          rounded
          size="48"
        >
          <VIcon
            icon="ri-restaurant-2-line"
            size="26"
          />
        </VAvatar>
        <div class="min-w-0">
          <div class="text-h6 text-truncate">
            {{ name }}
          </div>
          <div class="text-body-2 text-medium-emphasis text-truncate">
            {{ detail || `Ouverte ${formatRelative(row.session.opened_at, now)}` }}
          </div>
        </div>
        <VSpacer />
        <AppStatusChip v-bind="present(SESSION_STATUS, row.session.status)" />
      </div>

      <div class="d-flex justify-space-between align-end gap-3 mt-auto">
        <div>
          <div class="text-body-2 text-medium-emphasis">
            Reste dû
          </div>
          <div class="text-h4 font-weight-bold tabular-nums text-primary">
            <AppMoney :amount="row.invoice?.amount_due" />
          </div>
          <div class="text-body-2 text-medium-emphasis mt-1">
            Total <AppMoney :amount="row.invoice?.total_amount" />
            <template v-if="paid">
              · payé <AppMoney :amount="row.invoice?.amount_paid" />
            </template>
          </div>
        </div>
        <VBtn
          color="primary"
          size="large"
          append-icon="ri-arrow-right-line"
          tabindex="-1"
        >
          Encaisser
        </VBtn>
      </div>
    </VCardText>
  </VCard>
</template>

<style scoped>
.session-tile {
  cursor: pointer;
  transition: box-shadow 0.15s ease, transform 0.15s ease;
}

.session-tile:hover {
  box-shadow: 0 6px 18px rgba(var(--v-theme-primary), 0.2);
  transform: translateY(-1px);
}

.session-tile:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}
</style>
