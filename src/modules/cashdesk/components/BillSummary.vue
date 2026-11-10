<!-- L'addition détaillée : articles connus, sous-total, taxes, service, total, déjà payé, reste dû. -->
<script setup lang="ts">
import { INVOICE_STATUS, present } from '../labels'
import type { Invoice, OrderedLine } from '../types'
import { formatDateTime } from '@/lib/format'

const props = defineProps<{
  invoice: Invoice | null
  lines?: OrderedLine[]
  loading?: boolean
  title?: string
}>()

// Une facture annulée ou remboursée n'a plus de « reste dû » à réclamer : on le dit au lieu de l'afficher.
const state = computed<'due' | 'paid' | 'closed'>(() => {
  const invoice = props.invoice

  if (!invoice)
    return 'due'
  if (invoice.status === 'CANCELLED' || invoice.status === 'REFUNDED')
    return 'closed'

  return Number(invoice.amount_due) <= 0 ? 'paid' : 'due'
})

const label = computed(() => {
  if (props.invoice?.status === 'CANCELLED')
    return 'Facture annulée'
  if (props.invoice?.status === 'REFUNDED')
    return 'Facture remboursée'

  return state.value === 'paid' ? 'Addition soldée' : 'Reste dû'
})

const rows = (invoice: Invoice) => [
  { label: 'Sous-total', value: invoice.subtotal, always: true, negative: false },
  { label: 'Taxes', value: invoice.tax_amount, always: true, negative: false },
  { label: 'Service', value: invoice.service_charge, always: false, negative: false },
  { label: 'Remise', value: invoice.discount_amount, always: false, negative: true },
].filter(row => row.always || Number(row.value) !== 0)
</script>

<template>
  <VCard>
    <VCardItem class="pb-2">
      <VCardTitle>{{ title ?? 'Addition' }}</VCardTitle>
      <VCardSubtitle
        v-if="invoice"
        class="text-wrap"
        style="overflow-wrap: anywhere;"
      >
        Facture {{ invoice.invoice_number }} · {{ formatDateTime(invoice.created_at) }}
      </VCardSubtitle>
      <template
        v-if="invoice"
        #append
      >
        <AppStatusChip v-bind="present(INVOICE_STATUS, invoice.status)" />
      </template>
    </VCardItem>

    <VSkeletonLoader
      v-if="loading && !invoice"
      type="list-item-two-line, list-item-two-line, list-item-two-line"
    />

    <AppEmptyState
      v-else-if="!invoice"
      icon="ri-receipt-line"
      title="Pas encore d'addition"
      text="Elle apparaît dès la première commande envoyée en cuisine."
    />

    <VCardText v-else>
      <template v-if="lines?.length">
        <div class="text-body-2 text-medium-emphasis mb-2">
          Articles commandés depuis cet appareil
        </div>
        <ul class="lines mb-3">
          <li
            v-for="line in lines"
            :key="line.name"
            class="d-flex gap-3 py-1"
          >
            <span class="lines__qty tabular-nums text-medium-emphasis">{{ line.quantity }} ×</span>
            <span class="text-body-1">{{ line.name }}</span>
          </li>
        </ul>
        <VDivider class="mb-2" />
      </template>

      <div
        v-for="row in rows(invoice)"
        :key="row.label"
        class="d-flex justify-space-between py-1"
      >
        <span class="text-body-1 text-medium-emphasis">{{ row.label }}</span>
        <span class="tabular-nums">
          <template v-if="row.negative">− </template><AppMoney :amount="row.value" />
        </span>
      </div>

      <VDivider class="my-2" />

      <div class="d-flex justify-space-between align-center py-1">
        <span class="text-body-1 font-weight-medium">Total</span>
        <span class="text-h6 tabular-nums"><AppMoney :amount="invoice.total_amount" /></span>
      </div>
      <div class="d-flex justify-space-between py-1">
        <span class="text-body-1 text-medium-emphasis">Déjà payé</span>
        <span class="tabular-nums text-success"><AppMoney :amount="invoice.amount_paid" /></span>
      </div>

      <div
        class="due d-flex flex-wrap justify-space-between align-center gap-2 mt-3 pa-4"
        :class="{ 'due--paid': state === 'paid', 'due--closed': state === 'closed' }"
      >
        <span class="text-body-1 font-weight-medium">{{ label }}</span>
        <span
          v-if="state !== 'closed'"
          class="text-h4 font-weight-bold tabular-nums text-no-wrap"
        ><AppMoney :amount="invoice.amount_due" /></span>
      </div>
    </VCardText>
  </VCard>
</template>

<style scoped>
.lines {
  padding: 0;
  list-style: none;
}

.lines__qty {
  min-inline-size: 2.5rem;
  text-align: end;
}

.due {
  border-radius: 16px;
  background:
    radial-gradient(circle at 90% -20%, rgba(255, 255, 255, 0.28), transparent 55%),
    linear-gradient(135deg, rgb(var(--v-theme-primary)), #b8470a);
  color: #fff;
}

.due--paid {
  background:
    radial-gradient(circle at 90% -20%, rgba(255, 255, 255, 0.28), transparent 55%),
    linear-gradient(135deg, rgb(var(--v-theme-success)), #3f8f3a);
}

.due--closed {
  background: rgba(var(--v-theme-on-surface), 0.08);
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}
</style>
