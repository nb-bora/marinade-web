<!-- Répartition des encaissements du jour par moyen de paiement. -->
<script setup lang="ts">
import { MOYEN_PAIEMENT, compact, money } from '../format'
import type { RestaurantDashboard } from '../types'
import { useChartTheme } from '@/composables/useChartTheme'

const props = defineProps<{ data: RestaurantDashboard | null }>()

const theme = useChartTheme()

const methods = computed(() => props.data?.moyens_paiement ?? [])
const total = computed(() => methods.value.reduce((sum, m) => sum + m.montant, 0))

const palette = computed(() => {
  const t = theme.value

  return [t.primary, t.success, t.info, t.warning, t.error, t.secondary]
})

const series = computed(() => methods.value.map(m => m.montant))

const options = computed(() => {
  const t = theme.value

  return {
    chart: { type: 'donut', parentHeightOffset: 0, fontFamily: t.fontFamily },
    labels: methods.value.map(m => MOYEN_PAIEMENT[m.moyen]?.label ?? m.moyen),
    colors: palette.value,
    legend: { show: false },
    dataLabels: { enabled: false },
    stroke: { width: 3, colors: [t.surface] },
    plotOptions: { pie: { donut: { size: '74%', labels: { show: true, name: { show: true, offsetY: 18, fontSize: '12px', color: t.text }, value: { show: true, offsetY: -14, fontSize: '22px', fontWeight: 600, color: t.textStrong, formatter: () => compact(total.value) }, total: { show: true, showAlways: true, label: props.data?.devise === 'XAF' ? 'FCFA' : (props.data?.devise ?? ''), color: t.text, formatter: () => compact(total.value) } } } } },
    tooltip: { theme: t.mode, y: { formatter: (v: number) => money(v, props.data?.devise ?? 'XAF') } },
  }
})
</script>

<template>
  <VCard
    class="h-100"
    data-tour="dash-payments"
  >
    <VCardItem>
      <template #prepend>
        <VAvatar
          color="info"
          variant="tonal"
          rounded="lg"
        >
          <VIcon icon="ri-bank-card-line" />
        </VAvatar>
      </template>
      <VCardTitle>Moyens de paiement</VCardTitle>
      <VCardSubtitle>Encaissements d'aujourd'hui</VCardSubtitle>
    </VCardItem>

    <VSkeletonLoader
      v-if="!data"
      type="article"
    />

    <VCardText v-else-if="!methods.length">
      <AppEmptyState
        icon="ri-wallet-3-line"
        title="Aucun encaissement"
        text="La répartition apparaît dès le premier paiement de la journée."
      />
    </VCardText>

    <VCardText v-else>
      <VueApexCharts
        type="donut"
        height="190"
        :options="options"
        :series="series"
      />
      <div class="d-flex flex-column gap-2 mt-3">
        <div
          v-for="(m, i) in methods"
          :key="m.moyen"
          class="d-flex align-center gap-2"
        >
          <span
            class="dot"
            :style="{ background: palette[i % palette.length] }"
          />
          <span class="text-body-2 flex-grow-1 text-truncate">{{ MOYEN_PAIEMENT[m.moyen]?.label ?? m.moyen }}</span>
          <span class="text-body-2 text-medium-emphasis">{{ total ? Math.round(100 * m.montant / total) : 0 }} %</span>
          <span class="text-body-2 font-weight-medium tabular-nums text-no-wrap amount">{{ money(m.montant, data.devise) }}</span>
        </div>
      </div>
    </VCardText>
  </VCard>
</template>

<style scoped>
.dot {
  border-radius: 50%;
  flex-shrink: 0;
  height: 10px;
  width: 10px;
}

.amount {
  min-width: 92px;
  text-align: end;
}
</style>
