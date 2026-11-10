<!--
  Jauge d'un composant : le disponible face au seuil d'alerte. Un trait marque le seuil ; la part réservée par
  des commandes en cours est hachurée. Lisible sans la couleur grâce au texte (quantité, seuil, réservé).
-->
<script setup lang="ts">
import { STATE_INFO, formatQty, gaugeShares } from '../labels'
import type { StockLevel, StockState } from '../types'

const props = defineProps<{
  stock: StockLevel
  state: StockState
  unit: string
}>()

const shares = computed(() => gaugeShares(props.stock))
const hasThreshold = computed(() => shares.value.threshold !== null)
const reserved = computed(() => Number(props.stock.reservee) > 0)

const summary = computed(() => {
  const parts = [
    `${formatQty(props.stock.quantite)} ${props.unit} en stock`,
    `${formatQty(props.stock.disponible)} disponible`,
  ]

  if (reserved.value)
    parts.push(`${formatQty(props.stock.reservee)} réservé`)

  parts.push(hasThreshold.value ? `seuil d'alerte ${formatQty(props.stock.seuil_alerte)}` : 'sans seuil d\'alerte')
  parts.push(STATE_INFO[props.state].label)

  return parts.join(', ')
})
</script>

<template>
  <div
    class="stock-gauge"
    :class="`stock-gauge--${state}`"
  >
    <div class="d-flex justify-space-between align-baseline gap-2 mb-1">
      <span class="text-body-1 font-weight-medium text-high-emphasis tabular-nums text-no-wrap">
        {{ formatQty(stock.quantite) }} <span class="text-medium-emphasis font-weight-regular">{{ unit }}</span>
      </span>
      <span class="text-caption text-medium-emphasis tabular-nums text-no-wrap">
        {{ hasThreshold ? `Seuil ${formatQty(stock.seuil_alerte)}` : 'Sans seuil' }}
      </span>
    </div>

    <div
      class="stock-gauge__track"
      role="img"
      :aria-label="summary"
    >
      <span
        class="stock-gauge__fill"
        :style="{ inlineSize: `${shares.available}%` }"
      />
      <span
        v-if="reserved"
        class="stock-gauge__reserved"
        :style="{ insetInlineStart: `${shares.available}%`, inlineSize: `${shares.reserved}%` }"
      />
      <span
        v-if="shares.threshold !== null"
        class="stock-gauge__mark"
        :style="{ insetInlineStart: `${shares.threshold}%` }"
      />
    </div>

    <div
      v-if="reserved"
      class="stock-gauge__legend text-caption text-medium-emphasis tabular-nums"
    >
      dont {{ formatQty(stock.reservee) }} réservé{{ Number(stock.reservee) > 1 ? 's' : '' }}
    </div>
  </div>
</template>

<style scoped>
.stock-gauge {
  --gauge-color: var(--v-theme-success);

  min-inline-size: 6.5rem;
}

.stock-gauge--alerte {
  --gauge-color: var(--v-theme-warning);
}

.stock-gauge--rupture {
  --gauge-color: var(--v-theme-error);
}

.stock-gauge__track {
  position: relative;
  overflow: hidden;
  block-size: 8px;
  border-radius: 999px;
  background: rgba(var(--v-theme-on-surface), 0.1);
}

.stock-gauge__fill {
  position: absolute;
  inset-block: 0;
  inset-inline-start: 0;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(var(--gauge-color), 0.75), rgb(var(--gauge-color)));
  transition: inline-size 0.4s ease;
}

/* La part réservée : hachures de la couleur de l'état, pour la distinguer du disponible. */
.stock-gauge__reserved {
  position: absolute;
  inset-block: 0;
  background: repeating-linear-gradient(
    135deg,
    rgba(var(--gauge-color), 0.45) 0 3px,
    rgba(var(--gauge-color), 0.12) 3px 6px
  );
  transition: inline-size 0.4s ease, inset-inline-start 0.4s ease;
}

/* Le trait du seuil : un filet sombre sur toute la hauteur de la piste, visible aussi sur une barre pleine. */
.stock-gauge__mark {
  position: absolute;
  inset-block: 0;
  inline-size: 2px;
  margin-inline-start: -1px;
  background: rgba(var(--v-theme-on-surface), 0.55);
}

@media (prefers-reduced-motion: reduce) {
  .stock-gauge__fill,
  .stock-gauge__reserved {
    transition: none;
  }
}
</style>
