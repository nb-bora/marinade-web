<!-- Jauge d'un composant : quantité en stock face au seuil d'alerte (repère à mi-course). -->
<script setup lang="ts">
import { STATE_INFO, formatQty, gaugePercent } from '../labels'
import type { StockLevel, StockState } from '../types'

const props = defineProps<{
  stock: StockLevel
  state: StockState
  unit: string
}>()

const percent = computed(() => gaugePercent(props.stock))
const hasThreshold = computed(() => Number(props.stock.seuil_alerte) > 0)
</script>

<template>
  <div class="stock-gauge">
    <div class="d-flex justify-space-between align-baseline gap-2 mb-1">
      <span class="text-body-1 font-weight-medium text-high-emphasis tabular-nums text-no-wrap">
        {{ formatQty(stock.quantite) }} <span class="text-medium-emphasis font-weight-regular">{{ unit }}</span>
      </span>
      <span class="text-caption text-medium-emphasis tabular-nums text-no-wrap">
        {{ hasThreshold ? `Seuil ${formatQty(stock.seuil_alerte)}` : 'Sans seuil' }}
      </span>
    </div>
    <VProgressLinear
      :model-value="percent"
      :color="STATE_INFO[state].color"
      bg-color="secondary"
      bg-opacity="0.18"
      height="8"
      rounded
      :aria-label="`Niveau de stock : ${formatQty(stock.quantite)} ${unit}`"
    />
  </div>
</template>

<style scoped>
.stock-gauge {
  min-inline-size: 6.5rem;
}
</style>
