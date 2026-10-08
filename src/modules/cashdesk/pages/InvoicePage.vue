<script setup lang="ts">
import { cashDeskApi } from '../api'
import BillSummary from '../components/BillSummary.vue'
import ReceiptDialog from '../components/ReceiptDialog.vue'
import { useOrderedLines } from '../composables/useOrderedLines'
import { toNumber } from '../money'
import { useAsyncData } from '@/composables/useAsyncData'
import { formatDateTime, formatMoney } from '@/lib/format'
import { useTenantStore } from '@/stores/tenant.store'

const route = useRoute()
const tenant = useTenantStore()

const invoiceId = computed(() => String(route.params.invoiceId))

const { data: invoice, loading, error, reload } = useAsyncData(
  signal => tenant.currentId
    ? cashDeskApi.invoice(tenant.currentId, invoiceId.value, signal)
    : Promise.resolve(null),
  { watch: [invoiceId, () => tenant.currentId] },
)

const sessionId = computed(() => invoice.value?.session_id ?? '')
const { lines } = useOrderedLines(sessionId)

const due = computed(() => invoice.value ? toNumber(invoice.value.amount_due) : 0)

const paidShare = computed(() => {
  const total = invoice.value ? toNumber(invoice.value.total_amount) : 0

  return total > 0 ? Math.min(Math.round(toNumber(invoice.value?.amount_paid) / total * 100), 100) : 0
})

const printOpen = ref(false)
const currency = computed(() => tenant.current?.currency ?? 'XAF')

/** Empreinte fiscale de la facture, utile à l'audit. */
const hash = computed(() => invoice.value?.fiscal_hash ?? null)
</script>

<template>
  <div>
    <AppPageHeader
      :title="invoice ? `Facture ${invoice.invoice_number}` : 'Facture'"
      :subtitle="invoice ? `Émise le ${formatDateTime(invoice.created_at)}` : undefined"
    >
      <template #actions>
        <VBtn
          variant="text"
          to="/caisse"
          prepend-icon="ri-arrow-left-line"
        >
          Caisse
        </VBtn>
        <VBtn
          v-if="invoice && invoice.session_id && due > 0"
          color="primary"
          prepend-icon="ri-hand-coin-line"
          :to="`/caisse/sessions/${invoice.session_id}`"
        >
          Encaisser le reste
        </VBtn>
        <VBtn
          v-if="invoice"
          variant="outlined"
          color="secondary"
          prepend-icon="ri-printer-line"
          @click="printOpen = true"
        >
          Imprimer
        </VBtn>
      </template>
    </AppPageHeader>

    <AppErrorState
      v-if="error && !invoice"
      :error="error"
      @retry="reload"
    />

    <VSkeletonLoader
      v-else-if="loading && !invoice"
      type="card, card"
    />

    <VRow v-else-if="invoice">
      <VCol
        cols="12"
        lg="7"
      >
        <BillSummary
          title="Détail de la facture"
          :invoice="invoice"
          :lines="lines"
        />
      </VCol>

      <VCol
        cols="12"
        lg="5"
      >
        <VCard>
          <VCardItem>
            <VCardTitle>Paiement</VCardTitle>
          </VCardItem>
          <VCardText>
            <div class="d-flex justify-space-between align-end mb-2">
              <span class="text-body-1 text-medium-emphasis">Payé</span>
              <span class="text-h5 font-weight-bold tabular-nums text-success">{{ formatMoney(invoice.amount_paid, currency) }}</span>
            </div>
            <VProgressLinear
              :model-value="paidShare"
              color="success"
              bg-color="secondary"
              bg-opacity="0.2"
              height="10"
              rounded
              :aria-label="`Payé à ${paidShare} %`"
            />
            <div class="d-flex justify-space-between align-end mt-3">
              <span class="text-body-1 text-medium-emphasis">Reste dû</span>
              <span
                class="text-h5 font-weight-bold tabular-nums"
                :class="due > 0 ? 'text-primary' : 'text-success'"
              >{{ formatMoney(invoice.amount_due, currency) }}</span>
            </div>
            <p class="text-body-2 text-medium-emphasis mt-4 mb-0">
              {{ paidShare }} % de l'addition est réglé.
            </p>
            <template v-if="hash">
              <VDivider class="my-4" />
              <div class="text-body-2 text-medium-emphasis">
                Empreinte fiscale
              </div>
              <div class="text-body-2 hash">
                {{ hash }}
              </div>
            </template>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <ReceiptDialog
      v-if="invoice"
      v-model="printOpen"
      title="Facture à imprimer"
      :invoice="invoice"
      :lines="lines"
      :restaurant-name="tenant.current?.name ?? 'Restaurant'"
      :city="tenant.current?.city"
      :currency="currency"
    />
  </div>
</template>

<style scoped>
.hash {
  font-family: ui-monospace, monospace;
  overflow-wrap: anywhere;
}
</style>
