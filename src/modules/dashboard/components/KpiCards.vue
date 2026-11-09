<!--
  Les cinq chiffres du jour. Le chiffre d'affaires, en tête, est mis en avant (dégradé) ; chaque carte
  porte une mini-visualisation : courbe cumulée, barres horaires, tendance du panier sur la semaine,
  ou jauge (tables, reste à encaisser).
-->
<script setup lang="ts">
import { localHour, moneyParts, plural } from '../format'
import type { RestaurantDashboard } from '../types'
import { useChartTheme } from '@/composables/useChartTheme'

const props = defineProps<{ data: RestaurantDashboard | null }>()

const theme = useChartTheme()
const k = computed(() => props.data?.kpi)
const devise = computed(() => props.data?.devise ?? 'XAF')

const weekday = computed(() => new Intl.DateTimeFormat('fr-FR', { weekday: 'long', timeZone: props.data?.fuseau }).format(new Date(props.data?.genere_le ?? Date.now())))

interface Trend { label: string; color: string; icon: string }

function trend(current: number, reference: number): Trend | null {
  if (reference <= 0)
    return null

  const pct = Math.round(100 * (current - reference) / reference)

  if (pct === 0)
    return { label: 'Stable', color: 'secondary', icon: 'ri-subtract-line' }

  return { label: `${pct > 0 ? '+' : ''}${pct} %`, color: pct > 0 ? 'success' : 'error', icon: pct > 0 ? 'ri-arrow-up-line' : 'ri-arrow-down-line' }
}

const caption = computed(() => `vs ${weekday.value} dernier`)

const nowHour = computed(() => props.data ? localHour(props.data.genere_le, props.data.fuseau) : 0)

/** Séries des mini-courbes. */
const cumulative = computed(() => {
  let total = 0

  return (props.data?.heures ?? []).filter(h => h.heure <= nowHour.value && h.heure >= 6).map(h => (total += h.ca))
})

const hourlyOrders = computed(() => (props.data?.heures ?? []).filter(h => h.heure >= 8 && h.heure <= 23).map(h => h.commandes))
const basketTrend = computed(() => (props.data?.semaine ?? []).map(d => d.commandes ? Math.round(d.ca / d.commandes) : 0))

const occupancy = computed(() => props.data?.salle.total ? Math.round(100 * props.data.salle.occupees / props.data.salle.total) : 0)

const dueShare = computed(() => {
  const due = k.value?.reste_a_encaisser ?? 0
  const collected = k.value?.ca_jour ?? 0

  return due + collected > 0 ? Math.round(100 * due / (due + collected)) : 0
})

type SparkType = 'area' | 'bar' | 'line'

function spark(type: SparkType, data: number[], color: string) {
  const t = theme.value

  return {
    type,
    series: [{ data: data.length > 1 ? data : [0, 0] }],
    options: {
      chart: { type, sparkline: { enabled: true }, animations: { enabled: true, speed: 700 }, fontFamily: t.fontFamily },
      colors: [color],
      stroke: { curve: 'smooth', width: type === 'bar' ? 0 : 2.5 },
      fill: type === 'area' ? { type: 'gradient', gradient: { opacityFrom: 0.45, opacityTo: 0.02, stops: [0, 95] } } : { opacity: 1 },
      plotOptions: { bar: { columnWidth: '58%', borderRadius: 3 } },
      tooltip: { enabled: false },
      states: { hover: { filter: { type: 'none' } }, active: { filter: { type: 'none' } } },
    },
  }
}

interface Card {
  id: string
  hero: boolean
  label: string
  icon: string
  color: string
  to?: string
  raw: number
  kind: 'money' | 'int'
  trend: Trend | null
  hint: string
  spark?: ReturnType<typeof spark>
  gauge?: { value: number; label: string }
}

const cards = computed<Card[]>(() => {
  if (!k.value)
    return []

  const t = theme.value

  return [
    { id: 'ca', hero: true, label: 'Chiffre d\'affaires', icon: 'ri-money-dollar-circle-line', color: 'primary', to: '/caisse', raw: k.value.ca_jour, kind: 'money', trend: trend(k.value.ca_jour, k.value.ca_reference), hint: 'Paiements reçus aujourd\'hui', spark: spark('area', cumulative.value, '#ffffff') },
    { id: 'commandes', hero: false, label: 'Commandes', icon: 'ri-receipt-line', color: 'info', to: '/commandes', raw: k.value.commandes, kind: 'int', trend: trend(k.value.commandes, k.value.commandes_reference), hint: k.value.en_cours ? `${k.value.en_cours} en cours` : 'Aucune en cours', spark: spark('bar', hourlyOrders.value, t.info) },
    { id: 'panier', hero: false, label: 'Panier moyen', icon: 'ri-shopping-basket-2-line', color: 'success', raw: k.value.panier_moyen, kind: 'money', trend: null, hint: 'Tendance sur 7 jours', spark: spark('line', basketTrend.value, t.success) },
    { id: 'tables', hero: false, label: 'Tables servies', icon: 'ri-layout-grid-line', color: 'warning', to: '/salle', raw: k.value.tables_servies, kind: 'int', trend: null, hint: plural(props.data?.salle.sessions_ouvertes ?? 0, 'table ouverte', 'tables ouvertes'), gauge: { value: occupancy.value, label: `${occupancy.value} % d'occupation` } },
    { id: 'reste', hero: false, label: 'Reste à encaisser', icon: 'ri-wallet-3-line', color: k.value.reste_a_encaisser > 0 ? 'error' : 'secondary', to: '/caisse', raw: k.value.reste_a_encaisser, kind: 'money', trend: null, hint: k.value.reste_a_encaisser > 0 ? 'Additions en attente' : 'Tout est encaissé', gauge: { value: dueShare.value, label: `${dueShare.value} % du total` } },
  ]
})
</script>

<template>
  <div
    class="kpi-grid"
    data-tour="dash-kpi"
  >
    <template v-if="!data">
      <VCard
        v-for="n in 5"
        :key="n"
        class="kpi"
      >
        <VSkeletonLoader type="list-item-two-line" />
      </VCard>
    </template>

    <component
      :is="card.to ? 'RouterLink' : 'div'"
      v-for="card in cards"
      v-else
      :key="card.id"
      v-bind="card.to ? { to: card.to } : {}"
      class="kpi-link"
    >
      <VCard
        class="kpi h-100"
        :class="{ 'kpi--hero': card.hero }"
      >
        <div class="kpi__body">
          <div class="d-flex align-center justify-space-between gap-3">
            <span class="kpi__label">{{ card.label }}</span>
            <VAvatar
              :color="card.hero ? undefined : card.color"
              :variant="card.hero ? 'flat' : 'tonal'"
              :class="{ 'kpi__avatar--hero': card.hero }"
              rounded="lg"
              size="34"
            >
              <VIcon
                :icon="card.icon"
                size="19"
              />
            </VAvatar>
          </div>

          <div class="kpi__value tabular-nums">
            <AppAnimatedNumber
              v-slot="{ current }"
              :value="card.raw"
            >
              <template v-if="card.kind === 'money'">
                {{ moneyParts(current, devise).amount }}<span class="kpi__unit">{{ moneyParts(current, devise).unit }}</span>
              </template>
              <template v-else>
                {{ current }}
              </template>
            </AppAnimatedNumber>
          </div>

          <div class="kpi__foot d-flex flex-wrap align-center gap-2">
            <VChip
              v-if="card.trend"
              size="small"
              label
              :color="card.hero ? undefined : card.trend.color"
              :variant="card.hero ? 'flat' : 'tonal'"
              :class="{ 'kpi__chip--hero': card.hero }"
              :prepend-icon="card.trend.icon"
            >
              {{ card.trend.label }}
            </VChip>
            <span class="kpi__hint">{{ card.trend ? caption : card.hint }}</span>
          </div>
        </div>

        <div
          v-if="card.spark"
          class="kpi__spark"
          aria-hidden="true"
        >
          <VueApexCharts
            :type="card.spark.type"
            height="46"
            :options="card.spark.options"
            :series="card.spark.series"
          />
        </div>
        <div
          v-else-if="card.gauge"
          class="kpi__gauge"
          :title="card.gauge.label"
        >
          <VProgressLinear
            :model-value="card.gauge.value"
            :color="card.color"
            height="6"
            rounded
            bg-opacity="0.16"
          />
        </div>
      </VCard>
    </component>
  </div>
</template>

<style scoped lang="scss">
.kpi-grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
}

.kpi-link {
  color: inherit;
  display: block;
  text-decoration: none;

  &:focus-visible {
    border-radius: 16px;
    outline: 2px solid rgb(var(--v-theme-primary));
    outline-offset: 2px;
  }

  &:hover .kpi {
    border-color: rgba(var(--v-theme-primary), 0.45);
    box-shadow: 0 8px 24px -10px rgba(var(--v-theme-primary), 0.45) !important;
    transform: translateY(-2px);
  }
}

.kpi {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
}

.kpi--hero {
  background:
    radial-gradient(circle at 90% -10%, rgba(255, 255, 255, 0.28), transparent 55%),
    linear-gradient(135deg, rgb(var(--v-theme-primary)), #b8470a) !important;
  border-color: transparent !important;
  color: #fff;
}

.kpi__body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 0.35rem;
  padding: 1rem 1.1rem 0.5rem;
}

.kpi__label {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.kpi--hero .kpi__label,
.kpi--hero .kpi__hint {
  color: rgba(255, 255, 255, 0.85);
}

.kpi__hint {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.78rem;
}

.kpi__value {
  font-size: clamp(1.4rem, 1rem + 0.9vw, 1.75rem);
  font-weight: 700;
  line-height: 1.2;
  margin-top: 0.2rem;
  white-space: nowrap;
}

.kpi__unit {
  font-size: 0.5em;
  font-weight: 500;
  margin-inline-start: 0.35em;
  opacity: 0.7;
}

.kpi__foot {
  margin-top: auto;
  padding-top: 0.25rem;
}

.kpi__spark {
  margin: 0 -4px -6px;
}

.kpi__gauge {
  padding: 0 1.1rem 1.05rem;
}

.kpi__avatar--hero {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
}

.kpi__chip--hero {
  background: rgba(255, 255, 255, 0.24);
  color: #fff;
}

@media (max-width: 599px) {
  .kpi-grid {
    gap: 0.75rem;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .kpi-grid > :first-child {
    grid-column: 1 / -1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .kpi,
  .kpi-link:hover .kpi {
    transform: none;
    transition: none;
  }
}
</style>
