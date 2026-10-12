<!--
  Bandeau d'indicateurs à nombre de cases libre (ici cinq) : même rendu que `AppStatStrip`, qui ne
  gère que des découpages en colonnes entières. Composant générique resté dans le module : à promouvoir
  dans `src/ui` si un autre module en a besoin.
-->
<script setup lang="ts">
export interface MetricItem {
  label: string
  value: string
  icon: string
  hint?: string

  /** Couleur du thème Vuetify de l'icône et de la pastille. */
  color?: 'primary' | 'success' | 'error' | 'warning' | 'info' | 'secondary'
  to?: string
}

defineProps<{
  items: MetricItem[]
  loading?: boolean
}>()
</script>

<template>
  <VCard class="metric-card">
    <div
      class="metric-strip"
      :style="{ '--cells': items.length }"
    >
      <component
        :is="item.to ? 'RouterLink' : 'div'"
        v-for="item in items"
        :key="item.label"
        v-bind="item.to ? { to: item.to } : {}"
        class="metric-strip__cell d-flex justify-space-between gap-3 pa-5"
        :class="{ 'metric-strip__cell--link': !!item.to }"
      >
        <div class="min-w-0">
          <div class="text-body-1 text-medium-emphasis">
            {{ item.label }}
          </div>
          <VSkeletonLoader
            v-if="loading"
            type="heading"
            width="120"
            class="bg-transparent mt-1"
          />
          <div
            v-else
            class="text-h5 font-weight-semibold tabular-nums text-no-wrap mt-1"
          >
            {{ item.value }}
          </div>
          <div
            v-if="item.hint && !loading"
            class="text-body-2 text-medium-emphasis mt-2"
          >
            {{ item.hint }}
          </div>
        </div>
        <VAvatar
          :color="item.color ?? 'secondary'"
          variant="tonal"
          rounded
          size="40"
          class="flex-shrink-0"
        >
          <VIcon
            :icon="item.icon"
            size="26"
          />
        </VAvatar>
      </component>
    </div>
  </VCard>
</template>

<style scoped lang="scss">
/* Le nombre de colonnes suit la largeur de la carte (menu ouvert ou non), pas celle de l'écran. */
.metric-card {
  container-type: inline-size;
}

.metric-strip {
  display: grid;
  grid-template-columns: 1fr;
}

.metric-strip__cell {
  border-block-end: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  color: inherit;
  text-decoration: none;

  &:last-child {
    border-block-end: none;
  }

  &--link:hover {
    background: rgba(var(--v-theme-on-surface), var(--v-hover-opacity));
  }

  &--link:focus-visible {
    outline: 2px solid rgb(var(--v-theme-primary));
    outline-offset: -2px;
  }
}

@container (min-width: 560px) {
  .metric-strip {
    grid-template-columns: repeat(2, 1fr);
  }

  .metric-strip__cell:nth-child(odd) {
    border-inline-end: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  }

  .metric-strip__cell:last-child:nth-child(odd) {
    grid-column: 1 / -1;
    border-inline-end: none;
  }
}

@container (min-width: 940px) {
  .metric-strip {
    grid-template-columns: repeat(var(--cells), minmax(0, 1fr));
  }

  .metric-strip__cell,
  .metric-strip__cell:nth-child(odd) {
    border-block-end: none;
    border-inline-end: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  }

  .metric-strip__cell:last-child,
  .metric-strip__cell:last-child:nth-child(odd) {
    grid-column: auto;
    border-inline-end: none;
  }
}
</style>
