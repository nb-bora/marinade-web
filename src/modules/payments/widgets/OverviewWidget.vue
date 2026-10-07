<script setup lang="ts">
import { successRate, usePaymentInsights } from '../composables/usePaymentInsights'
import { formatMoney } from '@/lib/format'

const { week, loading, error, reload } = usePaymentInsights()

const rate = computed(() => successRate(week.value))
</script>

<template>
  <VCard class="h-100">
    <VCardItem>
      <VCardTitle>Encaissements</VCardTitle>
      <VCardSubtitle>
        <span class="font-weight-medium text-high-emphasis">7 derniers jours</span>
        · mis à jour en continu
      </VCardSubtitle>
      <template #append>
        <VBtn
          to="/payments"
          variant="text"
          size="small"
          append-icon="ri-arrow-right-line"
        >
          Détails
        </VBtn>
      </template>
    </VCardItem>

    <VCardText class="pt-4">
      <AppErrorState
        v-if="error"
        :error="error"
        @retry="reload"
      />
      <VRow v-else>
        <VCol
          cols="6"
          md="3"
        >
          <AppStatTile
            label="Encaissé"
            icon="ri-money-dollar-circle-line"
            color="success"
            :loading="loading"
            :value="formatMoney(week?.collected_fcfa)"
          />
        </VCol>
        <VCol
          cols="6"
          md="3"
        >
          <AppStatTile
            label="Net à recevoir"
            icon="ri-wallet-3-line"
            color="primary"
            :loading="loading"
            :value="formatMoney(week?.net_collected_fcfa)"
          />
        </VCol>
        <VCol
          cols="6"
          md="3"
        >
          <AppStatTile
            label="Transactions"
            icon="ri-exchange-funds-line"
            color="info"
            :loading="loading"
            :value="String(week?.transactions ?? 0)"
          />
        </VCol>
        <VCol
          cols="6"
          md="3"
        >
          <AppStatTile
            label="Réussite"
            icon="ri-checkbox-circle-line"
            color="warning"
            :loading="loading"
            :value="rate === null ? '—' : `${rate} %`"
          />
        </VCol>
      </VRow>
    </VCardText>
  </VCard>
</template>
