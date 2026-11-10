<script setup lang="ts">
import { groupApi } from '../api'
import { channelView, methodView } from '../labels'
import type { RestaurantComparison } from '../types'
import { useAsyncData } from '@/composables/useAsyncData'
import { useChartTheme } from '@/composables/useChartTheme'
import { formatMoney } from '@/lib/format'
import { useTenantStore } from '@/stores/tenant.store'

const tenant = useTenantStore()
const theme = useChartTheme()

const report = useAsyncData(signal => groupApi.reporting(signal))

// Le détail par restaurant vient des paiements de chacun : la route de reporting ne donne que les totaux.
const owned = computed(() => tenant.restaurants.filter(item => item.relation === 'owner'))

const comparison = useAsyncData<RestaurantComparison[]>(async signal => {
  return await Promise.all(owned.value.map(async item => ({
    id: item.restaurant_id,
    name: item.name,
    city: item.city ?? null,
    payments: await groupApi.payments(item.restaurant_id, signal).catch(() => null),
  })))
}, { watch: [() => owned.value.map(item => item.restaurant_id).join()] })

const rows = computed(() => [...(comparison.data.value ?? [])]
  .sort((a, b) => (b.payments?.collected_fcfa ?? 0) - (a.payments?.collected_fcfa ?? 0)))

const collectedTotal = computed(() => rows.value.reduce((sum, row) => sum + (row.payments?.collected_fcfa ?? 0), 0))

/** Part exacte (0 à 100) : les barres s'en servent telle quelle, seul le texte arrondit. */
const share = (row: RestaurantComparison) =>
  collectedTotal.value > 0 ? ((row.payments?.collected_fcfa ?? 0) / collectedTotal.value) * 100 : 0

/** « 0,4 % » se lirait « 0 % » une fois arrondi, comme si la part était nulle. */
const formatPercent = (value: number) => (value > 0 && value < 1 ? '< 1 %' : `${Math.round(value)} %`)

const unreadable = computed(() => rows.value.filter(row => row.payments === null).length)

// Chiffres clés ------------------------------------------------------------------------------

const figures = computed(() => {
  const data = report.data.value

  return {
    revenue: Number(data?.total_revenue ?? 0),
    orders: data?.total_orders ?? 0,
    restaurants: data?.total_restaurants ?? 0,
  }
})

// Répartitions
interface Slice { code: string; label: string; icon: string; amount: number; percent: number }

function slices(source: Record<string, string> | undefined, view: (code: string) => { label: string; icon: string }): Slice[] {
  const entries = Object.entries(source ?? {}).map(([code, amount]) => ({ code, amount: Number(amount) }))
  const total = entries.reduce((sum, entry) => sum + entry.amount, 0)

  return entries
    .map(entry => ({ ...entry, ...view(entry.code), percent: total > 0 ? (entry.amount / total) * 100 : 0 }))
    .sort((a, b) => b.amount - a.amount)
}

const channels = computed(() => slices(report.data.value?.revenue_by_channel, channelView))
const methods = computed(() => slices(report.data.value?.payment_method_breakdown, methodView))

/**
 * Valeur moyenne d'une commande : valeur de TOUTES les commandes (somme des canaux) divisée par leur nombre.
 * Le chiffre d'affaires, lui, ne compte que les factures payées : le diviser par toutes les commandes
 * (payées ou non) faussait le résultat.
 */
const averageOrder = computed(() => {
  const value = channels.value.reduce((sum, slice) => sum + slice.amount, 0)

  return figures.value.orders > 0 ? Math.round(value / figures.value.orders) : null
})

// Graphique
const series = computed(() => [{ name: 'Encaissé en Mobile Money', data: rows.value.map(row => row.payments?.collected_fcfa ?? 0) }])

const options = computed(() => {
  const t = theme.value

  return {
    chart: { type: 'bar', toolbar: { show: false }, parentHeightOffset: 0, fontFamily: t.fontFamily },
    plotOptions: { bar: { borderRadius: 7, columnWidth: rows.value.length > 3 ? '45%' : '28%', borderRadiusApplication: 'end' } },
    colors: [t.primary],
    dataLabels: { enabled: false },
    legend: { show: false },
    grid: { borderColor: t.grid, strokeDashArray: 6, padding: { top: -10, left: 0, right: 0, bottom: -4 } },
    xaxis: {
      categories: rows.value.map(row => row.name),
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: { style: { colors: t.text, fontSize: '13px' }, trim: true, rotate: 0, hideOverlappingLabels: true },
    },
    yaxis: {
      tickAmount: 4,
      labels: {
        style: { colors: t.text, fontSize: '12px' },
        formatter: (value: number) => (value >= 1000 ? `${Math.round(value / 1000)} k` : String(Math.round(value))),
      },
    },
    tooltip: { theme: t.mode, y: { formatter: (value: number) => formatMoney(value) } },
    states: { hover: { filter: { type: 'darken', value: 0.9 } } },
  }
})

const loading = computed(() => report.loading.value && report.data.value === null)

// Avant la lecture de la liste des restaurants, « aucun restaurant » serait faux : on attend.
const comparing = computed(() => !tenant.loaded || (comparison.data.value === null && comparison.loading.value))

function reloadAll() {
  report.reload()
  comparison.reload()
}
</script>

<template>
  <div>
    <AppHero
      eyebrow="Propriétaire"
      title="Mon groupe"
      subtitle="Les chiffres de tous vos restaurants réunis, et ce que chacun apporte."
    >
      <template #actions>
        <VBtn
          variant="tonal"
          prepend-icon="ri-refresh-line"
          :loading="report.loading.value || comparison.loading.value"
          @click="reloadAll"
        >
          Actualiser
        </VBtn>
      </template>
    </AppHero>

    <AppErrorState
      v-if="report.error.value && report.data.value === null"
      class="mt-5"
      :error="report.error.value"
      @retry="report.reload()"
    />

    <template v-else>
      <AppMetricGrid class="mt-5 mb-6">
        <AppMetricTile
          hero
          label="Restaurants"
          icon="ri-building-4-line"
          :hint="figures.restaurants > 1 ? 'Dans votre groupe' : 'Un seul pour l\'instant'"
        >
          <VSkeletonLoader
            v-if="loading"
            type="heading"
            width="60"
            class="bg-transparent"
          />
          <AppAnimatedNumber
            v-else
            v-slot="{ current }"
            :value="figures.restaurants"
          >
            {{ current }}
          </AppAnimatedNumber>
        </AppMetricTile>
        <AppMetricTile
          label="Chiffre d'affaires"
          icon="ri-money-dollar-circle-line"
          color="success"
          hint="Factures payées, tous restaurants"
        >
          <VSkeletonLoader
            v-if="loading"
            type="heading"
            width="120"
            class="bg-transparent"
          />
          <template v-else>
            {{ formatMoney(figures.revenue) }}
          </template>
        </AppMetricTile>
        <AppMetricTile
          label="Commandes"
          icon="ri-restaurant-2-line"
          color="info"
          hint="Depuis l'ouverture"
        >
          <VSkeletonLoader
            v-if="loading"
            type="heading"
            width="80"
            class="bg-transparent"
          />
          <AppAnimatedNumber
            v-else
            v-slot="{ current }"
            :value="figures.orders"
          >
            {{ current }}
          </AppAnimatedNumber>
        </AppMetricTile>
        <AppMetricTile
          label="Valeur d'une commande"
          icon="ri-shopping-basket-2-line"
          color="warning"
          hint="En moyenne, tous canaux confondus"
        >
          <VSkeletonLoader
            v-if="loading"
            type="heading"
            width="120"
            class="bg-transparent"
          />
          <template v-else>
            {{ averageOrder === null ? '—' : formatMoney(averageOrder) }}
          </template>
        </AppMetricTile>
      </AppMetricGrid>

      <VRow class="mt-0">
        <VCol
          cols="12"
          lg="7"
        >
          <VCard class="h-100 group-card">
            <VCardItem>
              <VCardTitle>Comparaison des restaurants</VCardTitle>
              <VCardSubtitle>Encaissements Mobile Money depuis l'ouverture</VCardSubtitle>
              <template
                v-if="collectedTotal > 0"
                #append
              >
                <div class="text-end">
                  <div class="text-caption text-medium-emphasis">
                    Total encaissé
                  </div>
                  <div class="text-subtitle-1 font-weight-bold tabular-nums">
                    {{ formatMoney(collectedTotal) }}
                  </div>
                </div>
              </template>
            </VCardItem>
            <VCardText>
              <VSkeletonLoader
                v-if="comparing"
                type="image"
                height="280"
              />
              <AppEmptyState
                v-else-if="rows.length === 0"
                icon="ri-building-4-line"
                title="Aucun restaurant dans votre groupe"
                text="Les restaurants dont vous êtes propriétaire apparaissent ici."
              />
              <AppEmptyState
                v-else-if="collectedTotal === 0"
                icon="ri-smartphone-line"
                title="Aucun encaissement Mobile Money"
                text="Les paiements réussis de vos restaurants seront comparés ici dès le premier encaissement."
              />
              <VueApexCharts
                v-else
                type="bar"
                height="280"
                :options="options"
                :series="series"
              />
            </VCardText>
          </VCard>
        </VCol>

        <VCol
          cols="12"
          lg="5"
        >
          <VCard class="h-100 group-card">
            <VCardItem>
              <VCardTitle>Où l'argent est encaissé</VCardTitle>
              <VCardSubtitle>Répartition par moyen de paiement</VCardSubtitle>
            </VCardItem>
            <VCardText>
              <VSkeletonLoader
                v-if="loading"
                type="list-item-two-line, list-item-two-line, list-item-two-line"
              />
              <p
                v-else-if="methods.length === 0"
                class="text-body-2 text-medium-emphasis mb-0"
              >
                Aucun encaissement enregistré pour le moment.
              </p>
              <ul
                v-else
                class="slice-list"
              >
                <li
                  v-for="slice in methods"
                  :key="slice.code"
                >
                  <div class="d-flex align-center gap-2 mb-1">
                    <VAvatar
                      color="primary"
                      variant="tonal"
                      rounded="lg"
                      size="28"
                    >
                      <VIcon
                        :icon="slice.icon"
                        size="16"
                      />
                    </VAvatar>
                    <span class="text-body-1 text-high-emphasis">{{ slice.label }}</span>
                    <VSpacer />
                    <span class="text-body-2 text-medium-emphasis tabular-nums">{{ formatMoney(slice.amount) }} · {{ formatPercent(slice.percent) }}</span>
                  </div>
                  <VProgressLinear
                    :model-value="slice.percent"
                    color="primary"
                    height="6"
                    rounded
                    :aria-label="`${slice.label} : ${formatPercent(slice.percent)}`"
                  />
                </li>
              </ul>
            </VCardText>
          </VCard>
        </VCol>
      </VRow>

      <VRow>
        <VCol
          cols="12"
          lg="5"
        >
          <VCard class="h-100 group-card">
            <VCardItem>
              <VCardTitle>Canaux de commande</VCardTitle>
              <VCardSubtitle>Valeur des commandes selon leur origine</VCardSubtitle>
            </VCardItem>
            <VCardText>
              <VSkeletonLoader
                v-if="loading"
                type="list-item-two-line, list-item-two-line, list-item-two-line"
              />
              <p
                v-else-if="channels.length === 0"
                class="text-body-2 text-medium-emphasis mb-0"
              >
                Aucune commande enregistrée pour le moment.
              </p>
              <ul
                v-else
                class="slice-list"
              >
                <li
                  v-for="slice in channels"
                  :key="slice.code"
                >
                  <div class="d-flex align-center gap-2 mb-1">
                    <VAvatar
                      color="info"
                      variant="tonal"
                      rounded="lg"
                      size="28"
                    >
                      <VIcon
                        :icon="slice.icon"
                        size="16"
                      />
                    </VAvatar>
                    <span class="text-body-1 text-high-emphasis">{{ slice.label }}</span>
                    <VSpacer />
                    <span class="text-body-2 text-medium-emphasis tabular-nums">{{ formatMoney(slice.amount) }} · {{ formatPercent(slice.percent) }}</span>
                  </div>
                  <VProgressLinear
                    :model-value="slice.percent"
                    color="info"
                    height="6"
                    rounded
                    :aria-label="`${slice.label} : ${formatPercent(slice.percent)}`"
                  />
                </li>
              </ul>
            </VCardText>
          </VCard>
        </VCol>

        <VCol
          cols="12"
          lg="7"
        >
          <VCard class="h-100 group-card">
            <VCardItem>
              <VCardTitle>Détail par restaurant</VCardTitle>
              <VCardSubtitle>Mobile Money, depuis l'ouverture</VCardSubtitle>
            </VCardItem>

            <VAlert
              v-if="unreadable > 0"
              type="warning"
              variant="tonal"
              density="compact"
              class="mx-4 mb-3"
            >
              Les paiements de {{ unreadable }} restaurant{{ unreadable > 1 ? 's' : '' }} n'ont pas pu être lus.
              <template #append>
                <VBtn
                  size="small"
                  variant="text"
                  :loading="comparison.loading.value"
                  @click="comparison.reload()"
                >
                  Réessayer
                </VBtn>
              </template>
            </VAlert>

            <VSkeletonLoader
              v-if="comparing"
              type="table-thead, table-tbody"
            />
            <AppErrorState
              v-else-if="comparison.error.value && comparison.data.value === null"
              class="ma-4"
              :error="comparison.error.value"
              @retry="comparison.reload()"
            />
            <AppEmptyState
              v-else-if="rows.length === 0"
              icon="ri-building-4-line"
              title="Aucun restaurant dans votre groupe"
              text="Les restaurants dont vous êtes propriétaire apparaissent ici."
            />
            <VTable
              v-else
              hover
            >
              <thead>
                <tr>
                  <th>Restaurant</th>
                  <th class="text-end">
                    Encaissé
                  </th>
                  <th class="text-end d-none d-sm-table-cell">
                    Paiements
                  </th>
                  <th class="text-end part-col">
                    Part
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(row, index) in rows"
                  :key="row.id"
                >
                  <td>
                    <div class="d-flex align-center gap-3 py-2">
                      <VAvatar
                        :color="index === 0 && row.payments && row.payments.collected_fcfa > 0 ? 'primary' : 'secondary'"
                        variant="tonal"
                        rounded
                        size="38"
                      >
                        <VIcon :icon="index === 0 && row.payments && row.payments.collected_fcfa > 0 ? 'ri-trophy-line' : 'ri-store-2-line'" />
                      </VAvatar>
                      <div class="min-w-0">
                        <div class="text-body-1 font-weight-medium text-high-emphasis text-truncate name-cell">
                          {{ row.name }}
                        </div>
                        <div
                          v-if="row.city"
                          class="text-body-2 text-medium-emphasis"
                        >
                          {{ row.city }}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td class="text-end font-weight-semibold text-high-emphasis">
                    <AppMoney
                      v-if="row.payments"
                      :amount="row.payments.collected_fcfa"
                      :currency="row.payments.currency"
                    />
                    <span
                      v-else
                      class="text-disabled"
                      title="Paiements illisibles"
                    >—</span>
                  </td>
                  <td class="text-end d-none d-sm-table-cell text-medium-emphasis tabular-nums">
                    {{ row.payments ? row.payments.transactions : '—' }}
                  </td>
                  <td class="text-end tabular-nums part-col">
                    <template v-if="row.payments">
                      <div class="text-body-2">
                        {{ formatPercent(share(row)) }}
                      </div>
                      <VProgressLinear
                        :model-value="share(row)"
                        color="primary"
                        height="4"
                        rounded
                        :aria-label="`Part de ${row.name} : ${formatPercent(share(row))}`"
                      />
                    </template>
                    <span
                      v-else
                      class="text-disabled"
                    >—</span>
                  </td>
                </tr>
              </tbody>
            </VTable>
          </VCard>
        </VCol>
      </VRow>
    </template>
  </div>
</template>

<style scoped>
.group-card {
  overflow: hidden;
  border: 1px solid rgba(var(--v-border-color), 0.16);
  border-radius: 18px;
  box-shadow: 0 1px 2px rgba(var(--v-theme-on-surface), 0.04) !important;
}

.slice-list {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 0;
  margin: 0;
  list-style: none;
}

.name-cell {
  max-inline-size: 14rem;
}

.part-col {
  min-inline-size: 5.5rem;
}
</style>
