<script setup lang="ts">
import type { DailyBalance } from '../types'
import { useChartTheme } from '@/composables/useChartTheme'
import { formatMoney } from '@/lib/format'

const props = defineProps<{
  balances: DailyBalance[]
}>()

const DAYS = 30

const theme = useChartTheme()
const dayLabel = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })

const recent = computed(() => props.balances.slice(-DAYS))

const total = computed(() => recent.value.reduce((sum, balance) => sum + balance.used_balance_fcfa, 0))
const average = computed(() => (recent.value.length ? Math.round(total.value / recent.value.length) : 0))

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
  <VCard>
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

        <div class="d-flex flex-wrap align-center gap-x-6 gap-y-2 mt-2">
          <div class="d-flex align-center gap-3">
            <span class="text-h5 font-weight-semibold tabular-nums">{{ formatMoney(average) }}</span>
            <span class="text-body-2 text-medium-emphasis">consommés en moyenne par jour</span>
          </div>
          <VSpacer />
          <span
            v-if="peak && peak.used_balance_fcfa > 0"
            class="text-body-2"
          >
            Pic : <strong class="text-primary">{{ dayLabel.format(new Date(`${peak.balance_date}T00:00:00`)) }}</strong>
            ({{ formatMoney(peak.used_balance_fcfa) }})
          </span>
        </div>
      </template>
    </VCardText>
  </VCard>
</template>
