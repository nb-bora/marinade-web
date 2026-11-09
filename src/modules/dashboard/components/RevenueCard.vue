<!-- Courbe du chiffre d'affaires heure par heure, comparée au même jour de la semaine dernière. -->
<script setup lang="ts">
import { clock, compact, localHour, money } from '../format'
import type { RestaurantDashboard } from '../types'
import { useChartTheme } from '@/composables/useChartTheme'

const props = defineProps<{ data: RestaurantDashboard | null }>()

const theme = useChartTheme()

/** Plage affichée : la journée d'ouverture habituelle, élargie si de l'activité sort de ces heures. */
const range = computed(() => {
  const hours = props.data?.heures ?? []
  const active = hours.filter(h => h.ca > 0 || h.ca_reference > 0 || h.commandes > 0).map(h => h.heure)
  const first = Math.min(8, ...(active.length ? active : [8]))
  const last = Math.max(22, ...(active.length ? active : [22]))

  return hours.filter(h => h.heure >= first && h.heure <= last)
})

const nowHour = computed(() => props.data ? localHour(props.data.genere_le, props.data.fuseau) : 0)

const series = computed(() => [
  // Après l'heure courante la courbe s'arrête : le futur n'est pas à zéro, il est inconnu.
  { name: 'Aujourd\'hui', data: range.value.map(h => (h.heure <= nowHour.value ? h.ca : null)) },
  { name: 'Semaine dernière', data: range.value.map(h => h.ca_reference) },
])

const peak = computed(() => (props.data?.heures ?? []).reduce<RestaurantDashboard['heures'][number] | null>((top, h) => (!top || h.ca > top.ca ? h : top), null))
const total = computed(() => props.data?.kpi.ca_jour ?? 0)
const empty = computed(() => (props.data?.heures ?? []).every(h => h.ca === 0 && h.ca_reference === 0))

const options = computed(() => {
  const t = theme.value

  return {
    chart: { type: 'area', toolbar: { show: false }, parentHeightOffset: 0, fontFamily: t.fontFamily, zoom: { enabled: false } },
    colors: [t.primary, t.secondary],
    stroke: { curve: 'smooth', width: [3, 2], dashArray: [0, 6] },
    fill: { type: ['gradient', 'solid'], opacity: [1, 0], gradient: { shadeIntensity: 1, opacityFrom: 0.35, opacityTo: 0.02, stops: [0, 95, 100] } },
    dataLabels: { enabled: false },
    legend: { position: 'top', horizontalAlign: 'right', labels: { colors: t.text }, markers: { size: 5 } },
    grid: { borderColor: t.grid, strokeDashArray: 6, padding: { left: 6, right: 8 } },
    xaxis: {
      categories: range.value.map(h => `${h.heure} h`),
      axisBorder: { show: false },
      axisTicks: { show: false },
      tickAmount: 8,
      labels: { style: { colors: t.text, fontSize: '12px' }, rotate: 0 },
    },
    yaxis: { tickAmount: 4, min: 0, labels: { style: { colors: t.text, fontSize: '12px' }, formatter: (v: number) => compact(v) } },
    tooltip: { theme: t.mode, y: { formatter: (v: number | null) => (v === null ? '—' : money(v, props.data?.devise ?? 'XAF')) } },
    markers: { size: 0, hover: { size: 5 } },
    noData: { text: 'Aucun encaissement pour l\'instant' },
  }
})
</script>

<template>
  <VCard
    class="h-100"
    data-tour="dash-revenue"
  >
    <VCardItem>
      <template #prepend>
        <VAvatar
          color="primary"
          variant="tonal"
          rounded="lg"
        >
          <VIcon icon="ri-line-chart-line" />
        </VAvatar>
      </template>
      <VCardTitle>Chiffre d'affaires heure par heure</VCardTitle>
      <VCardSubtitle>Aujourd'hui, comparé à la semaine dernière</VCardSubtitle>
    </VCardItem>

    <VCardText>
      <VSkeletonLoader
        v-if="!data"
        type="image"
        height="260"
      />
      <AppEmptyState
        v-else-if="empty"
        icon="ri-line-chart-line"
        title="Aucun encaissement pour l'instant"
        text="La courbe se dessine heure par heure dès le premier paiement, avec la semaine dernière en repère."
      />
      <template v-else>
        <VueApexCharts
          type="area"
          height="260"
          :options="options"
          :series="series"
        />
        <div class="d-flex flex-wrap align-center gap-x-6 gap-y-1 mt-2">
          <div>
            <span class="text-h5 font-weight-semibold tabular-nums">{{ money(total, data.devise) }}</span>
            <span class="text-body-2 text-medium-emphasis ms-2">depuis l'ouverture</span>
          </div>
          <VSpacer />
          <span
            v-if="peak && peak.ca > 0"
            class="text-body-2"
          >
            Pic d'activité : <strong class="text-primary">{{ peak.heure }} h – {{ peak.heure + 1 }} h</strong>
            ({{ money(peak.ca, data.devise) }})
          </span>
          <span
            v-else
            class="text-body-2 text-medium-emphasis"
          >Mis à jour à {{ clock(data.genere_le, data.fuseau) }}</span>
        </div>
      </template>
    </VCardText>
  </VCard>
</template>
