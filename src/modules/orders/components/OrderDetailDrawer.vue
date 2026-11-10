<!--
  Fiche d'une commande, en tiroir latéral : montant et statut, actions autorisées (servir, remettre en
  cours, annuler), lignes avec détail du total, et remboursements (demande, approbation, rejet).
  Une seule requête charge la commande avec ses lignes et ses remboursements.
-->
<script setup lang="ts">
import { onKeyStroke } from '@vueuse/core'
import { ordersApi } from '../api'
import { useCatalogue } from '../composables/useCatalogue'
import { canAddItems, canRefund, explainError, presentRefund } from '../labels'
import { pendingOf, refundableOf, refundedOf, roundMoney } from '../refunds'
import type { Commande, CommandeItem, Refund } from '../types'
import AddItemDialog from './AddItemDialog.vue'
import OrderStatusChip from './OrderStatusChip.vue'
import RefundDialog from './RefundDialog.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useSubmit } from '@/composables/useSubmit'
import { formatDateTime, formatMoney, formatRelative } from '@/lib/format'
import { useTenantStore } from '@/stores/tenant.store'
import { useToast } from '@/stores/toast.store'

const props = defineProps<{
  tableNames: Map<string, string>
}>()

const emit = defineEmits<{
  changed: []
}>()

/** Identifiant de la commande affichée ; `null` ferme le tiroir. */
const orderId = defineModel<string | null>({ required: true })

const tenant = useTenantStore()
const toast = useToast()
const confirm = useConfirm()
const catalogue = useCatalogue()

const order = ref<Commande | null>(null)
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
    if (!tenant.currentId)
      throw new Error('Aucun restaurant sélectionné.')

    const loaded = await ordersApi.get(tenant.currentId, id, current.signal)

    if (!current.signal.aborted)
      order.value = loaded
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
  actionError.value = ''

  if (id) {
    catalogue.ensure()
    load(id)
  }
}, { immediate: true })

// À l'ouverture de l'ajout d'article, la carte est relue : un plat a pu devenir indisponible.
watch(addOpen, open => {
  if (open)
    catalogue.ensure(true)
})

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

  try {
    await ordersApi.approveRefund(tenant.currentId!, orderId.value!, refund.id)
  }
  catch (cause) {
    actionError.value = explainError(cause)

    return
  }

  toast.success('Remboursement approuvé.')
  await reload()
})

// La confirmation se pose avant l'envoi : le bouton ne tourne pas pendant que la fenêtre est ouverte.
async function askApprove(refund: Refund) {
  const accepted = await confirm({
    title: 'Approuver ce remboursement ?',
    text: `${formatMoney(refund.montant)} seront comptés comme remboursés sur cette commande.`,
    confirmLabel: 'Approuver',
  })

  if (accepted)
    await approve(refund)
}

function askReject(refund: Refund) {
  rejecting.value = refund
  rejectReason.value = ''
  rejectOpen.value = true
}

const { submit: reject, pending: rejectingNow, error: rejectError } = useSubmit(async () => {
  await ordersApi.rejectRefund(tenant.currentId!, orderId.value!, rejecting.value!.id, rejectReason.value.trim())

  toast.success('Demande de remboursement rejetée.')
  rejectOpen.value = false
  await reload()
})

const rejectMessage = computed(() => rejectError.value ? explainError(rejectError.value) : '')

// Présentation -------------------------------------------------------------------------

const tableLabel = computed(() => {
  const id = order.value?.table_id

  return id ? `Table ${props.tableNames.get(id) ?? '—'}` : 'Sans table'
})

const items = computed(() => order.value?.items ?? [])

/** Les plus récentes d'abord : la dernière décision à prendre est en haut. */
const refunds = computed(() => [...(order.value?.remboursements ?? [])]
  .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)))

const total = computed(() => Number(order.value?.total ?? 0))
const refunded = computed(() => refundedOf(refunds.value))
const waiting = computed(() => pendingOf(refunds.value))
const remaining = computed(() => refundableOf(total.value, refunds.value))

/** Part du total déjà remboursée (approuvée) ou réservée par une demande en attente, pour la jauge. */
const refundedPercent = computed(() => (total.value > 0 ? Math.min(100, (refunded.value / total.value) * 100) : 0))
const waitingPercent = computed(() => (total.value > 0 ? Math.min(100 - refundedPercent.value, (waiting.value / total.value) * 100) : 0))

/** Lignes déjà remboursées par une demande approuvée : le back refuse de les rembourser deux fois. */
const refundedItemIds = computed(() => new Set(refunds.value
  .filter(refund => refund.statut === 'approved')
  .flatMap(refund => refund.item_ids)))

const subtotal = computed(() => roundMoney(items.value.reduce((sum, item) => sum + Number(item.total ?? 0), 0)))
const serviceRate = computed(() => Number(order.value?.taux_service ?? 0))
const serviceAmount = computed(() => roundMoney(total.value - subtotal.value))

const editable = computed(() => order.value ? canAddItems(order.value.statut) : false)
const canWrite = computed(() => tenant.can('front_of_house'))
const canRequestRefund = computed(() => tenant.can('cash_desk') && order.value !== null && canRefund(order.value.statut) && remaining.value > 0)
const canDecide = computed(() => tenant.can('management'))

const refundItemNames = (refund: Refund) => refund.item_ids
  .map(id => items.value.find(item => item.id === id))
  .filter((item): item is CommandeItem => item !== undefined)
  .map(item => catalogue.nameOf(item))
  .join(', ')

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
    <div class="d-flex align-center justify-space-between gap-3 pa-4 pb-2">
      <div class="min-w-0">
        <h2 class="text-h6">
          Commande
        </h2>
        <div
          v-if="orderId"
          class="text-caption text-medium-emphasis text-truncate"
        >
          N° {{ orderId.slice(0, 8).toUpperCase() }}
        </div>
      </div>
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
        <!-- Résumé : le montant d'abord, sur le dégradé de la marque -->
        <section class="order-summary">
          <div class="d-flex align-center justify-space-between gap-3">
            <OrderStatusChip
              class="order-summary__status"
              :status="order.statut"
            />
            <span
              class="text-body-2 order-summary__muted"
              :title="formatDateTime(order.created_at)"
            >{{ formatRelative(order.created_at) }}</span>
          </div>
          <div class="order-summary__amount tabular-nums">
            {{ formatMoney(order.total) }}
          </div>
          <div class="text-body-2 order-summary__muted">
            {{ tableLabel }}
            <template v-if="serviceRate > 0">
              · service {{ serviceRate }} % inclus
            </template>
          </div>
        </section>

        <VAlert
          v-if="actionError"
          type="error"
          variant="tonal"
          density="compact"
          class="mt-4"
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
          class="mt-4"
        >
          {{ lockedNote }}
        </VAlert>

        <div
          v-if="canWrite && editable"
          class="d-flex flex-wrap gap-2 mt-4"
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
            <span
              v-if="items.length"
              class="text-medium-emphasis font-weight-regular"
            >({{ items.length }})</span>
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

        <ul
          v-if="items.length"
          class="order-lines"
        >
          <li
            v-for="item in items"
            :key="item.id"
            class="order-line"
            :class="{ 'order-line--refunded': refundedItemIds.has(item.id) }"
          >
            <VAvatar
              variant="tonal"
              color="primary"
              rounded
              size="36"
              class="tabular-nums"
            >
              {{ item.quantite }}
            </VAvatar>
            <div class="min-w-0 flex-grow-1">
              <div class="text-body-1 text-wrap order-line__name">
                {{ catalogue.nameOf(item) }}
                <VChip
                  v-if="refundedItemIds.has(item.id)"
                  size="x-small"
                  color="secondary"
                  variant="tonal"
                  label
                  class="ms-1"
                >
                  Remboursé
                </VChip>
              </div>
              <div class="text-body-2 text-medium-emphasis text-wrap">
                {{ formatMoney(item.prix_unitaire) }} l'unité<template v-if="item.notes">
                  · {{ item.notes }}
                </template>
              </div>
            </div>
            <span class="font-weight-medium tabular-nums text-no-wrap">{{ formatMoney(item.total) }}</span>
          </li>
        </ul>
        <p
          v-else
          class="text-body-2 text-medium-emphasis"
        >
          Aucun article pour l'instant.
        </p>

        <dl
          v-if="items.length && serviceRate > 0"
          class="order-totals"
        >
          <div>
            <dt>Sous-total</dt>
            <dd class="tabular-nums">
              {{ formatMoney(subtotal) }}
            </dd>
          </div>
          <div>
            <dt>Service ({{ serviceRate }} %)</dt>
            <dd class="tabular-nums">
              {{ formatMoney(serviceAmount) }}
            </dd>
          </div>
          <div class="order-totals__total">
            <dt>Total</dt>
            <dd class="tabular-nums">
              {{ formatMoney(order.total) }}
            </dd>
          </div>
        </dl>

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
          class="refund-recap mb-3"
        >
          <div
            class="refund-recap__bar"
            role="img"
            :aria-label="`${formatMoney(refunded)} remboursés, ${formatMoney(waiting)} à traiter, sur ${formatMoney(total)}`"
          >
            <span
              class="refund-recap__done"
              :style="{ inlineSize: `${refundedPercent}%` }"
            />
            <span
              class="refund-recap__wait"
              :style="{ inlineSize: `${waitingPercent}%` }"
            />
          </div>
          <div class="d-flex flex-wrap gap-x-4 gap-y-1 text-body-2 mt-2">
            <span>Remboursé : <strong class="tabular-nums">{{ formatMoney(refunded) }}</strong></span>
            <span v-if="waiting > 0">À traiter : <strong class="tabular-nums">{{ formatMoney(waiting) }}</strong></span>
            <span class="text-medium-emphasis tabular-nums">Reste : {{ formatMoney(remaining) }}</span>
          </div>
        </div>

        <ul
          v-if="refunds.length"
          class="refund-list"
        >
          <li
            v-for="refund in refunds"
            :key="refund.id"
            class="refund-row"
            :class="{ 'refund-row--pending': refund.statut === 'requested' }"
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
              class="text-body-2 text-wrap mt-1"
            >
              {{ refund.raison }}
            </div>
            <div
              v-if="refund.item_ids.length && refundItemNames(refund)"
              class="text-body-2 text-medium-emphasis text-wrap"
            >
              Articles : {{ refundItemNames(refund) }}
            </div>
            <div class="text-caption text-medium-emphasis mt-1">
              Demandé {{ formatDateTime(refund.created_at) }}<template v-if="refund.traite_le">
                · traité {{ formatDateTime(refund.traite_le) }}
              </template>
              <template v-if="refund.remettre_en_stock">
                · remise en stock
              </template>
            </div>
            <div
              v-if="refund.statut === 'requested' && canDecide"
              class="d-flex gap-2 mt-3"
            >
              <VBtn
                size="small"
                color="success"
                variant="tonal"
                prepend-icon="ri-check-line"
                :loading="approving"
                @click="askApprove(refund)"
              >
                Approuver
              </VBtn>
              <VBtn
                size="small"
                color="error"
                variant="outlined"
                prepend-icon="ri-close-line"
                :disabled="approving"
                @click="askReject(refund)"
              >
                Rejeter
              </VBtn>
            </div>
            <div
              v-else-if="refund.statut === 'requested'"
              class="text-caption text-warning mt-2"
            >
              En attente de la décision d'un manager.
            </div>
          </li>
        </ul>
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
      :failed="catalogue.error.value !== null"
      @added="reload"
    />

    <RefundDialog
      v-model="refundOpen"
      :commande-id="orderId"
      :remaining="remaining"
      :items="items"
      :refunded-item-ids="refundedItemIds"
      :name-of="catalogue.nameOf"
      @requested="reload"
    />

    <!-- La fenêtre vaut confirmation : pas de seconde demande (qui parlerait de « supprimer »). -->
    <AppFormDialog
      v-model="rejectOpen"
      title="Rejeter la demande"
      :subtitle="rejecting ? `Demande de ${formatMoney(rejecting.montant)}` : undefined"
      icon="ri-close-circle-line"
      submit-label="Rejeter la demande"
      danger
      :confirm="false"
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
.order-summary {
  padding: 16px 18px 18px;
  border-radius: 18px;
  background:
    radial-gradient(circle at 92% -20%, rgba(255, 255, 255, 0.3), transparent 60%),
    linear-gradient(135deg, rgb(var(--v-theme-primary)), #b8470a);
  color: #fff;
}

.order-summary__status {
  border-radius: 6px;
  background: rgb(var(--v-theme-surface));
}

.order-summary__muted {
  color: rgba(255, 255, 255, 0.85);
}

.order-summary__amount {
  margin-block: 14px 2px;
  font-size: 2rem;
  font-weight: 700;
  line-height: 1.15;
}

.order-lines,
.refund-list {
  padding: 0;
  margin: 0;
  list-style: none;
}

.order-line {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-block: 10px;
  border-block-end: 1px solid rgba(var(--v-border-color), 0.3);
}

.order-line:last-child {
  border-block-end: none;
}

.order-line--refunded .order-line__name {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

.order-totals {
  display: grid;
  gap: 6px;
  margin: 8px 0 0;
  padding: 12px 14px;
  border-radius: 12px;
  background: rgba(var(--v-theme-on-surface), 0.04);
  font-size: 0.875rem;
}

.order-totals > div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.order-totals dd {
  margin: 0;
}

.order-totals__total {
  padding-block-start: 6px;
  border-block-start: 1px solid rgba(var(--v-border-color), 0.35);
  font-size: 1rem;
  font-weight: 700;
}

/* Jauge : la part remboursée (vert) puis la part en attente de décision (orange) sur le total. */
.refund-recap__bar {
  display: flex;
  overflow: hidden;
  block-size: 8px;
  border-radius: 999px;
  background: rgba(var(--v-theme-on-surface), 0.1);
}

.refund-recap__done {
  background: rgb(var(--v-theme-success));
}

.refund-recap__wait {
  background: rgb(var(--v-theme-warning));
}

.refund-row {
  padding: 12px 14px;
  margin-block-end: 8px;
  border: 1px solid rgba(var(--v-border-color), 0.25);
  border-radius: 14px;
}

.refund-row--pending {
  border-color: rgba(var(--v-theme-warning), 0.6);
  background: rgba(var(--v-theme-warning), 0.06);
}
</style>
