<script setup lang="ts">
import PaymentStatusChip from '../components/PaymentStatusChip.vue'
import { container } from '@/container'
import { useLive } from '@/composables/useLive'
import type { PaymentTransaction } from '@/lib/api/types'
import { formatRelative } from '@/lib/format'

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

    <AppErrorState
      v-if="error"
      class="mx-4 mb-4"
      :error="error"
      @retry="load"
    />

    <VSkeletonLoader
      v-else-if="loading"
      type="list-item-two-line, list-item-two-line, list-item-two-line"
    />

    <AppEmptyState
      v-else-if="items.length === 0"
      icon="ri-bank-card-line"
      title="Pas encore de paiement"
      text="Les paiements Mobile Money apparaîtront ici dès leur réception."
    />

    <VList
      v-else
      lines="two"
      class="py-0"
    >
      <VListItem
        v-for="item in items"
        :key="item.id"
        to="/payments"
      >
        <VListItemTitle class="font-weight-medium">
          <AppMoney
            :amount="item.amount_fcfa"
            :currency="item.currency"
          />
        </VListItemTitle>
        <VListItemSubtitle>{{ formatRelative(item.created_at) }}</VListItemSubtitle>
        <template #append>
          <PaymentStatusChip :status="item.status" />
        </template>
      </VListItem>
    </VList>
  </VCard>
</template>
