<script setup lang="ts">
import { usePaymentInsights } from '../composables/usePaymentInsights'
import { presentStatus } from '../statuses'
import { hexToRgb } from '@layouts/utils'
import { useChartTheme } from '@/composables/useChartTheme'

const { week, loading } = usePaymentInsights()
const theme = useChartTheme()

const TONE_COLOR = { success: 'success', error: 'error', warning: 'warning', info: 'info', neutral: 'secondary' } as const

/**
 * Plusieurs statuts partagent la même teinte (échoué / délai dépassé en rouge, en attente / annulé /
 * à vérifier en orange) : sans autre repère, deux parts voisines se confondent. Dans une même teinte,
 * la plus grosse part garde la couleur pleine et les suivantes s'éclaircissent.
 */
const SHADES = [1, 0.62, 0.4]

const slices = computed(() => {
  const used = new Map<string, number>()

  return Object.entries(week.value?.by_status ?? {})
    .filter(([, total]) => total.count > 0)
    .sort(([, a], [, b]) => b.count - a.count)
    .map(([status, total]) => {
      const view = presentStatus(status)
      const color = TONE_COLOR[view.tone]
      const rank = used.get(color) ?? 0

      used.set(color, rank + 1)

      return { status, label: view.label, count: total.count, color, shade: SHADES[Math.min(rank, SHADES.length - 1)] }
    })
})

const total = computed(() => week.value?.transactions ?? 0)

const options = computed(() => {
  const t = theme.value

  return {
    chart: { type: 'donut', fontFamily: t.fontFamily },
    labels: slices.value.map(slice => slice.label),
    colors: slices.value.map(slice => {
      const rgb = hexToRgb(t[slice.color])

      return rgb && slice.shade < 1 ? `rgba(${rgb},${slice.shade})` : t[slice.color]
    }),
    stroke: { width: 3, colors: [t.surface] },
    dataLabels: { enabled: false },
    legend: { show: false },
    tooltip: { theme: t.mode },
    plotOptions: {
      pie: {
        donut: {
          size: '74%',
          labels: {
            show: true,
            name: { offsetY: 22, color: t.text, fontSize: '13px' },
            value: { offsetY: -14, color: t.textStrong, fontSize: '26px', fontWeight: 600 },
            total: { show: true, label: 'paiements', color: t.text, formatter: () => String(total.value) },
          },
        },
      },
    },
  }
})
</script>

<template>
  <VCard class="h-100">
    <VCardItem>
      <VCardTitle>Statuts</VCardTitle>
      <VCardSubtitle>7 derniers jours</VCardSubtitle>
    </VCardItem>

    <VCardText>
      <VSkeletonLoader
        v-if="loading"
        type="image"
        height="200"
      />

      <AppEmptyState
        v-else-if="total === 0"
        icon="ri-pie-chart-line"
        title="Rien à répartir"
        text="Aucun paiement sur les 7 derniers jours."
      />

      <template v-else>
        <VueApexCharts
          type="donut"
          height="210"
          :options="options"
          :series="slices.map(slice => slice.count)"
        />

        <ul class="legend mt-4">
          <li
            v-for="slice in slices"
            :key="slice.status"
            class="d-flex align-center gap-2"
          >
            <span
              class="legend__dot"
              :style="{ background: `rgba(var(--v-theme-${slice.color}), ${slice.shade})` }"
            />
            <span class="text-body-2">{{ slice.label }}</span>
            <VSpacer />
            <span class="text-body-2 font-weight-medium tabular-nums">{{ slice.count }}</span>
          </li>
        </ul>
      </template>
    </VCardText>
  </VCard>
</template>

<style scoped>
.legend {
  display: grid;
  gap: 0.5rem 1.5rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  padding: 0;
  list-style: none;
}

.legend__dot {
  flex: none;
  inline-size: 10px;
  block-size: 10px;
  border-radius: 50%;
}
</style>
