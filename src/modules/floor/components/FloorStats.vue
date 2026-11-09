<!-- Les cinq chiffres du service en salle : occupation, tables libres, couverts, addition en cours, durée moyenne. -->
<script setup lang="ts">
import type { FloorStats } from '../composables/useFloorMetrics'
import { formatElapsed } from '../composables/useFloorMetrics'
import { moneyParts } from '@/lib/format'

defineProps<{ stats: FloorStats; loading?: boolean }>()
</script>

<template>
  <AppMetricGrid data-tour="floor-stats">
    <template v-if="loading">
      <VCard
        v-for="n in 5"
        :key="n"
      >
        <VSkeletonLoader type="list-item-two-line" />
      </VCard>
    </template>

    <template v-else>
      <AppMetricTile
        hero
        label="Occupation"
        icon="ri-pie-chart-2-line"
        :gauge="stats.occupancy"
        :gauge-label="`${stats.occupancy} % des tables sont occupées`"
        :hint="`${stats.busy + stats.paying} table${stats.busy + stats.paying > 1 ? 's' : ''} sur ${stats.total}`"
      >
        <AppAnimatedNumber
          v-slot="{ current }"
          :value="stats.occupancy"
        >
          {{ current }}<span class="unit">%</span>
        </AppAnimatedNumber>
      </AppMetricTile>

      <AppMetricTile
        label="Tables libres"
        icon="ri-checkbox-circle-line"
        color="success"
        :hint="stats.reserved ? `${stats.reserved} réservée${stats.reserved > 1 ? 's' : ''}` : 'Prêtes à accueillir'"
      >
        <AppAnimatedNumber
          v-slot="{ current }"
          :value="stats.free"
        >
          {{ current }}<span class="unit">/ {{ stats.total }}</span>
        </AppAnimatedNumber>
      </AppMetricTile>

      <AppMetricTile
        label="Couverts en salle"
        icon="ri-group-line"
        color="info"
        :hint="stats.paying ? `${stats.paying} table${stats.paying > 1 ? 's' : ''} en paiement` : 'Aucune table en paiement'"
      >
        <AppAnimatedNumber
          v-slot="{ current }"
          :value="stats.covers"
        >
          {{ current }}
        </AppAnimatedNumber>
      </AppMetricTile>

      <AppMetricTile
        label="Addition en cours"
        icon="ri-money-dollar-circle-line"
        :color="stats.due > 0 ? 'warning' : 'secondary'"
        hint="Reste à encaisser"
        to="/caisse"
      >
        <AppAnimatedNumber
          v-slot="{ current }"
          :value="stats.due"
        >
          {{ moneyParts(current).amount }}<span class="unit">{{ moneyParts(current).unit }}</span>
        </AppAnimatedNumber>
      </AppMetricTile>

      <AppMetricTile
        label="Durée moyenne"
        icon="ri-timer-line"
        color="secondary"
        hint="Par table, sessions du jour"
      >
        {{ stats.averageMinutes === null ? '—' : formatElapsed(stats.averageMinutes) }}
      </AppMetricTile>
    </template>
  </AppMetricGrid>
</template>
