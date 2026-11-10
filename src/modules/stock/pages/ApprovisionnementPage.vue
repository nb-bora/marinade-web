<script setup lang="ts">
import { stockApi } from '../api'
import ItemCell from '../components/ItemCell.vue'
import StockCard from '../components/StockCard.vue'
import { useStockOverview } from '../composables/useStockOverview'
import { downloadCsv, toCsv } from '../csv'
import { STATE_INFO, formatQty, matchesSearch, toInput } from '../labels'
import type { ProcurementSuggestions } from '../types'
import { useAsyncData } from '@/composables/useAsyncData'
import { useClientPagination } from '@/composables/useClientPagination'
import { formatDateTime } from '@/lib/format'
import { useTenantStore } from '@/stores/tenant.store'
import { useToast } from '@/stores/toast.store'

const tenant = useTenantStore()
const toast = useToast()

const { data, loading, error, reload } = useAsyncData(
  signal => tenant.currentId
    ? stockApi.procurement(tenant.currentId, signal)
    : Promise.resolve(null as ProcurementSuggestions | null),
  { watch: [() => tenant.currentId] },
)

// Le niveau précis (rupture, réservations) vient du stock : il classe les lignes et complète la proposition.
const overview = useStockOverview()
const rowById = computed(() => new Map(overview.rows.value.map(row => [row.composant.id, row])))

const search = ref('')
const searchDebounced = refDebounced(search, 250)

/**
 * Règle d'alerte unique : un seuil à 0 désactive l'alerte. Le serveur renvoie aussi les composants dont le seuil
 * est à 0 et la quantité à 0 (par exemple un composant tout juste créé) : on ne les propose pas à la commande.
 */
const due = computed(() => (data.value?.items ?? []).filter(item => Number(item.seuil_alerte) > 0))

const URGENCY = { rupture: 0, alerte: 1, ok: 2 } as const

const items = computed(() => due.value
  .slice()
  .sort((a, b) => {
    const stateA = rowById.value.get(a.composant_id)?.state ?? 'alerte'
    const stateB = rowById.value.get(b.composant_id)?.state ?? 'alerte'

    // Les ruptures d'abord, puis l'ordre alphabétique.
    return URGENCY[stateA] - URGENCY[stateB] || a.composant_name.localeCompare(b.composant_name, 'fr')
  }))

const filtered = computed(() => items.value.filter(item => matchesSearch(searchDebounced.value, item.composant_name)))

const loadedOnce = computed(() => data.value !== null)
const pager = useClientPagination(filtered, 10)

const ruptures = computed(() => items.value.filter(item => rowById.value.get(item.composant_id)?.state === 'rupture').length)

// Le serveur compare la quantité au seuil sans retrancher les réservations : un composant dont le disponible est
// sous le seuil alors que la quantité le dépasse n'est pas dans sa proposition. On le signale, sans l'inventer.
const missing = computed(() => {
  const listed = new Set(due.value.map(item => item.composant_id))

  return overview.rows.value.filter(row =>
    row.state !== 'ok' && Number(row.stock.seuil_alerte) > 0 && !listed.has(row.composant.id))
})

const strip = computed(() => ({
  count: items.value.length,
  at: data.value ? formatDateTime(data.value.generated_at) : '—',
}))

function reloadAll() {
  reload()
  overview.reload()
}

const pad = (value: number) => String(value).padStart(2, '0')

function exportCsv() {
  // Nombres sans séparateur de milliers, virgule décimale : Excel les lit comme des nombres, pas comme du texte.
  const content = toCsv(
    ['Composant', 'Stock actuel', 'Seuil d\'alerte', 'Quantité à commander', 'Unité'],
    items.value.map(item => [
      item.composant_name,
      toInput(item.current_stock),
      toInput(item.seuil_alerte),
      toInput(item.suggested_order_qty),
      item.unit,
    ]),
  )

  // Date du jour de l'utilisateur (et non celle d'UTC, qui change à 1 h du matin au Cameroun).
  const now = new Date()

  downloadCsv(`bon-de-commande-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.csv`, content)
  toast.success('Bon de commande exporté.')
}
</script>

<template>
  <div>
    <AppHero
      eyebrow="Stock"
      title="Approvisionnement"
      subtitle="Les composants passés sous leur seuil d'alerte, avec la quantité à commander pour revenir à un niveau confortable."
    >
      <template #actions>
        <VBtn
          variant="tonal"
          prepend-icon="ri-refresh-line"
          :loading="loading"
          @click="reloadAll"
        >
          Recalculer
        </VBtn>
        <VBtn
          color="primary"
          prepend-icon="ri-download-2-line"
          :disabled="items.length === 0"
          @click="exportCsv"
        >
          Exporter en CSV
        </VBtn>
      </template>
    </AppHero>

    <AppErrorState
      v-if="error && !loadedOnce"
      class="mt-5"
      :error="error"
      @retry="reloadAll"
    />

    <template v-else>
      <AppMetricGrid class="mt-5 mb-6">
        <template v-if="!loadedOnce">
          <VSkeletonLoader
            v-for="n in 3"
            :key="n"
            type="article"
            class="rounded-lg"
          />
        </template>
        <template v-else>
          <AppMetricTile
            hero
            label="Composants à commander"
            icon="ri-shopping-basket-2-line"
            :hint="strip.count ? 'Sous leur seuil d\'alerte' : 'Rien à commander'"
          >
            <AppAnimatedNumber
              v-slot="{ current }"
              :value="strip.count"
            >
              {{ Math.round(current) }}
            </AppAnimatedNumber>
          </AppMetricTile>
          <AppMetricTile
            label="En rupture"
            icon="ri-error-warning-line"
            :color="ruptures ? 'error' : 'success'"
            :hint="ruptures ? 'À commander en priorité' : 'Aucune rupture'"
          >
            <AppAnimatedNumber
              v-slot="{ current }"
              :value="ruptures"
            >
              {{ Math.round(current) }}
            </AppAnimatedNumber>
          </AppMetricTile>
          <AppMetricTile
            label="Proposition établie"
            icon="ri-time-line"
            color="info"
            hint="Calculée à l'ouverture de la page"
          >
            <span class="stamp">{{ strip.at }}</span>
          </AppMetricTile>
        </template>
      </AppMetricGrid>

      <VAlert
        v-if="missing.length"
        type="info"
        variant="tonal"
        density="comfortable"
        class="mb-6"
      >
        <strong>{{ missing.length }} composant{{ missing.length > 1 ? 's' : '' }}</strong>
        {{ missing.length > 1 ? 'sont' : 'est' }} sous le seuil une fois les commandes en cours décomptées, mais
        {{ missing.length > 1 ? 'ne figurent' : 'ne figure' }} pas dans cette proposition :
        {{ missing.slice(0, 5).map(row => row.composant.nom).join(', ') }}{{ missing.length > 5 ? '…' : '' }}.
        <template #append>
          <VBtn
            size="small"
            variant="text"
            to="/stock"
          >
            Voir le stock
          </VBtn>
        </template>
      </VAlert>

      <StockCard
        title="Proposition de bon de commande"
        subtitle="Une ligne par composant à réapprovisionner, les ruptures en premier"
      >
        <template
          v-if="loadedOnce && items.length"
          #toolbar
        >
          <VTextField
            v-model="search"
            class="stock-search"
            label="Rechercher un composant"
            prepend-inner-icon="ri-search-line"
            density="compact"
            variant="solo-filled"
            flat
            rounded="lg"
            hide-details
            clearable
            autocomplete="off"
          />
        </template>

        <VSkeletonLoader
          v-if="!loadedOnce"
          type="table-thead, table-tbody"
        />

        <AppEmptyState
          v-else-if="items.length === 0"
          icon="ri-shield-check-line"
          title="Rien à commander"
          text="Aucun composant n'est sous son seuil d'alerte. Fixez des seuils depuis la page Stock pour être prévenu à temps."
        >
          <VBtn
            variant="outlined"
            to="/stock"
          >
            Aller au stock
          </VBtn>
        </AppEmptyState>

        <AppEmptyState
          v-else-if="filtered.length === 0"
          icon="ri-search-line"
          title="Aucun composant ne correspond"
          text="Essayez un autre mot."
        >
          <VBtn
            variant="outlined"
            prepend-icon="ri-filter-off-line"
            @click="search = ''"
          >
            Effacer la recherche
          </VBtn>
        </AppEmptyState>

        <template v-else>
          <VTable
            hover
            aria-label="Composants à commander"
          >
            <thead>
              <tr>
                <th>Composant</th>
                <th class="d-none d-sm-table-cell">
                  État
                </th>
                <th class="text-end">
                  En stock
                </th>
                <th class="text-end d-none d-sm-table-cell">
                  Seuil
                </th>
                <th class="text-end">
                  À commander
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in pager.rows.value"
                :key="item.composant_id"
                :class="`row--${rowById.get(item.composant_id)?.state ?? 'alerte'}`"
              >
                <td>
                  <ItemCell
                    icon="ri-shopping-basket-2-line"
                    :color="rowById.get(item.composant_id)?.state === 'rupture' ? 'error' : 'warning'"
                    :title="item.composant_name"
                    :subtitle="`en ${item.unit}`"
                  />
                </td>
                <td class="d-none d-sm-table-cell">
                  <AppStatusChip
                    v-if="rowById.get(item.composant_id)"
                    :label="STATE_INFO[rowById.get(item.composant_id)!.state].label"
                    :tone="STATE_INFO[rowById.get(item.composant_id)!.state].tone"
                    :icon="STATE_INFO[rowById.get(item.composant_id)!.state].icon"
                  />
                  <span
                    v-else
                    class="text-medium-emphasis"
                  >—</span>
                </td>
                <td class="text-end tabular-nums text-no-wrap">
                  {{ formatQty(item.current_stock) }}
                  <span class="text-medium-emphasis">{{ item.unit }}</span>
                </td>
                <td class="text-end tabular-nums text-medium-emphasis d-none d-sm-table-cell">
                  {{ formatQty(item.seuil_alerte) }}
                </td>
                <td class="text-end">
                  <VChip
                    color="primary"
                    label
                    class="font-weight-semibold tabular-nums"
                  >
                    {{ formatQty(item.suggested_order_qty) }} {{ item.unit }}
                  </VChip>
                </td>
              </tr>
            </tbody>
          </VTable>

          <VDivider />

          <AppTablePagination
            :page="pager.page.value"
            :page-size="pager.pageSize.value"
            :count="pager.rows.value.length"
            :total="pager.total.value"
            :pages="pager.pages.value"
            :has-next="pager.hasNext.value"
            @update:page="pager.page.value = $event"
            @update:page-size="pager.pageSize.value = $event"
          />
        </template>
      </StockCard>
    </template>
  </div>
</template>

<style scoped>
/* La date remplace un chiffre dans la tuile : plus petite, pour tenir sur une ligne. */
.stamp {
  font-size: 0.6em;
  font-weight: 600;
  white-space: normal;
}
</style>
