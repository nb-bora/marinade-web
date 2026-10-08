<script setup lang="ts">
import { groupApi } from '../api'
import { channelView, methodView } from '../labels'
import type { RestaurantComparison } from '../types'
import { useChartTheme } from '@/composables/useChartTheme'
import { useAsyncData } from '@/composables/useAsyncData'
import { formatMoney } from '@/lib/format'
import { useTenantStore } from '@/stores/tenant.store'
import type { StatStripItem } from '@/ui/AppStatStrip.vue'

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

const share = (row: RestaurantComparison) =>
  collectedTotal.value > 0 ? Math.round(((row.payments?.collected_fcfa ?? 0) / collectedTotal.value) * 100) : 0

const unreadable = computed(() => rows.value.filter(row => row.payments === null).length)

// Bandeau
const strip = computed<StatStripItem[]>(() => {
  const data = report.data.value
  const revenue = Number(data?.total_revenue ?? 0)
  const orders = data?.total_orders ?? 0
  const restaurants = data?.total_restaurants ?? 0

  return [
    { label: 'Restaurants', value: String(restaurants), icon: 'ri-building-4-line', hint: restaurants > 1 ? 'dans votre groupe' : 'dans votre groupe (un seul pour l\'instant)' },
    { label: 'Chiffre d\'affaires', value: formatMoney(revenue), icon: 'ri-money-dollar-circle-line', hint: 'Factures payées, tous restaurants' },
    { label: 'Commandes', value: String(orders), icon: 'ri-restaurant-2-line', hint: 'Depuis l\'ouverture' },
    { label: 'Panier moyen', value: orders > 0 ? formatMoney(Math.round(revenue / orders)) : '—', icon: 'ri-shopping-basket-2-line', hint: 'Chiffre d\'affaires par commande' },
  ]
})

// Répartitions
interface Slice { code: string; label: string; icon: string; amount: number; percent: number }

function slices(source: Record<string, string> | undefined, view: (code: string) => { label: string; icon: string }): Slice[] {
  const entries = Object.entries(source ?? {}).map(([code, amount]) => ({ code, amount: Number(amount) }))
  const total = entries.reduce((sum, entry) => sum + entry.amount, 0)

  return entries
    .map(entry => ({ ...entry, ...view(entry.code), percent: total > 0 ? Math.round((entry.amount / total) * 100) : 0 }))
    .sort((a, b) => b.amount - a.amount)
}

const channels = computed(() => slices(report.data.value?.revenue_by_channel, channelView))
const methods = computed(() => slices(report.data.value?.payment_method_breakdown, methodView))

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

function reloadAll() {
  report.reload()
  comparison.reload()
}
</script>

<template>
  <div>
    <AppPageHeader
      title="Mon groupe"
      subtitle="Les chiffres de tous vos restaurants réunis, et ce que chacun apporte."
    >
      <template #actions>
        <VBtn
          variant="tonal"
          color="secondary"
          prepend-icon="ri-refresh-line"
          :loading="report.loading.value || comparison.loading.value"
          @click="reloadAll"
        >
          Actualiser
        </VBtn>
      </template>
    </AppPageHeader>

    <AppErrorState
      v-if="report.error.value && report.data.value === null"
      :error="report.error.value"
      @retry="report.reload()"
    />

    <template v-else>
      <AppStatStrip
        :items="strip"
        :loading="loading"
      />

      <VRow class="mt-0">
        <VCol
          cols="12"
          lg="7"
        >
          <VCard class="h-100">
            <VCardItem>
              <VCardTitle>Comparaison des restaurants</VCardTitle>
              <VCardSubtitle>Encaissements Mobile Money depuis l'ouverture</VCardSubtitle>
            </VCardItem>
            <VCardText>
              <VSkeletonLoader
                v-if="comparison.data.value === null && comparison.loading.value"
                type="image"
                height="280"
              />
              <AppEmptyState
                v-else-if="rows.length === 0"
                icon="ri-building-4-line"
                title="Aucun restaurant dans votre groupe"
                text="Les restaurants dont vous êtes propriétaire apparaissent ici."
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
          <VCard class="h-100">
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
              <div
                v-else
                class="d-flex flex-column gap-4"
              >
                <div
                  v-for="slice in methods"
                  :key="slice.code"
                >
                  <div class="d-flex align-center gap-2 mb-1">
                    <VIcon
                      :icon="slice.icon"
                      size="18"
                      class="text-medium-emphasis"
                    />
                    <span class="text-body-1 text-high-emphasis">{{ slice.label }}</span>
                    <VSpacer />
                    <span class="text-body-2 text-medium-emphasis tabular-nums">{{ formatMoney(slice.amount) }} ({{ slice.percent }} %)</span>
                  </div>
                  <VProgressLinear
                    :model-value="slice.percent"
                    color="primary"
                    height="6"
                    rounded
                    :aria-label="`${slice.label} : ${slice.percent} %`"
                  />
                </div>
              </div>
            </VCardText>
          </VCard>
        </VCol>
      </VRow>

      <VRow>
        <VCol
          cols="12"
          lg="5"
        >
          <VCard class="h-100">
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
              <div
                v-else
                class="d-flex flex-column gap-4"
              >
                <div
                  v-for="slice in channels"
                  :key="slice.code"
                >
                  <div class="d-flex align-center gap-2 mb-1">
                    <VIcon
                      :icon="slice.icon"
                      size="18"
                      class="text-medium-emphasis"
                    />
                    <span class="text-body-1 text-high-emphasis">{{ slice.label }}</span>
                    <VSpacer />
                    <span class="text-body-2 text-medium-emphasis tabular-nums">{{ formatMoney(slice.amount) }} ({{ slice.percent }} %)</span>
                  </div>
                  <VProgressLinear
                    :model-value="slice.percent"
                    color="info"
                    height="6"
                    rounded
                    :aria-label="`${slice.label} : ${slice.percent} %`"
                  />
                </div>
              </div>
            </VCardText>
          </VCard>
        </VCol>

        <VCol
          cols="12"
          lg="7"
        >
          <VCard class="h-100">
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
            </VAlert>

            <VSkeletonLoader
              v-if="comparison.data.value === null && comparison.loading.value"
              type="table-thead, table-tbody"
            />
            <AppErrorState
              v-else-if="comparison.error.value && comparison.data.value === null"
              class="ma-4"
              :error="comparison.error.value"
              @retry="comparison.reload()"
            />
            <VTable
              v-else-if="rows.length"
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
                  <th class="text-end">
                    Part
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in rows"
                  :key="row.id"
                >
                  <td>
                    <div class="d-flex align-center gap-3 py-2">
                      <VAvatar
                        color="primary"
                        variant="tonal"
                        rounded
                        size="38"
                      >
                        <VIcon icon="ri-store-2-line" />
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
                    <span v-else>—</span>
                  </td>
                  <td class="text-end d-none d-sm-table-cell text-medium-emphasis tabular-nums">
                    {{ row.payments ? row.payments.transactions : '—' }}
                  </td>
                  <td class="text-end tabular-nums">
                    {{ row.payments ? `${share(row)} %` : '—' }}
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
.name-cell {
  max-inline-size: 14rem;
}
</style>
