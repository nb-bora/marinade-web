<!-- L'addition de la session, telle que le serveur la calcule. -->
<script setup lang="ts">
import { INVOICE_STATUS, present } from '../labels'
import type { Invoice } from '../types'

defineProps<{
  invoice: Invoice | null
  loading: boolean
}>()

const rows = (invoice: Invoice) => [
  { label: 'Sous-total', value: invoice.subtotal },
  { label: 'Taxes', value: invoice.tax_amount },
  { label: 'Service', value: invoice.service_charge },
  { label: 'Remise', value: invoice.discount_amount, negative: true },
].filter(row => Number(row.value) !== 0 || row.label === 'Sous-total')
</script>

<template>
  <VCard>
    <VCardItem class="pb-2">
      <VCardTitle>Addition</VCardTitle>
      <VCardSubtitle
        v-if="invoice"
        class="text-wrap"
        style="overflow-wrap: anywhere;"
      >
        Facture {{ invoice.invoice_number }}
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
      type="list-item-two-line, list-item-two-line"
    />

    <AppEmptyState
      v-else-if="!invoice"
      icon="ri-receipt-line"
      title="Pas encore d'addition"
      text="Elle apparaît dès la première commande envoyée."
    />

    <VCardText v-else>
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
      <div class="due d-flex justify-space-between align-center mt-2 pa-3">
        <span class="text-body-1 font-weight-medium">Reste à payer</span>
        <span class="text-h5 font-weight-bold tabular-nums"><AppMoney :amount="invoice.amount_due" /></span>
      </div>
    </VCardText>
  </VCard>
</template>

<style scoped>
.due {
  border-radius: 10px;
  background: rgba(var(--v-theme-primary), 0.12);
  color: rgb(var(--v-theme-primary));
}
</style>
