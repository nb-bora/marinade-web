<script setup lang="ts">
import PaymentAvatar from '../components/PaymentAvatar.vue'
import { presentStatus } from '../statuses'
import { container } from '@/container'
import { useLive } from '@/composables/useLive'
import type { PaymentTransaction } from '@/lib/api/types'
import { formatMoney, formatRelative } from '@/lib/format'

const items = ref<PaymentTransaction[]>([])
const loading = ref(true)
const error = ref<unknown>(null)

async function load() {
  try {
    items.value = (await container.payments.transactions({ limit: 6 })).items
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

// Montant en vert s'il est encaissé, barré s'il n'a pas abouti.
function amountClass(status: string) {
  const tone = presentStatus(status).tone

  if (tone === 'success')
    return 'text-success'

  return tone === 'error' ? 'text-disabled text-decoration-line-through' : 'text-high-emphasis'
}
</script>

<template>
  <VCard class="h-100">
    <VCardItem>
      <VCardTitle>Derniers paiements</VCardTitle>
      <template #append>
        <VBtn
          to="/payments"
          variant="text"
          size="small"
          append-icon="ri-arrow-right-line"
        >
          Tout voir
        </VBtn>
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
        type="list-item-avatar-two-line@4"
      />

      <AppEmptyState
        v-else-if="items.length === 0"
        icon="ri-bank-card-line"
        title="Pas encore de paiement"
        text="Les paiements Mobile Money apparaîtront ici dès leur réception."
      />

      <ul
        v-else
        class="payments"
      >
        <li
          v-for="item in items"
          :key="item.id"
          class="d-flex align-center gap-3"
        >
          <PaymentAvatar :status="item.status" />
          <div class="min-w-0">
            <div class="text-body-1 font-weight-medium">
              {{ presentStatus(item.status).label }}
            </div>
            <div class="text-body-2 text-medium-emphasis text-truncate">
              {{ formatRelative(item.created_at) }}
            </div>
          </div>
          <VSpacer />
          <span
            class="text-body-1 font-weight-medium tabular-nums text-no-wrap"
            :class="amountClass(item.status)"
          >
            {{ presentStatus(item.status).tone === 'success' ? '+' : '' }}{{ formatMoney(item.amount_fcfa, item.currency) }}
          </span>
        </li>
      </ul>
    </VCardText>
  </VCard>
</template>

<style scoped>
.payments {
  display: grid;
  gap: 1.125rem;
  padding: 0;
  list-style: none;
}
</style>
