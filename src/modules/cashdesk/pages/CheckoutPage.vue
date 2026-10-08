<script setup lang="ts">
import { cashDeskApi } from '../api'
import BillSummary from '../components/BillSummary.vue'
import ReceiptDialog from '../components/ReceiptDialog.vue'
import type { SinglePayload } from '../components/SinglePayment.vue'
import SinglePayment from '../components/SinglePayment.vue'
import type { SplitPayload } from '../components/SplitPayment.vue'
import SplitPayment from '../components/SplitPayment.vue'
import { useIdempotencyKey } from '../composables/useIdempotencyKey'
import { useOrderedLines } from '../composables/useOrderedLines'
import { useShift } from '../composables/useShift'
import { SESSION_STATUS, present } from '../labels'
import { toNumber } from '../money'
import type { Invoice, Payment, ReceiptPayment, ServiceSession, Table } from '../types'
import { useAsyncData } from '@/composables/useAsyncData'
import { useLive } from '@/composables/useLive'
import { useSubmit } from '@/composables/useSubmit'
import { useTenantStore } from '@/stores/tenant.store'
import { useToast } from '@/stores/toast.store'

const route = useRoute()
const router = useRouter()
const tenant = useTenantStore()
const toast = useToast()
const shift = useShift()

const sessionId = computed(() => String(route.params.sessionId))

interface CheckoutData {
  session: ServiceSession | null
  table: Table | null
  invoice: Invoice | null
}

// Le back n'offre pas « lire une session » : on la cherche parmi les sessions ouvertes. Une session
// soldée n'y figure plus, mais sa facture reste lisible : l'encaissement en reste consultable.
const { data, loading, error, reload, refresh } = useAsyncData<CheckoutData>(async signal => {
  const restaurantId = tenant.currentId

  if (!restaurantId)
    return { session: null, table: null, invoice: null }

  const [sessions, tables, invoice] = await Promise.all([
    cashDeskApi.activeSessions(restaurantId, signal),
    cashDeskApi.tables(restaurantId, signal).catch(() => [] as Table[]),
    cashDeskApi.sessionInvoice(restaurantId, sessionId.value, signal),
  ])

  const session = sessions.find(item => item.id === sessionId.value) ?? null
  const table = session?.table_id ? tables.find(item => item.id === session.table_id) ?? null : null

  return { session, table, invoice }
}, { watch: [sessionId, () => tenant.currentId] })

useLive(refresh)

const session = computed(() => data.value?.session ?? null)
const table = computed(() => data.value?.table ?? null)
const invoice = computed(() => data.value?.invoice ?? null)

const due = computed(() => invoice.value ? Math.max(toNumber(invoice.value.amount_due), 0) : 0)
const settled = computed(() => invoice.value !== null && due.value <= 0)
const unknown = computed(() => data.value !== null && !session.value && !invoice.value)

const { lines, reread } = useOrderedLines(sessionId)

const tableLabel = computed(() => {
  if (table.value)
    return `Table ${table.value.numero}`

  return session.value?.table_context || null
})

const title = computed(() => tableLabel.value ? `Encaissement · ${tableLabel.value}` : 'Encaissement')
const subtitle = computed(() => invoice.value ? `Facture ${invoice.value.invoice_number}` : 'Réglez l\'addition de la session.')

const currency = computed(() => tenant.current?.currency ?? 'XAF')

// Encaissement -----------------------------------------------------------------------------

type Mode = 'single' | 'split'

const mode = ref<Mode>('single')

const MODES = [
  { value: 'single' as Mode, title: 'Un seul moyen' },
  { value: 'split' as Mode, title: 'Paiement partagé' },
]

const single = ref<InstanceType<typeof SinglePayment>>()
const split = ref<InstanceType<typeof SplitPayment>>()

const receiptOpen = ref(false)

interface Receipt {
  invoice: Invoice
  payments: ReceiptPayment[]
  tendered: number | null
  change: number
  paidAt: Date
}

const receipt = ref<Receipt | null>(null)

// Même encaissement = même clé : un double clic ou un nouvel essai après coupure ne paie qu'une fois.
const idempotency = useIdempotencyKey()

const asReceipt = (payment: Payment): ReceiptPayment => ({
  method: payment.payment_method,
  amount: toNumber(payment.amount),
  reference: payment.external_reference ?? null,
})

async function finish(payments: Payment[], tendered: number | null, change: number) {
  idempotency.settle()
  await refresh()
  reread()

  const fresh = invoice.value

  if (fresh) {
    receipt.value = { invoice: fresh, payments: payments.map(asReceipt), tendered, change, paidAt: new Date() }
    receiptOpen.value = true
  }

  single.value?.reset()
  split.value?.reset()
  toast.success(Number(fresh?.amount_due ?? 1) <= 0 ? 'Addition soldée. Merci !' : 'Paiement enregistré.')
}

const { submit: paySingle, pending: payingSingle, message: singleMessage } = useSubmit(async (payload: SinglePayload) => {
  const restaurantId = tenant.currentId
  const current = invoice.value

  if (!restaurantId || !current)
    return

  const key = idempotency.keyFor(`single|${current.id}|${payload.method}|${payload.amount}|${payload.reference ?? ''}`)

  const payment = await cashDeskApi.pay(restaurantId, {
    invoice_id: current.id,
    payment_method: payload.method,
    amount: payload.amount,
    external_reference: payload.reference,
    idempotency_key: key,
  })

  await finish([payment], payload.tendered, payload.change)
})

const { submit: paySplit, pending: payingSplit, message: splitMessage } = useSubmit(async (payload: SplitPayload) => {
  const restaurantId = tenant.currentId
  const current = invoice.value

  if (!restaurantId || !current)
    return

  const signature = payload.items.map(item => `${item.method}:${item.amount}:${item.reference ?? ''}`).join('|')
  const key = idempotency.keyFor(`split|${current.id}|${signature}`)

  const payments = await cashDeskApi.paySplit(restaurantId, {
    invoice_id: current.id,
    payments: payload.items.map(item => ({
      payment_method: item.method,
      amount: item.amount,
      external_reference: item.reference,
    })),
    idempotency_key: key,
  })

  await finish(payments, null, 0)
})

// Addition soldée et reçu refermé : retour à la caisse.
watch(receiptOpen, isOpen => {
  if (!isOpen && settled.value && receipt.value)
    router.push('/caisse')
})

const viewReceipt = () => {
  receiptOpen.value = true
}
</script>

<template>
  <div>
    <AppPageHeader
      :title="title"
      :subtitle="subtitle"
    >
      <template #actions>
        <AppStatusChip
          v-if="session"
          v-bind="present(SESSION_STATUS, session.status)"
        />
        <VBtn
          v-if="receipt"
          variant="outlined"
          color="secondary"
          prepend-icon="ri-printer-line"
          @click="viewReceipt"
        >
          Dernier reçu
        </VBtn>
        <VBtn
          v-if="invoice"
          variant="outlined"
          color="secondary"
          prepend-icon="ri-file-list-3-line"
          :to="`/caisse/factures/${invoice.id}`"
        >
          Facture
        </VBtn>
        <VBtn
          variant="text"
          to="/caisse"
          prepend-icon="ri-arrow-left-line"
        >
          Caisse
        </VBtn>
      </template>
    </AppPageHeader>

    <AppErrorState
      v-if="error && !data"
      :error="error"
      @retry="reload"
    />

    <VSkeletonLoader
      v-else-if="loading && !data"
      type="card, card"
    />

    <VCard v-else-if="unknown">
      <AppEmptyState
        icon="ri-lock-line"
        title="Session introuvable"
        text="Elle est peut-être clôturée, ou elle appartient à un autre restaurant."
      >
        <VBtn
          color="primary"
          to="/caisse"
        >
          Retour à la caisse
        </VBtn>
      </AppEmptyState>
    </VCard>

    <VRow v-else>
      <VCol
        cols="12"
        lg="5"
      >
        <BillSummary
          :invoice="invoice"
          :lines="lines"
          :loading="loading"
        />
      </VCol>

      <VCol
        cols="12"
        lg="7"
      >
        <VCard v-if="!invoice">
          <AppEmptyState
            icon="ri-receipt-line"
            title="Rien à encaisser pour l'instant"
            text="Aucune commande n'a encore été passée sur cette session. L'addition apparaîtra dès la première commande."
          />
        </VCard>

        <VCard v-else-if="settled">
          <AppEmptyState
            icon="ri-checkbox-circle-line"
            title="Cette addition est soldée"
            text="Il n'y a plus rien à encaisser sur cette session."
          >
            <div class="d-flex flex-wrap justify-center gap-3">
              <VBtn
                v-if="receipt"
                variant="outlined"
                color="secondary"
                prepend-icon="ri-printer-line"
                @click="viewReceipt"
              >
                Imprimer le reçu
              </VBtn>
              <VBtn
                color="primary"
                to="/caisse"
              >
                Retour à la caisse
              </VBtn>
            </div>
          </AppEmptyState>
        </VCard>

        <VCard v-else>
          <VCardItem class="pb-2">
            <VCardTitle>Encaisser</VCardTitle>
            <VCardSubtitle>Reste dû : <AppMoney :amount="due" :currency="currency" /></VCardSubtitle>
            <template #append>
              <AppSegmented
                v-model="mode"
                :options="MODES"
                label="Mode de paiement"
              />
            </template>
          </VCardItem>

          <VCardText>
            <VAlert
              v-if="!shift.isOpen.value"
              type="info"
              variant="tonal"
              density="compact"
              class="mb-4"
            >
              La caisse n'est pas ouverte : les espèces encaissées ici ne seront pas comptées dans l'écart de fermeture.
            </VAlert>

            <SinglePayment
              v-show="mode === 'single'"
              ref="single"
              :due="due"
              :loading="payingSingle"
              :error="mode === 'single' ? singleMessage : ''"
              @submit="paySingle"
            />
            <SplitPayment
              v-show="mode === 'split'"
              ref="split"
              :due="due"
              :loading="payingSplit"
              :error="mode === 'split' ? splitMessage : ''"
              @submit="paySplit"
            />
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <ReceiptDialog
      v-if="receipt"
      v-model="receiptOpen"
      :invoice="receipt.invoice"
      :payments="receipt.payments"
      :lines="lines"
      :tendered="receipt.tendered"
      :change="receipt.change"
      :paid-at="receipt.paidAt"
      :restaurant-name="tenant.current?.name ?? 'Restaurant'"
      :city="tenant.current?.city"
      :table-label="tableLabel"
      :currency="currency"
    />
  </div>
</template>
