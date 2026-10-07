<script setup lang="ts">
import PaymentAvatar from '../components/PaymentAvatar.vue'
import { IN_FLIGHT, presentStatus } from '../statuses'
import { container } from '@/container'
import { useLive } from '@/composables/useLive'
import type { PaymentTransaction } from '@/lib/api/types'
import { formatMoney, formatRelative } from '@/lib/format'
import { useToast } from '@/stores/toast.store'

const toast = useToast()
const items = ref<PaymentTransaction[]>([])
const loading = ref(true)
const error = ref<unknown>(null)
const refreshing = ref<string | null>(null)

async function load() {
  try {
    items.value = (await container.payments.transactions({ status: [...IN_FLIGHT], limit: 5 })).items
    error.value = null
  }
  catch (cause) {
    if (items.value.length === 0)
      error.value = cause
  }
  finally {
    loading.value = false
  }
}

useLive(load)

/** Redemande le statut à la passerelle : utile quand la confirmation tarde. */
async function refresh(item: PaymentTransaction) {
  refreshing.value = item.id
  try {
    const updated = await container.payments.refresh(item.id)

    toast.info(`Statut : ${presentStatus(updated.status).label}.`)
    await load()
  }
  catch (cause) {
    toast.error(cause)
  }
  finally {
    refreshing.value = null
  }
}
</script>

<template>
  <VCard class="h-100">
    <VCardItem>
      <VCardTitle>À surveiller</VCardTitle>
      <VCardSubtitle>Paiements en attente de confirmation</VCardSubtitle>
      <template #append>
        <VChip
          v-if="items.length"
          color="warning"
          size="small"
          label
        >
          {{ items.length }}
        </VChip>
      </template>
    </VCardItem>

    <VCardText>
      <AppErrorState
        v-if="error"
        :error="error"
        @retry="load"
      />

      <VSkeletonLoader
        v-else-if="loading"
        type="list-item-avatar-two-line@3"
      />

      <AppEmptyState
        v-else-if="items.length === 0"
        icon="ri-shield-check-line"
        title="Tout est confirmé"
        text="Aucun paiement n'attend de confirmation de la passerelle."
      />

      <ul
        v-else
        class="watchlist"
      >
        <li
          v-for="item in items"
          :key="item.id"
          class="d-flex align-center gap-3"
        >
          <PaymentAvatar :status="item.status" />
          <div class="min-w-0">
            <div class="text-body-1 font-weight-medium tabular-nums">
              {{ formatMoney(item.amount_fcfa, item.currency) }}
            </div>
            <div class="text-body-2 text-medium-emphasis text-truncate">
              {{ presentStatus(item.status).label }} · {{ formatRelative(item.created_at) }}
            </div>
          </div>
          <VSpacer />
          <VBtn
            size="small"
            variant="tonal"
            :loading="refreshing === item.id"
            prepend-icon="ri-refresh-line"
            @click="refresh(item)"
          >
            Actualiser
          </VBtn>
        </li>
      </ul>
    </VCardText>
  </VCard>
</template>

<style scoped>
.watchlist {
  display: grid;
  gap: 1.125rem;
  padding: 0;
  list-style: none;
}
</style>
