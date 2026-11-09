<!-- Chiffre d'affaires des sept derniers jours ; le meilleur jour ressort en couleur pleine. -->
<script setup lang="ts">
import { compact, money } from '../format'
import type { RestaurantDashboard } from '../types'
import { useChartTheme } from '@/composables/useChartTheme'

const props = defineProps<{ data: RestaurantDashboard | null }>()

const theme = useChartTheme()
const weekday = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', timeZone: 'UTC' })
const longDay = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', timeZone: 'UTC' })

const days = computed(() => (props.data?.semaine ?? []).map(d => ({ ...d, date: new Date(`${d.jour}T12:00:00Z`) })))
const total = computed(() => days.value.reduce((sum, d) => sum + d.ca, 0))
const best = computed(() => days.value.reduce<typeof days.value[number] | null>((top, d) => (!top || d.ca > top.ca ? d : top), null))

const series = computed(() => [{ name: 'Encaissé', data: days.value.map(d => d.ca) }])

const options = computed(() => {
  const t = theme.value
  const bestIndex = best.value && best.value.ca > 0 ? days.value.indexOf(best.value) : -1

  return {
    chart: { type: 'bar', toolbar: { show: false }, parentHeightOffset: 0, fontFamily: t.fontFamily },
    plotOptions: { bar: { borderRadius: 6, columnWidth: '46%', distributed: true, borderRadiusApplication: 'end' } },
    colors: days.value.map((_, i) => (i === bestIndex ? t.primary : t.primarySoft)),
    dataLabels: { enabled: false },
    legend: { show: false },
    grid: { borderColor: t.grid, strokeDashArray: 6, padding: { top: -10, left: 0, right: 0, bottom: -4 } },
    xaxis: { categories: days.value.map(d => weekday.format(d.date)), axisBorder: { show: false }, axisTicks: { show: false }, labels: { style: { colors: t.text, fontSize: '12px' } } },
    yaxis: { tickAmount: 3, labels: { style: { colors: t.text, fontSize: '12px' }, formatter: (v: number) => compact(v) } },
    tooltip: { theme: t.mode, y: { formatter: (v: number) => money(v, props.data?.devise ?? 'XAF') } },
  }
})
</script>

<template>
  <VCard class="h-100">
    <VCardItem>
      <template #prepend>
        <VAvatar
          color="success"
          variant="tonal"
          rounded="lg"
        >
          <VIcon icon="ri-bar-chart-2-line" />
        </VAvatar>
      </template>
      <VCardTitle>Les 7 derniers jours</VCardTitle>
      <VCardSubtitle v-if="data">
        {{ money(total, data.devise) }} encaissés
      </VCardSubtitle>
    </VCardItem>

    <VCardText>
      <VSkeletonLoader
        v-if="!data"
        type="image"
        height="262"
      />
      <AppEmptyState
        v-else-if="!total"
        icon="ri-bar-chart-2-line"
        title="Pas encore d'encaissements"
        text="Les sept derniers jours s'affichent ici dès les premières ventes."
      />
      <template v-else>
        <VueApexCharts
          type="bar"
          height="262"
          :options="options"
          :series="series"
        />
        <p
          v-if="best && best.ca > 0"
          class="text-body-2 mt-2 mb-0"
        >
          Meilleur jour : <strong class="text-primary">{{ longDay.format(best.date) }}</strong> ({{ money(best.ca, data.devise) }})
        </p>
      </template>
    </VCardText>
  </VCard>
</template>
