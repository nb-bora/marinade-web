<!--
  État de la salle : jauge d'occupation et mini-plan où chaque table est un carré coloré
  (occupée, réservée, libre, hors service). Le serveur ne donne que des totaux : le mini-plan est
  un résumé visuel, le plan détaillé est sur l'écran Salle.
-->
<script setup lang="ts">
import { plural } from '../format'
import type { RestaurantDashboard } from '../types'
import { useChartTheme } from '@/composables/useChartTheme'

const props = defineProps<{ data: RestaurantDashboard | null }>()

const theme = useChartTheme()
const hall = computed(() => props.data?.salle)

const MAX_TILES = 60

const segments = computed(() => {
  const h = hall.value

  if (!h || !h.total)
    return []

  return [
    { key: 'occupee', label: 'Occupées', n: h.occupees },
    { key: 'reservee', label: 'Réservées', n: h.reservees },
    { key: 'libre', label: 'Libres', n: h.libres },
    { key: 'maintenance', label: 'Hors service', n: h.maintenance },
  ]
})

const tiles = computed(() => segments.value.flatMap(s => Array.from({ length: s.n }, () => s)).slice(0, MAX_TILES))
const hidden = computed(() => Math.max(0, (hall.value?.total ?? 0) - MAX_TILES))
const occupancy = computed(() => hall.value?.total ? Math.round(100 * hall.value.occupees / hall.value.total) : 0)

const options = computed(() => {
  const t = theme.value

  return {
    chart: { type: 'radialBar', sparkline: { enabled: true }, fontFamily: t.fontFamily },
    plotOptions: {
      radialBar: {
        startAngle: -120,
        endAngle: 120,
        hollow: { size: '62%' },
        track: { background: t.grid, strokeWidth: '100%' },
        dataLabels: {
          name: { show: true, offsetY: 22, fontSize: '12px', color: t.text },
          value: { show: true, offsetY: -14, fontSize: '28px', fontWeight: 700, color: t.textStrong, formatter: (v: number) => `${Math.round(v)} %` },
        },
      },
    },
    fill: { type: 'gradient', gradient: { shade: 'dark', type: 'horizontal', gradientToColors: [t.warning], stops: [0, 100] } },
    colors: [t.primary],
    stroke: { lineCap: 'round' },
    labels: ['d\'occupation'],
  }
})
</script>

<template>
  <VCard
    class="h-100"
    data-tour="dash-hall"
  >
    <VCardItem>
      <template #prepend>
        <VAvatar
          color="warning"
          variant="tonal"
          rounded="lg"
        >
          <VIcon icon="ri-layout-grid-line" />
        </VAvatar>
      </template>
      <VCardTitle>Salle</VCardTitle>
      <VCardSubtitle v-if="hall?.total">
        {{ plural(hall.total, 'table') }} · {{ hall.sessions_ouvertes }} ouverte{{ hall.sessions_ouvertes > 1 ? 's' : '' }}
      </VCardSubtitle>
      <template #append>
        <VBtn
          variant="text"
          size="small"
          icon="ri-arrow-right-line"
          to="/salle"
          aria-label="Ouvrir le plan de salle"
        />
      </template>
    </VCardItem>

    <VSkeletonLoader
      v-if="!data"
      type="article"
    />

    <VCardText v-else-if="!hall?.total">
      <AppEmptyState
        icon="ri-layout-grid-line"
        title="Aucune table configurée"
        text="Ajoutez vos tables pour suivre l'occupation de la salle en temps réel."
      >
        <VBtn
          variant="outlined"
          to="/salle/tables"
        >
          Configurer les tables
        </VBtn>
      </AppEmptyState>
    </VCardText>

    <VCardText v-else>
      <div class="gauge">
        <VueApexCharts
          type="radialBar"
          height="190"
          :options="options"
          :series="[occupancy]"
        />
      </div>

      <div
        class="plan"
        role="img"
        :aria-label="`${hall.occupees} tables occupées, ${hall.reservees} réservées, ${hall.libres} libres sur ${hall.total}`"
      >
        <span
          v-for="(tile, i) in tiles"
          :key="i"
          class="plan__tile"
          :class="`plan__tile--${tile.key}`"
          :title="tile.label"
        />
        <span
          v-if="hidden"
          class="text-caption text-medium-emphasis align-self-center"
        >+{{ hidden }}</span>
      </div>

      <div class="legend">
        <div
          v-for="s in segments"
          :key="s.key"
          class="d-flex align-center gap-2"
        >
          <span
            class="plan__tile plan__tile--legend"
            :class="`plan__tile--${s.key}`"
          />
          <span class="text-body-2 flex-grow-1">{{ s.label }}</span>
          <span class="font-weight-semibold tabular-nums">{{ s.n }}</span>
        </div>
      </div>
    </VCardText>
  </VCard>
</template>

<style scoped lang="scss">
.gauge {
  margin-block: -12px -6px;
}

.plan {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: center;
  margin: 0.6rem 0 1.1rem;
}

.plan__tile {
  border-radius: 6px;
  display: inline-block;
  height: 18px;
  width: 18px;

  &--occupee {
    background: rgb(var(--v-theme-primary));
    box-shadow: 0 0 0 3px rgba(var(--v-theme-primary), 0.18);
  }

  &--reservee {
    background: rgb(var(--v-theme-info));
    box-shadow: 0 0 0 3px rgba(var(--v-theme-info), 0.18);
  }

  &--libre {
    border: 2px solid rgb(var(--v-theme-success));
    background: rgba(var(--v-theme-success), 0.14);
  }

  &--maintenance {
    background: repeating-linear-gradient(45deg, rgba(var(--v-theme-on-surface), 0.28) 0 3px, transparent 3px 6px);
    border: 2px solid rgba(var(--v-theme-on-surface), 0.28);
  }

  &--legend {
    box-shadow: none;
    flex-shrink: 0;
    height: 12px;
    width: 12px;
  }
}

.legend {
  display: grid;
  gap: 0.55rem 1.5rem;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
}
</style>
