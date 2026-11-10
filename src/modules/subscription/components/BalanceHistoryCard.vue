<script setup lang="ts">
import type { DailyBalance } from '../types'
import { useChartTheme } from '@/composables/useChartTheme'
import { addDays, formatMoney, startOfDay } from '@/lib/format'

const props = defineProps<{
  balances: DailyBalance[]
}>()

const DAYS = 30

const theme = useChartTheme()
const dayLabel = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })

/**
 * Les soldes des 30 derniers JOURS (aujourd'hui compris), pas les 30 derniers soldes : un jour sans
 * solde ouvert ne doit pas faire remonter l'historique plus loin que ce que le titre annonce.
 */
const recent = computed(() => {
  const since = addDays(startOfDay(), -(DAYS - 1)).toLocaleDateString('sv-SE')

  return props.balances.filter(balance => balance.balance_date >= since)
})

const total = computed(() => recent.value.reduce((sum, balance) => sum + balance.used_balance_fcfa, 0))
const average = computed(() => (recent.value.length ? Math.round(total.value / recent.value.length) : 0))

/** Part du plafond cumulé des jours ouverts qui a été consommée. */
const usageRate = computed(() => {
  const ceiling = recent.value.reduce((sum, balance) => sum + balance.initial_balance_fcfa, 0)

  return ceiling > 0 ? Math.round((total.value / ceiling) * 100) : 0
})

const peak = computed(() => recent.value.reduce<DailyBalance | null>(
  (top, balance) => (!top || balance.used_balance_fcfa > top.used_balance_fcfa ? balance : top),
  null,
))

const series = computed(() => [
  { name: 'Consommé', type: 'column', data: recent.value.map(balance => balance.used_balance_fcfa) },
  { name: 'Plafond du jour', type: 'line', data: recent.value.map(balance => balance.initial_balance_fcfa) },
])

const options = computed(() => {
  const t = theme.value

  return {
    chart: { type: 'line', toolbar: { show: false }, parentHeightOffset: 0, fontFamily: t.fontFamily },
    stroke: { width: [0, 2.5], curve: 'stepline', dashArray: [0, 5] },
    plotOptions: { bar: { borderRadius: 6, columnWidth: '50%', borderRadiusApplication: 'end' } },
    colors: [t.primary, t.secondary],
    dataLabels: { enabled: false },
    legend: { position: 'top', horizontalAlign: 'right', labels: { colors: t.text }, markers: { size: 6 } },
    grid: { borderColor: t.grid, strokeDashArray: 6, padding: { top: -10, left: 4, right: 4 } },
    xaxis: {
      categories: recent.value.map(balance => dayLabel.format(new Date(`${balance.balance_date}T00:00:00`))),
      axisBorder: { show: false },
      axisTicks: { show: false },
      tickAmount: Math.min(8, recent.value.length),
      labels: { style: { colors: t.text, fontSize: '12px' }, rotate: 0, hideOverlappingLabels: true },
    },
    yaxis: {
      min: 0,
      tickAmount: 4,
      labels: {
        style: { colors: t.text, fontSize: '12px' },
        formatter: (value: number) => (value >= 1000 ? `${Math.round(value / 1000)} k` : String(Math.round(value))),
      },
    },
    tooltip: { theme: t.mode, shared: true, y: { formatter: (value: number) => formatMoney(value) } },
  }
})
</script>

<template>
  <VCard class="history-card">
    <VCardItem>
      <VCardTitle>Consommation des 30 derniers jours</VCardTitle>
      <VCardSubtitle>Ce qui a été consommé chaque jour, face au plafond</VCardSubtitle>
    </VCardItem>

    <VCardText>
      <AppEmptyState
        v-if="recent.length === 0"
        icon="ri-bar-chart-2-line"
        title="Pas encore d'historique"
        text="Chaque journée où un solde est ouvert apparaîtra ici avec sa consommation."
      />

      <template v-else>
        <VueApexCharts
          type="line"
          height="280"
          :options="options"
          :series="series"
        />

        <dl class="history-stats mt-3">
          <div class="history-stat">
            <dt>Moyenne par jour</dt>
            <dd class="tabular-nums">
              {{ formatMoney(average) }}
            </dd>
          </div>
          <div class="history-stat">
            <dt>Total consommé</dt>
            <dd class="tabular-nums">
              {{ formatMoney(total) }}
              <span class="text-body-2 text-medium-emphasis font-weight-regular">· {{ usageRate }} % du plafond</span>
            </dd>
          </div>
          <div
            v-if="peak && peak.used_balance_fcfa > 0"
            class="history-stat"
          >
            <dt>Pic de consommation</dt>
            <dd class="tabular-nums">
              {{ formatMoney(peak.used_balance_fcfa) }}
              <span class="text-body-2 text-medium-emphasis font-weight-regular">· {{ dayLabel.format(new Date(`${peak.balance_date}T00:00:00`)) }}</span>
            </dd>
          </div>
        </dl>
      </template>
    </VCardText>
  </VCard>
</template>

<style scoped>
.history-card {
  overflow: hidden;
  border: 1px solid rgba(var(--v-border-color), 0.16);
  border-radius: 18px;
  box-shadow: 0 1px 2px rgba(var(--v-theme-on-surface), 0.04) !important;
}

.history-stats {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  margin: 0;
}

.history-stat {
  padding: 10px 14px;
  border-radius: 12px;
  background: rgba(var(--v-theme-on-surface), 0.04);
}

.history-stat dt {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.8125rem;
}

.history-stat dd {
  margin: 2px 0 0;
  font-size: 1.15rem;
  font-weight: 700;
}
</style>
