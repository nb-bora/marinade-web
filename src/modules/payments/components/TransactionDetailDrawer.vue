<!--
  Fiche d'une transaction, en tiroir latéral : montant et statut en tête, frais et net, références
  copiables, historique des événements de la passerelle. Une transaction encore en route peut être
  redemandée à la passerelle.
-->
<script setup lang="ts">
import { onKeyStroke } from '@vueuse/core'
import { isInFlight, presentStatus } from '../statuses'
import PaymentStatusChip from './PaymentStatusChip.vue'
import { container } from '@/container'
import { useConfirm } from '@/composables/useConfirm'
import { useSubmit } from '@/composables/useSubmit'
import type { PaymentTransactionDetail } from '@/lib/api/types'
import { formatDateTime } from '@/lib/format'
import { useToast } from '@/stores/toast.store'

const emit = defineEmits<{ changed: [] }>()

/** Identifiant de la transaction affichée ; `null` ferme le tiroir. */
const transactionId = defineModel<string | null>({ required: true })

const toast = useToast()
const confirm = useConfirm()
const detail = ref<PaymentTransactionDetail | null>(null)
const loading = ref(false)
const error = ref<unknown>(null)

const isOpen = computed({
  get: () => transactionId.value !== null,
  set: open => {
    if (!open)
      transactionId.value = null
  },
})

let controller: AbortController | null = null

// Échap ferme le tiroir, comme n'importe quel panneau latéral.
onKeyStroke('Escape', () => {
  if (isOpen.value)
    isOpen.value = false
})

async function load(id: string) {
  controller?.abort()

  const current = new AbortController()

  controller = current
  loading.value = true
  error.value = null

  try {
    const result = await container.payments.detail(id, current.signal)

    if (!current.signal.aborted)
      detail.value = result
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

const { submit: refreshStatus, pending: refreshing, message: refreshMessage, reset: refreshReset } = useSubmit(async () => {
  const id = transactionId.value

  if (!id)
    return

  if (!(await confirm({
    title: 'Actualiser le statut du paiement ?',
    text: 'Le statut sera redemandé à la passerelle de paiement et enregistré.',
    confirmLabel: 'Enregistrer',
  })))
    return

  await container.payments.refresh(id)

  // L'utilisateur a pu fermer le tiroir ou changer de transaction pendant l'appel.
  if (transactionId.value === id)
    await load(id)

  toast.success('Statut actualisé auprès de la passerelle.')
  emit('changed')
})

watch(transactionId, id => {
  detail.value = null
  refreshReset()

  if (id) {
    load(id)

    return
  }

  // Tiroir fermé : plus rien à attendre, et aucun état « chargement » ne doit survivre à la fermeture.
  controller?.abort()
  loading.value = false
  error.value = null
}, { immediate: true })

onScopeDispose(() => controller?.abort())

async function copy(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.info(`${what} copié.`)
  }
  catch {
    toast.warning('Copie impossible : sélectionnez le texte à la main.')
  }
}

const status = computed(() => detail.value ? presentStatus(detail.value.status) : null)

/** Origine du paiement : une commande du restaurant ou un abonnement Marinade. */
const source = computed(() => {
  if (detail.value?.commande_id)
    return 'Commande du restaurant'

  return detail.value?.subscription_id ? 'Abonnement Marinade' : null
})

/** Lien de paiement de la passerelle : on ne l'ouvre que s'il est en https, jamais un autre schéma. */
const checkoutUrl = computed(() => {
  const url = detail.value?.checkout_url

  return url && /^https:\/\//i.test(url) ? url : null
})

const feeShare = computed(() => {
  const amount = Number(detail.value?.amount_fcfa ?? 0)
  const fees = Number(detail.value?.fees_fcfa ?? 0)

  return amount > 0 ? Math.round((fees / amount) * 1000) / 10 : 0
})
</script>

<template>
  <VNavigationDrawer
    v-model="isOpen"
    location="end"
    temporary
    width="440"
    aria-label="Détail de la transaction"
  >
    <div class="d-flex align-center justify-space-between pa-4 pb-2">
      <h2 class="text-h6">
        Transaction
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
        @retry="transactionId && load(transactionId)"
      />

      <VSkeletonLoader
        v-else-if="loading && !detail"
        type="heading, list-item-two-line, list-item-two-line, list-item-two-line"
      />

      <template v-else-if="detail">
        <section class="amount-card">
          <div class="d-flex align-center justify-space-between gap-3">
            <PaymentStatusChip :status="detail.status" />
            <span class="amount-card__date">{{ formatDateTime(detail.created_at) }}</span>
          </div>
          <div class="amount-card__value tabular-nums">
            <AppMoney
              :amount="detail.amount_fcfa"
              :currency="detail.currency"
            />
          </div>
          <div
            v-if="source"
            class="amount-card__source"
          >
            <VIcon
              :icon="detail.commande_id ? 'ri-restaurant-2-line' : 'ri-vip-crown-line'"
              size="16"
            />
            {{ source }}
          </div>
        </section>

        <VAlert
          v-if="detail.failure_reason"
          type="error"
          variant="tonal"
          density="compact"
          class="mt-4"
        >
          {{ detail.failure_reason }}
        </VAlert>

        <VAlert
          v-if="isInFlight(detail.status)"
          type="info"
          variant="tonal"
          density="compact"
          class="mt-4"
        >
          <div class="d-flex flex-wrap align-center justify-space-between gap-2">
            <span>{{ status?.label }} : la confirmation n'est pas encore arrivée.</span>
            <VBtn
              size="small"
              variant="outlined"
              :loading="refreshing"
              prepend-icon="ri-refresh-line"
              @click="refreshStatus"
            >
              Actualiser
            </VBtn>
          </div>
        </VAlert>

        <VAlert
          v-if="refreshMessage"
          type="error"
          variant="tonal"
          density="compact"
          class="mt-4"
        >
          {{ refreshMessage }}
        </VAlert>

        <VBtn
          v-if="checkoutUrl && isInFlight(detail.status)"
          :href="checkoutUrl"
          target="_blank"
          rel="noopener noreferrer"
          variant="tonal"
          block
          class="mt-4"
          prepend-icon="ri-external-link-line"
        >
          Ouvrir le lien de paiement
        </VBtn>

        <dl class="breakdown mt-4">
          <div>
            <dt>Montant payé</dt>
            <dd class="tabular-nums">
              <AppMoney
                :amount="detail.amount_fcfa"
                :currency="detail.currency"
              />
            </dd>
          </div>
          <div>
            <dt>Frais de la passerelle <span v-if="feeShare > 0">({{ feeShare }} %)</span></dt>
            <dd class="tabular-nums text-medium-emphasis">
              − <AppMoney
                :amount="detail.fees_fcfa"
                :currency="detail.currency"
              />
            </dd>
          </div>
          <div class="breakdown__net">
            <dt>Net à recevoir</dt>
            <dd class="tabular-nums">
              <AppMoney
                :amount="detail.net_amount_fcfa"
                :currency="detail.currency"
              />
            </dd>
          </div>
        </dl>

        <VList
          density="compact"
          class="pa-0 mt-2 bg-transparent"
        >
          <VListItem class="px-0">
            <VListItemSubtitle>Référence</VListItemSubtitle>
            <VListItemTitle class="text-wrap font-mono">
              {{ detail.reference }}
              <IconBtn
                size="x-small"
                aria-label="Copier la référence"
                @click="copy(detail.reference, 'Référence')"
              >
                <VIcon
                  icon="ri-file-copy-line"
                  size="16"
                />
              </IconBtn>
            </VListItemTitle>
          </VListItem>
          <VListItem
            v-if="detail.provider_transaction_id"
            class="px-0"
          >
            <VListItemSubtitle>Identifiant chez la passerelle</VListItemSubtitle>
            <VListItemTitle class="text-wrap font-mono">
              {{ detail.provider_transaction_id }}
              <IconBtn
                size="x-small"
                aria-label="Copier l'identifiant chez la passerelle"
                @click="copy(detail.provider_transaction_id ?? '', 'Identifiant')"
              >
                <VIcon
                  icon="ri-file-copy-line"
                  size="16"
                />
              </IconBtn>
            </VListItemTitle>
          </VListItem>
          <VListItem
            v-if="detail.completed_at"
            class="px-0"
          >
            <VListItemSubtitle>Terminée le</VListItemSubtitle>
            <VListItemTitle>{{ formatDateTime(detail.completed_at) }}</VListItemTitle>
          </VListItem>
        </VList>

        <h3 class="text-subtitle-1 font-weight-medium mt-6 mb-2">
          Historique
        </h3>
        <VTimeline
          v-if="detail.events.length"
          density="compact"
          side="end"
          align="start"
          truncate-line="both"
        >
          <VTimelineItem
            v-for="(event, index) in detail.events"
            :key="`${event.received_at}-${index}`"
            :dot-color="presentStatus(event.status).tone === 'neutral' ? 'secondary' : presentStatus(event.status).tone"
            size="x-small"
          >
            <div class="font-weight-medium">
              {{ presentStatus(event.status).label }}
            </div>
            <div class="text-caption text-medium-emphasis">
              {{ formatDateTime(event.received_at) }}
            </div>
          </VTimelineItem>
        </VTimeline>
        <p
          v-else
          class="text-body-2 text-medium-emphasis"
        >
          Aucun événement reçu pour l'instant.
        </p>
      </template>
    </div>
  </VNavigationDrawer>
</template>

<style scoped>
.font-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.8125rem;
  word-break: break-all;
}

.amount-card {
  position: relative;
  overflow: hidden;
  padding: 16px 18px 18px;
  border: 1px solid rgba(var(--v-theme-primary), 0.22);
  border-radius: 18px;
  background:
    radial-gradient(circle at 12% 0%, rgba(var(--v-theme-primary), 0.2), transparent 60%),
    linear-gradient(135deg, rgba(var(--v-theme-primary), 0.1), rgba(var(--v-theme-primary), 0.02) 70%),
    rgb(var(--v-theme-surface));
}

.amount-card__date {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.8125rem;
}

.amount-card__value {
  margin-block: 12px 4px;
  font-size: 2rem;
  font-weight: 800;
  line-height: 1.15;
}

.amount-card__source {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.8125rem;
  font-weight: 500;
}

.breakdown {
  padding: 4px 16px;
  border: 1px solid rgba(var(--v-border-color), 0.16);
  border-radius: 16px;
}

.breakdown > div {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding-block: 10px;
}

.breakdown > div + div {
  border-block-start: 1px solid rgba(var(--v-border-color), 0.3);
}

.breakdown dt {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.875rem;
}

.breakdown dd {
  margin: 0;
  font-weight: 600;
  white-space: nowrap;
}

.breakdown__net dt {
  color: rgb(var(--v-theme-on-surface));
  font-weight: 600;
}

.breakdown__net dd {
  color: rgb(var(--v-theme-success));
  font-size: 1.125rem;
  font-weight: 700;
}
</style>
