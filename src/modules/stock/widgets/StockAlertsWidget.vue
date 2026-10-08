<script setup lang="ts">
import StockGauge from '../components/StockGauge.vue'
import { useStockOverview } from '../composables/useStockOverview'
import { STATE_INFO } from '../labels'
import { useLive } from '@/composables/useLive'

const { rows, counts, loadedOnce, error, reload, refresh } = useStockOverview()

useLive(refresh)

const alerts = computed(() => rows.value
  .filter(row => row.state !== 'ok')
  .sort((a, b) => Number(a.state === 'alerte') - Number(b.state === 'alerte') || Number(a.stock.disponible) - Number(b.stock.disponible))
  .slice(0, 5))

const total = computed(() => counts.value.alerte + counts.value.rupture)
</script>

<template>
  <VCard class="h-100">
    <VCardItem>
      <VCardTitle>Alertes de stock</VCardTitle>
      <VCardSubtitle>Composants en rupture ou sous leur seuil</VCardSubtitle>
      <template #append>
        <VChip
          v-if="total"
          :color="counts.rupture ? 'error' : 'warning'"
          size="small"
          label
        >
          {{ total }}
        </VChip>
      </template>
    </VCardItem>

    <VCardText>
      <AppErrorState
        v-if="error && !loadedOnce"
        :error="error"
        @retry="reload"
      />

      <VSkeletonLoader
        v-else-if="!loadedOnce"
        type="list-item-two-line@3"
      />

      <AppEmptyState
        v-else-if="alerts.length === 0"
        icon="ri-shield-check-line"
        title="Stock en bon état"
        text="Aucun composant n'est en rupture ni sous son seuil d'alerte."
      />

      <template v-else>
        <ul class="alerts">
          <li
            v-for="row in alerts"
            :key="row.composant.id"
          >
            <div class="d-flex align-center gap-2 mb-1">
              <VIcon
                :icon="STATE_INFO[row.state].icon"
                :color="STATE_INFO[row.state].color"
                size="18"
              />
              <span class="text-body-1 font-weight-medium text-truncate">{{ row.composant.nom }}</span>
              <VSpacer />
              <span class="text-caption text-medium-emphasis text-no-wrap">{{ STATE_INFO[row.state].label }}</span>
            </div>
            <StockGauge
              :stock="row.stock"
              :state="row.state"
              :unit="row.composant.stock_unite"
            />
          </li>
        </ul>
        <VBtn
          variant="text"
          color="primary"
          to="/stock"
          append-icon="ri-arrow-right-line"
          class="mt-3"
        >
          Voir tout le stock
        </VBtn>
      </template>
    </VCardText>
  </VCard>
</template>

<style scoped>
.alerts {
  display: grid;
  gap: 1rem;
  padding: 0;
  list-style: none;
}
</style>
