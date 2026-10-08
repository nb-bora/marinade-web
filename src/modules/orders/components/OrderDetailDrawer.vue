<script setup lang="ts">
import { onKeyStroke } from '@vueuse/core'
import { ordersApi } from '../api'
import { useCatalogue } from '../composables/useCatalogue'
import { pendingOf, refundedOf } from '../composables/useOrders'
import { canAddItems, canRefund, explainError, presentRefund } from '../labels'
import type { Commande, CommandeItem, Refund } from '../types'
import AddItemDialog from './AddItemDialog.vue'
import OrderStatusChip from './OrderStatusChip.vue'
import RefundDialog from './RefundDialog.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useSubmit } from '@/composables/useSubmit'
import { formatDateTime, formatMoney } from '@/lib/format'
import { useTenantStore } from '@/stores/tenant.store'
import { useToast } from '@/stores/toast.store'

const props = defineProps<{
  tableNames: Map<string, string>
}>()

const emit = defineEmits<{
  changed: []
  refunds: [commandeId: string, refunds: Refund[]]
}>()

/** Identifiant de la commande affichée ; `null` ferme le tiroir. */
const orderId = defineModel<string | null>({ required: true })

const tenant = useTenantStore()
const toast = useToast()
const confirm = useConfirm()
const catalogue = useCatalogue()

const order = ref<Commande | null>(null)
const items = ref<CommandeItem[]>([])
const refunds = ref<Refund[]>([])
const loading = ref(false)
const error = ref<unknown>(null)
const actionError = ref('')

const addOpen = ref(false)
const refundOpen = ref(false)
const rejecting = ref<Refund | null>(null)
const rejectOpen = ref(false)
const rejectReason = ref('')

const isOpen = computed({
  get: () => orderId.value !== null,
  set: open => {
    if (!open)
      orderId.value = null
  },
})

let controller: AbortController | null = null

// Échap ferme le tiroir, sauf si une fenêtre est ouverte par-dessus.
onKeyStroke('Escape', () => {
  if (isOpen.value && !addOpen.value && !refundOpen.value && !rejectOpen.value)
    isOpen.value = false
})

async function load(id: string, silent = false) {
  controller?.abort()

  const current = new AbortController()

  controller = current
  if (!silent)
    loading.value = true
  error.value = null

  try {
    const [loadedOrder, loadedItems, loadedRefunds] = await Promise.all([
      ordersApi.get(id, current.signal),
      ordersApi.items(id, current.signal),
      ordersApi.refunds(id, current.signal),
    ])

    if (current.signal.aborted)
      return

    order.value = loadedOrder
    items.value = loadedItems
    refunds.value = loadedRefunds
    emit('refunds', id, loadedRefunds)
  }
  catch (cause) {
    if (!current.signal.aborted)
      error.value = cause
  }
  finally {
    if (!current.signal.aborted)
      loading.value = false
  }
}

watch(orderId, id => {
  order.value = null
  items.value = []
  refunds.value = []
  actionError.value = ''

  if (id) {
    catalogue.ensure()
    load(id)
  }
}, { immediate: true })

onScopeDispose(() => controller?.abort())

async function reload() {
  if (orderId.value)
    await load(orderId.value, true)

  emit('changed')
}

// Écritures ----------------------------------------------------------------------------

const { submit: changeStatus, pending: changing } = useSubmit(async (statut: string) => {
  actionError.value = ''

  try {
    await ordersApi.update(orderId.value!, { statut })
  }
  catch (cause) {
    actionError.value = explainError(cause)

    return
  }

  toast.success('Statut de la commande mis à jour.')
  await reload()
})

async function askStatus(statut: string) {
  const served = statut === 'servie'

  const accepted = await confirm({
    title: served ? 'Marquer cette commande comme servie ?' : 'Remettre cette commande en cours ?',
    text: served ? 'La commande sera considérée comme servie au client.' : 'La commande redevient modifiable.',
    confirmLabel: 'Enregistrer',
  })

  if (accepted)
    await changeStatus(statut)
}

async function cancelOrder() {
  const accepted = await confirm({
    title: 'Annuler cette commande ?',
    text: 'Les ingrédients réservés sont libérés et la table redevient libre. Cette action est définitive.',
    confirmLabel: 'Annuler la commande',
    cancelLabel: 'Garder la commande',
    danger: true,
  })

  if (accepted)
    await changeStatus('annulee')
}

const { submit: approve, pending: approving } = useSubmit(async (refund: Refund) => {
  actionError.value = ''

  const accepted = await confirm({
    title: 'Approuver ce remboursement ?',
    text: `${formatMoney(refund.montant)} seront comptés comme remboursés sur cette commande.`,
    confirmLabel: 'Approuver',
  })

  if (!accepted)
    return

  try {
    await ordersApi.approveRefund(orderId.value!, refund.id)
  }
  catch (cause) {
    actionError.value = explainError(cause)

    return
  }

  toast.success('Remboursement approuvé.')
  await reload()
})

function askReject(refund: Refund) {
  rejecting.value = refund
  rejectReason.value = ''
  rejectOpen.value = true
}

const { submit: reject, pending: rejectingNow, error: rejectError } = useSubmit(async () => {
  await ordersApi.rejectRefund(orderId.value!, rejecting.value!.id, rejectReason.value.trim())

  toast.success('Demande de remboursement rejetée.')
  rejectOpen.value = false
  await reload()
})

const rejectMessage = computed(() => rejectError.value ? explainError(rejectError.value) : '')

async function afterRefundRequested() {
  await reload()
}

// Présentation -------------------------------------------------------------------------

const tableLabel = computed(() => {
  const id = order.value?.table_id

  return id ? `Table ${props.tableNames.get(id) ?? '—'}` : 'Sans table'
})

const total = computed(() => Number(order.value?.total ?? 0))
const refunded = computed(() => refundedOf(refunds.value))
const waiting = computed(() => pendingOf(refunds.value))
const remaining = computed(() => Math.max(0, total.value - refunded.value - waiting.value))

const editable = computed(() => order.value ? canAddItems(order.value.statut) : false)
const canWrite = computed(() => tenant.can('front_of_house'))
const canRequestRefund = computed(() => tenant.can('cash_desk') && order.value !== null && canRefund(order.value.statut) && remaining.value > 0)
const canDecide = computed(() => tenant.can('management'))

const serviceRate = computed(() => Number(order.value?.taux_service ?? 0))

const LOCKED_NOTES: Record<string, string> = {
  payee: 'Cette commande est payée : son statut ne peut plus changer.',
  annulee: 'Cette commande est annulée : elle ne peut plus être modifiée.',
  paiement_en_attente: 'Le paiement est en cours de traitement : le statut change tout seul à sa confirmation.',
  paiement_a_verifier: 'Le paiement est en cours de traitement : le statut change tout seul à sa confirmation.',
}

const lockedNote = computed(() => LOCKED_NOTES[order.value?.statut ?? ''] ?? '')
</script>

<template>
  <VNavigationDrawer
    v-model="isOpen"
    location="end"
    temporary
    width="480"
    aria-label="Détail de la commande"
  >
    <div class="d-flex align-center justify-space-between pa-4 pb-2">
      <h2 class="text-h6">
        Commande
      </h2>
      <IconBtn
        aria-label="Fermer"
        @click="isOpen = false"
      >
        <VIcon icon="ri-close-line" />
      </IconBtn>
    </div>

    <div class="px-4 pb-6">
      <AppErrorState
        v-if="error"
        :error="error"
        @retry="orderId && load(orderId)"
      />

      <VSkeletonLoader
        v-else-if="loading && !order"
        type="heading, list-item-two-line, list-item-two-line, list-item-two-line"
      />

      <template v-else-if="order">
        <div class="d-flex align-center justify-space-between gap-3 mb-1">
          <OrderStatusChip :status="order.statut" />
          <span class="text-body-2 text-medium-emphasis">{{ formatDateTime(order.created_at) }}</span>
        </div>

        <div class="text-h4 font-weight-semibold mt-3 tabular-nums">
          {{ formatMoney(order.total) }}
        </div>
        <div class="text-body-2 text-medium-emphasis mb-4">
          {{ tableLabel }}
          <template v-if="serviceRate > 0">
            · service {{ serviceRate }} % inclus
          </template>
        </div>

        <VAlert
          v-if="actionError"
          type="error"
          variant="tonal"
          density="compact"
          class="mb-4"
          closable
          @click:close="actionError = ''"
        >
          {{ actionError }}
        </VAlert>

        <VAlert
          v-if="lockedNote"
          type="info"
          variant="tonal"
          density="compact"
          class="mb-4"
        >
          {{ lockedNote }}
        </VAlert>

        <div
          v-if="canWrite && editable"
          class="d-flex flex-wrap gap-2 mb-2"
        >
          <VBtn
            v-if="order.statut === 'en_cours'"
            color="success"
            variant="tonal"
            prepend-icon="ri-restaurant-2-line"
            :loading="changing"
            @click="askStatus('servie')"
          >
            Marquer comme servie
          </VBtn>
          <VBtn
            v-else
            variant="outlined"
            color="secondary"
            prepend-icon="ri-arrow-go-back-line"
            :loading="changing"
            @click="askStatus('en_cours')"
          >
            Remettre en cours
          </VBtn>
          <VBtn
            color="error"
            variant="outlined"
            prepend-icon="ri-close-circle-line"
            :disabled="changing"
            @click="cancelOrder"
          >
            Annuler
          </VBtn>
        </div>

        <!-- Articles -->
        <div class="d-flex align-center justify-space-between mt-6 mb-2">
          <h3 class="text-subtitle-1 font-weight-medium">
            Articles
          </h3>
          <VBtn
            v-if="canWrite && editable"
            size="small"
            variant="tonal"
            prepend-icon="ri-add-line"
            @click="addOpen = true"
          >
            Ajouter
          </VBtn>
        </div>

        <VList
          v-if="items.length"
          density="compact"
          class="pa-0 bg-transparent"
        >
          <VListItem
            v-for="item in items"
            :key="item.id"
            class="px-0"
          >
            <template #prepend>
              <VAvatar
                variant="tonal"
                color="primary"
                rounded
                size="36"
                class="me-3"
              >
                {{ item.quantite }}
              </VAvatar>
            </template>
            <VListItemTitle class="text-wrap">
              {{ catalogue.nameOf(item) }}
            </VListItemTitle>
            <VListItemSubtitle class="text-wrap">
              {{ formatMoney(item.prix_unitaire) }} l'unité<template v-if="item.notes">
                · {{ item.notes }}
              </template>
            </VListItemSubtitle>
            <template #append>
              <span class="font-weight-medium tabular-nums">{{ formatMoney(item.total) }}</span>
            </template>
          </VListItem>
        </VList>
        <p
          v-else
          class="text-body-2 text-medium-emphasis"
        >
          Aucun article pour l'instant.
        </p>

        <!-- Remboursements -->
        <div class="d-flex align-center justify-space-between mt-6 mb-2">
          <h3 class="text-subtitle-1 font-weight-medium">
            Remboursements
          </h3>
          <VBtn
            v-if="canRequestRefund"
            size="small"
            variant="tonal"
            prepend-icon="ri-refund-2-line"
            @click="refundOpen = true"
          >
            Demander
          </VBtn>
        </div>

        <div
          v-if="refunds.length"
          class="d-flex flex-wrap gap-x-4 gap-y-1 text-body-2 mb-3"
        >
          <span>Remboursé : <strong>{{ formatMoney(refunded) }}</strong></span>
          <span v-if="waiting > 0">À traiter : <strong>{{ formatMoney(waiting) }}</strong></span>
          <span class="text-medium-emphasis">Reste : {{ formatMoney(remaining) }}</span>
        </div>

        <VList
          v-if="refunds.length"
          density="compact"
          class="pa-0 bg-transparent"
        >
          <VListItem
            v-for="refund in refunds"
            :key="refund.id"
            class="px-0 refund-row"
          >
            <div class="d-flex align-center justify-space-between gap-3">
              <span class="font-weight-semibold tabular-nums">{{ formatMoney(refund.montant) }}</span>
              <AppStatusChip
                :label="presentRefund(refund.statut).label"
                :tone="presentRefund(refund.statut).tone"
                :icon="presentRefund(refund.statut).icon"
              />
            </div>
            <div
              v-if="refund.raison"
              class="text-body-2 text-wrap"
            >
              {{ refund.raison }}
            </div>
            <div class="text-caption text-medium-emphasis">
              Demandé {{ formatDateTime(refund.created_at) }}<template v-if="refund.traite_le">
                · traité {{ formatDateTime(refund.traite_le) }}
              </template>
              <template v-if="refund.remettre_en_stock">
                · remise en stock
              </template>
            </div>
            <div
              v-if="refund.statut === 'requested' && canDecide"
              class="d-flex gap-2 mt-2"
            >
              <VBtn
                size="small"
                color="success"
                variant="tonal"
                prepend-icon="ri-check-line"
                :loading="approving"
                @click="approve(refund)"
              >
                Approuver
              </VBtn>
              <VBtn
                size="small"
                color="error"
                variant="outlined"
                prepend-icon="ri-close-line"
                @click="askReject(refund)"
              >
                Rejeter
              </VBtn>
            </div>
          </VListItem>
        </VList>
        <p
          v-else
          class="text-body-2 text-medium-emphasis"
        >
          Aucun remboursement sur cette commande.
        </p>
      </template>
    </div>

    <AddItemDialog
      v-model="addOpen"
      :commande-id="orderId"
      :plats="catalogue.plats.value"
      :boissons="catalogue.boissons.value"
      :loading="catalogue.loading.value"
      @added="reload"
    />

    <RefundDialog
      v-model="refundOpen"
      :commande-id="orderId"
      :remaining="remaining"
      :items="items"
      :name-of="catalogue.nameOf"
      @requested="afterRefundRequested"
    />

    <AppFormDialog
      v-model="rejectOpen"
      title="Rejeter la demande"
      :subtitle="rejecting ? `Demande de ${formatMoney(rejecting.montant)}` : undefined"
      icon="ri-close-circle-line"
      submit-label="Rejeter la demande"
      danger
      :loading="rejectingNow"
      :error="rejectMessage"
      @submit="reject"
    >
      <VTextarea
        v-model="rejectReason"
        label="Motif du rejet (facultatif)"
        prepend-inner-icon="ri-file-text-line"
        rows="2"
        auto-grow
        maxlength="500"
        counter
      />
    </AppFormDialog>
  </VNavigationDrawer>
</template>

<style scoped>
.refund-row {
  border-block-end: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  padding-block: 10px;
}

.refund-row:last-child {
  border-block-end: none;
}
</style>
