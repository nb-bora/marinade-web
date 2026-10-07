<script setup lang="ts">
import { onKeyStroke } from '@vueuse/core'
import { isInFlight, presentStatus } from '../statuses'
import PaymentStatusChip from './PaymentStatusChip.vue'
import { container } from '@/container'
import { useSubmit } from '@/composables/useSubmit'
import type { PaymentTransactionDetail } from '@/lib/api/types'
import { formatDateTime } from '@/lib/format'
import { useToast } from '@/stores/toast.store'

const emit = defineEmits<{ changed: [] }>()

/** Identifiant de la transaction affichée ; `null` ferme le tiroir. */
const transactionId = defineModel<string | null>({ required: true })

const toast = useToast()
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

watch(transactionId, id => {
  detail.value = null

  if (id)
    load(id)
}, { immediate: true })

onScopeDispose(() => controller?.abort())

const { submit: refreshStatus, pending: refreshing } = useSubmit(async () => {
  if (!transactionId.value)
    return

  await container.payments.refresh(transactionId.value)
  await load(transactionId.value)
  toast.success('Statut actualisé auprès de la passerelle.')
  emit('changed')
})

async function copyReference() {
  if (!detail.value)
    return

  try {
    await navigator.clipboard.writeText(detail.value.reference)
    toast.info('Référence copiée.')
  }
  catch {
    toast.warning('Copie impossible : sélectionnez la référence à la main.')
  }
}

const status = computed(() => detail.value ? presentStatus(detail.value.status) : null)
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
        <div class="d-flex align-center justify-space-between gap-3 mb-1">
          <PaymentStatusChip :status="detail.status" />
          <span class="text-body-2 text-medium-emphasis">{{ formatDateTime(detail.created_at) }}</span>
        </div>

        <div class="text-h4 font-weight-semibold my-3">
          <AppMoney
            :amount="detail.amount_fcfa"
            :currency="detail.currency"
          />
        </div>

        <VAlert
          v-if="detail.failure_reason"
          type="error"
          variant="tonal"
          density="compact"
          class="mb-4"
        >
          {{ detail.failure_reason }}
        </VAlert>

        <VAlert
          v-if="isInFlight(detail.status)"
          type="info"
          variant="tonal"
          density="compact"
          class="mb-4"
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

        <VList
          density="compact"
          class="pa-0 bg-transparent"
        >
          <VListItem class="px-0">
            <VListItemSubtitle>Référence</VListItemSubtitle>
            <VListItemTitle class="text-wrap font-mono">
              {{ detail.reference }}
              <IconBtn
                size="x-small"
                aria-label="Copier la référence"
                @click="copyReference"
              >
                <VIcon
                  icon="ri-file-copy-line"
                  size="16"
                />
              </IconBtn>
            </VListItemTitle>
          </VListItem>
          <VListItem class="px-0">
            <VListItemSubtitle>Frais de la passerelle</VListItemSubtitle>
            <VListItemTitle>
              <AppMoney
                :amount="detail.fees_fcfa"
                :currency="detail.currency"
              />
            </VListItemTitle>
          </VListItem>
          <VListItem class="px-0">
            <VListItemSubtitle>Net à recevoir</VListItemSubtitle>
            <VListItemTitle class="font-weight-semibold">
              <AppMoney
                :amount="detail.net_amount_fcfa"
                :currency="detail.currency"
              />
            </VListItemTitle>
          </VListItem>
          <VListItem
            v-if="detail.completed_at"
            class="px-0"
          >
            <VListItemSubtitle>Terminée le</VListItemSubtitle>
            <VListItemTitle>{{ formatDateTime(detail.completed_at) }}</VListItemTitle>
          </VListItem>
          <VListItem
            v-if="detail.provider_transaction_id"
            class="px-0"
          >
            <VListItemSubtitle>Identifiant chez la passerelle</VListItemSubtitle>
            <VListItemTitle class="text-wrap font-mono">
              {{ detail.provider_transaction_id }}
            </VListItemTitle>
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
</style>
