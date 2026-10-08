<script setup lang="ts">
import { floorApi } from '../api'
import MenuPicker from '../components/MenuPicker.vue'
import OrderCart from '../components/OrderCart.vue'
import SessionBill from '../components/SessionBill.vue'
import SessionOrders from '../components/SessionOrders.vue'
import { markOrdered, sessionInvoice } from '../composables/invoices'
import { useCatalog } from '../composables/useCatalog'
import { useSessionOrders } from '../composables/useSessionOrders'
import { newUuid } from '../composables/uuid'
import { SESSION_STATUS, STATION_LABEL, plural, present } from '../labels'
import { coversOf, release, serviceOf } from '../service'
import type { CartLine, CatalogItem, Invoice, ServiceSession, Table } from '../types'
import { useAsyncData } from '@/composables/useAsyncData'
import { useConfirm } from '@/composables/useConfirm'
import { useLive } from '@/composables/useLive'
import { useSubmit } from '@/composables/useSubmit'
import { formatMoney, formatRelative } from '@/lib/format'
import { useTenantStore } from '@/stores/tenant.store'
import { useToast } from '@/stores/toast.store'

const route = useRoute()
const router = useRouter()
const tenant = useTenantStore()
const toast = useToast()
const confirm = useConfirm()

const sessionId = computed(() => String(route.params.sessionId))

interface SessionState {

  /** La session, tant que le serveur la liste (ouverte ou partiellement payée). */
  session: ServiceSession | null

  /** Table concernée : celle de la session, ou celle qui garde la trace d'une session soldée. */
  table: Table | null
  invoice: Invoice | null
}

// Le back n'offre pas « lire une session » : on la cherche parmi les sessions ouvertes. Une session
// soldée n'y figure plus, mais la table qu'elle occupe en garde l'identifiant (voir `service.ts`).
const { data, loading, error, reload, refresh } = useAsyncData<SessionState>(async signal => {
  const restaurantId = tenant.currentId

  if (!restaurantId)
    return { session: null, table: null, invoice: null }

  const [sessions, tables, invoice] = await Promise.all([
    floorApi.activeSessions(restaurantId, signal),
    floorApi.tables(restaurantId, signal),
    sessionInvoice(restaurantId, sessionId.value, signal),
  ])

  const session = sessions.find(item => item.id === sessionId.value) ?? null

  const table = session?.table_id
    ? tables.find(item => item.id === session.table_id) ?? null
    : tables.find(item => serviceOf(item).session_id === sessionId.value) ?? null

  return { session, table, invoice }
}, { watch: [sessionId, () => tenant.currentId] })

useLive(refresh)

const session = computed(() => data.value?.session ?? null)
const table = computed(() => data.value?.table ?? null)
const invoice = computed(() => data.value?.invoice ?? null)

/** Soldée mais pas encore clôturée : la table la désigne encore. */
const settled = computed(() => !session.value && table.value !== null)
const ended = computed(() => data.value !== null && !session.value && !table.value)

const covers = computed(() => coversOf(session.value, table.value))
const amountDue = computed(() => invoice.value ? Number(invoice.value.amount_due) : 0)

const title = computed(() => {
  if (table.value)
    return `Table ${table.value.numero}`

  return session.value?.table_context || 'Session'
})

const subtitle = computed(() => {
  const parts: string[] = []

  if (session.value) {
    if (covers.value)
      parts.push(plural(covers.value, 'couvert'))

    parts.push(`ouverte ${formatRelative(session.value.opened_at)}`)
  }
  else if (settled.value) {
    parts.push('Addition réglée')
  }

  return parts.join(' · ')
})

// Carte et panier ----------------------------------------------------------------------

const catalog = useCatalog()
const items = computed(() => catalog.data.value ?? [])

const cart = ref<CartLine[]>([])
const idempotencyKey = ref(newUuid())

// Une commande modifiée est une autre commande : elle reçoit sa propre clé, sinon le serveur
// renverrait l'ancienne en réponse à un renvoi.
watch(cart, () => {
  idempotencyKey.value = newUuid()
}, { deep: true })

const quantities = computed(() => Object.fromEntries(cart.value.map(line => [line.item.id, line.quantity])))
const cartCount = computed(() => cart.value.reduce((sum, line) => sum + line.quantity, 0))
const cartTotal = computed(() => cart.value.reduce((sum, line) => sum + line.quantity * line.item.price, 0))

function add(item: CatalogItem) {
  const line = cart.value.find(other => other.item.id === item.id)

  if (line)
    line.quantity = Math.min(99, line.quantity + 1)
  else
    cart.value = [...cart.value, { item, quantity: 1, notes: '', station: item.station }]
}

const { orders, add: rememberOrder, forget } = useSessionOrders(sessionId)

const { submit: sendOrder, pending: sending, message: sendError, reset: resetSend } = useSubmit(async () => {
  const restaurantId = tenant.currentId

  if (!restaurantId || !cart.value.length)
    return

  const order = await floorApi.createOrder(restaurantId, {
    session_id: sessionId.value,
    customer_id: session.value?.customer_id ?? null,
    fulfillment_type: 'DINE_IN',
    order_channel: 'POS',
    idempotency_key: idempotencyKey.value,
    items: cart.value.map(line => ({
      product_id: line.item.id,
      quantity: line.quantity,
      notes: line.notes.trim() || null,
      destination_station: line.station,
      tax_rate: 0, // ignoré par le serveur pour les articles de la carte : la TVA du restaurant s'applique
    })),
  })

  markOrdered(sessionId.value)

  const stations = [...new Set(cart.value.map(line => STATION_LABEL[line.station]))]

  rememberOrder({
    id: order.id,
    sentAt: order.created_at,
    status: order.status,
    total: order.total_amount,
    lines: cart.value.map(line => ({
      name: line.item.name,
      quantity: line.quantity,
      notes: line.notes.trim(),
      station: line.station,
    })),
  })
  cart.value = []
  resetSend()
  toast.success(`Commande envoyée (${stations.join(', ')}).`)
  await refresh()
})

// Clôture ------------------------------------------------------------------------------

const closeBlocked = computed(() => amountDue.value > 0)

const { submit: close, pending: closing } = useSubmit(async () => {
  const restaurantId = tenant.currentId

  if (!restaurantId)
    return false

  await floorApi.closeSession(restaurantId, sessionId.value)

  // La session est clôturée : libérer la table est un confort, pas une condition.
  if (table.value) {
    try {
      await floorApi.updateTable(table.value.id, release(table.value))
    }
    catch {
      toast.warning('Session clôturée, mais la table n\'a pas pu être remise en libre.')
    }
  }

  forget(sessionId.value)
  toast.success(`${title.value} clôturée.`)
  router.push('/salle')

  return true
})

async function requestClose() {
  if (cart.value.length && !await confirm({
    title: 'Une commande n\'est pas envoyée',
    text: 'Les articles choisis seront perdus si vous clôturez la session.',
    confirmLabel: 'Clôturer quand même',
    danger: true,
  }))
    return

  const accepted = await confirm({
    title: `Clôturer ${title.value.toLowerCase()} ?`,
    text: 'La table redevient libre. Cette action est définitive.',
    confirmLabel: 'Clôturer la session',
    danger: true,
  })

  if (!accepted)
    return

  if (await close() === undefined)
    toast.error('La session n\'a pas pu être clôturée. Vérifiez qu\'il ne reste rien à payer.')
}

const canCash = computed(() => tenant.can('cash_desk'))

// Barre du bas sur petit écran : le panier est plus bas que la carte.
const cartCard = ref<HTMLElement>()

const scrollToCart = () => cartCard.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
</script>

<template>
  <div>
    <AppPageHeader
      :title="title"
      :subtitle="subtitle"
    >
      <template #actions>
        <VBtn
          variant="text"
          to="/salle"
          prepend-icon="ri-arrow-left-line"
        >
          Plan de salle
        </VBtn>
        <AppStatusChip
          v-if="session"
          v-bind="present(SESSION_STATUS, session.status)"
        />
        <VBtn
          v-if="canCash"
          color="primary"
          prepend-icon="ri-bank-card-line"
          :to="`/caisse/sessions/${sessionId}`"
          :disabled="!invoice || amountDue <= 0"
        >
          Encaisser
        </VBtn>
        <VBtn
          v-if="session || settled"
          variant="outlined"
          color="error"
          prepend-icon="ri-lock-line"
          :loading="closing"
          :disabled="closeBlocked"
          @click="requestClose"
        >
          Clôturer
        </VBtn>
      </template>
    </AppPageHeader>

    <AppErrorState
      v-if="error && !data"
      :error="error"
      @retry="reload"
    />

    <VSkeletonLoader
      v-else-if="!data"
      type="card, card"
    />

    <VCard v-else-if="ended">
      <AppEmptyState
        icon="ri-lock-line"
        title="Cette session est terminée"
        text="Elle est clôturée ou n'existe pas dans ce restaurant."
      >
        <VBtn
          color="primary"
          to="/salle"
        >
          Retour au plan de salle
        </VBtn>
      </AppEmptyState>
    </VCard>

    <template v-else>
      <VAlert
        v-if="settled"
        type="success"
        variant="tonal"
        class="mb-6"
      >
        L'addition est réglée. Clôturez la session pour libérer la table.
      </VAlert>

      <VAlert
        v-else-if="closeBlocked"
        type="info"
        variant="tonal"
        density="compact"
        class="mb-6"
      >
        Il reste {{ formatMoney(amountDue) }} à payer : la session ne peut être clôturée qu'une fois l'addition réglée.
      </VAlert>

      <VRow>
        <VCol
          v-if="!settled"
          cols="12"
          md="7"
        >
          <MenuPicker
            :items="items"
            :loading="catalog.loading.value"
            :error="catalog.error.value"
            :quantities="quantities"
            @add="add"
            @retry="catalog.reload"
          />
        </VCol>

        <VCol
          cols="12"
          :md="settled ? 12 : 5"
        >
          <div class="d-flex flex-column gap-6">
            <div
              v-if="!settled"
              ref="cartCard"
            >
              <OrderCart
                v-model="cart"
                :submitting="sending"
                :error="sendError"
                @submit="sendOrder"
              />
            </div>
            <SessionBill
              :invoice="invoice"
              :loading="loading"
            />
            <SessionOrders :orders="orders" />
          </div>
        </VCol>
      </VRow>

      <Teleport to="body">
        <button
          v-if="cartCount && !settled"
          type="button"
          class="cart-bar d-md-none"
          @click="scrollToCart"
        >
          <VIcon icon="ri-shopping-basket-2-line" />
          <span>{{ plural(cartCount, 'article') }}</span>
          <span class="ms-auto font-weight-bold">{{ formatMoney(cartTotal) }}</span>
        </button>
      </Teleport>
    </template>
  </div>
</template>

<style scoped>
.cart-bar {
  position: fixed;
  inset-block-end: 12px;
  inset-inline: 12px;
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 18px;
  border-radius: 14px;
  background: rgb(var(--v-theme-primary));
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
  color: rgb(var(--v-theme-on-primary));
  font-weight: 500;
}
</style>
