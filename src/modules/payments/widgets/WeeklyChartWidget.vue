<script setup lang="ts">
import { usePaymentInsights } from '../composables/usePaymentInsights'
import { useChartTheme } from '@/composables/useChartTheme'
import { formatMoney } from '@/lib/format'

const { days, currency, loading } = usePaymentInsights()
const theme = useChartTheme()

const weekday = new Intl.DateTimeFormat('fr-FR', { weekday: 'short' })
const longDay = new Intl.DateTimeFormat('fr-FR', { weekday: 'long' })

// Aucun « meilleur jour » tant qu'aucun jour n'a encaissé : sinon le premier jour vide serait mis en avant.
const best = computed(() => {
  const top = days.value.reduce<typeof days.value[number] | null>((leader, day) => (!leader || day.collected > leader.collected ? day : leader), null)

  return top && top.collected > 0 ? top : null
})

const total = computed(() => days.value.reduce((sum, day) => sum + day.collected, 0))
const average = computed(() => days.value.length ? Math.round(total.value / days.value.length) : 0)

const series = computed(() => [{ name: 'Encaissé', data: days.value.map(day => day.collected) }])

// Le meilleur jour ressort en couleur pleine, les autres en teinte claire.
const options = computed(() => {
  const t = theme.value
  const bestIndex = best.value ? days.value.indexOf(best.value) : -1

  return {
    chart: { type: 'bar', toolbar: { show: false }, parentHeightOffset: 0, fontFamily: t.fontFamily },
    plotOptions: { bar: { borderRadius: 7, columnWidth: '42%', distributed: true, borderRadiusApplication: 'end' } },
    colors: days.value.map((_, index) => (index === bestIndex ? t.primary : t.primarySoft)),
    dataLabels: { enabled: false },
    legend: { show: false },
    grid: { borderColor: t.grid, strokeDashArray: 6, padding: { top: -10, left: 0, right: 0, bottom: -4 } },
    xaxis: {
      categories: days.value.map(day => weekday.format(day.date)),
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: { style: { colors: t.text, fontSize: '13px' } },
    },
    yaxis: {
      tickAmount: 4,
      labels: {
        style: { colors: t.text, fontSize: '12px' },
        formatter: (value: number) => (value >= 1000 ? `${Math.round(value / 1000)} k` : String(value)),
      },
    },
    tooltip: { theme: t.mode, y: { formatter: (value: number) => formatMoney(value, currency.value) } },
    states: { hover: { filter: { type: 'darken', value: 0.9 } } },
  }
})
</script>

<template>
  <VCard class="h-100">
    <VCardItem>
      <VCardTitle>Vue de la semaine</VCardTitle>
      <VCardSubtitle>Encaissements par jour</VCardSubtitle>
    </VCardItem>

    <VCardText>
      <VSkeletonLoader
        v-if="loading"
        type="image"
        height="240"
      />
      <VueApexCharts
        v-else
        type="bar"
        height="240"
        :options="options"
        :series="series"
      />

      <div
        v-if="!loading"
        class="d-flex flex-wrap align-center gap-x-6 gap-y-2 mt-2"
      >
        <div class="d-flex align-center gap-3">
          <span class="text-h4 font-weight-semibold tabular-nums">{{ formatMoney(average, currency) }}</span>
          <span class="text-body-2 text-medium-emphasis">en moyenne par jour</span>
        </div>
        <VSpacer />
        <span
          v-if="best"
          class="text-body-2"
        >
          Meilleur jour : <strong class="text-primary">{{ longDay.format(best.date) }}</strong>
          ({{ formatMoney(best.collected, currency) }})
        </span>
      </div>
    </VCardText>
  </VCard>
</template>
