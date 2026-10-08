<script setup lang="ts">
import StockGauge from '../components/StockGauge.vue'
import StockMovementDialog from '../components/StockMovementDialog.vue'
import StockThresholdDialog from '../components/StockThresholdDialog.vue'
import { useStockOverview } from '../composables/useStockOverview'
import { STATE_INFO, componentTypeLabel, formatQty } from '../labels'
import type { StockMovementType, StockRow } from '../types'
import { useClientPagination } from '@/composables/useClientPagination'
import { useLive } from '@/composables/useLive'
import { useTenantStore } from '@/stores/tenant.store'

type Filter = 'all' | 'alerte' | 'rupture'

const tenant = useTenantStore()
const { rows, counts, loading, loadedOnce, error, reload, refresh } = useStockOverview()

useLive(refresh)

const ORDER = { rupture: 0, alerte: 1, ok: 2 } as const

const filter = ref<Filter>('all')
const search = ref('')
const canWrite = computed(() => tenant.can('stock'))

const hasFilters = computed(() => filter.value !== 'all' || search.value.trim() !== '')

const filtered = computed(() => {
  const term = search.value.trim().toLowerCase()

  return rows.value
    .filter(row => {
      if (filter.value === 'alerte')
        return row.state === 'alerte'
      if (filter.value === 'rupture')
        return row.state === 'rupture'

      return true
    })
    .filter(row => !term || row.composant.nom.toLowerCase().includes(term) || row.composant.type.toLowerCase().includes(term))

    // Les plus urgents d'abord, puis l'ordre alphabétique.
    .sort((a, b) => ORDER[a.state] - ORDER[b.state] || a.composant.nom.localeCompare(b.composant.nom, 'fr'))
})

const pager = useClientPagination(filtered, 10)

const filterOptions = computed(() => [
  { value: 'all' as const, title: `Tous (${counts.value.total})` },
  { value: 'alerte' as const, title: `Sous le seuil (${counts.value.alerte})` },
  { value: 'rupture' as const, title: `Ruptures (${counts.value.rupture})` },
])

const strip = computed(() => [
  { label: 'Composants suivis', value: String(counts.value.total), icon: 'ri-stack-line' },
  {
    label: 'Sous le seuil',
    value: String(counts.value.alerte),
    icon: 'ri-alarm-warning-line',
    hint: counts.value.alerte ? 'À réapprovisionner' : 'Rien à signaler',
    hintColor: counts.value.alerte ? 'warning' as const : 'success' as const,
  },
  {
    label: 'Ruptures',
    value: String(counts.value.rupture),
    icon: 'ri-error-warning-line',
    hint: counts.value.rupture ? 'Indisponibles à la vente' : 'Aucune rupture',
    hintColor: counts.value.rupture ? 'error' as const : 'success' as const,
  },
  {
    label: 'Composants réservés',
    value: String(counts.value.reserved),
    icon: 'ri-lock-line',
    hint: 'Engagés par des commandes en cours',
  },
])

const movementRow = ref<StockRow | null>(null)
const movementOpen = ref(false)
const movementType = ref<StockMovementType>('entree')
const thresholdRow = ref<StockRow | null>(null)
const thresholdOpen = ref(false)

function openMovement(row: StockRow, type: StockMovementType = 'entree') {
  movementRow.value = row
  movementType.value = type
  movementOpen.value = true
}

function openThreshold(row: StockRow) {
  thresholdRow.value = row
  thresholdOpen.value = true
}

function clearFilters() {
  filter.value = 'all'
  search.value = ''
}
</script>

<template>
  <div>
    <AppPageHeader
      title="Stock"
      subtitle="Les quantités de chaque composant, ce qui est réservé par les commandes et ce qu'il faut réapprovisionner."
    >
      <template #actions>
        <VBtn
          variant="tonal"
          prepend-icon="ri-refresh-line"
          :loading="loading"
          @click="reload"
        >
          Actualiser
        </VBtn>
      </template>
    </AppPageHeader>

    <AppStatStrip
      :items="strip"
      :loading="!loadedOnce && !error"
    />

    <VCard class="mt-6">
      <VCardItem class="pb-2">
        <VCardTitle>Niveaux de stock</VCardTitle>
      </VCardItem>
      <VCardText>
        <VRow>
          <VCol
            cols="12"
            md="7"
            class="d-flex align-center"
          >
            <div class="filter-scroll">
              <AppSegmented
                v-model="filter"
                :options="filterOptions"
                label="Filtrer par état"
              />
            </div>
          </VCol>
          <VCol
            cols="12"
            md="5"
          >
            <VTextField
              v-model="search"
              label="Rechercher un composant"
              prepend-inner-icon="ri-search-line"
              clearable
              autocomplete="off"
            />
          </VCol>
        </VRow>
      </VCardText>

      <VDivider />

      <AppErrorState
        v-if="error && !loadedOnce"
        class="ma-4"
        :error="error"
        @retry="reload"
      />

      <VSkeletonLoader
        v-else-if="!loadedOnce"
        type="table-thead, table-tbody"
      />

      <AppEmptyState
        v-else-if="filtered.length === 0"
        icon="ri-stack-line"
        :title="hasFilters ? 'Aucun composant ne correspond' : 'Aucun composant en stock'"
        :text="hasFilters
          ? 'Essayez un autre état ou une autre recherche.'
          : 'Créez vos premiers composants : leur stock sera suivi ici.'"
      >
        <VBtn
          v-if="hasFilters"
          variant="outlined"
          @click="clearFilters"
        >
          Effacer les filtres
        </VBtn>
        <VBtn
          v-else
          color="primary"
          to="/stock/composants"
        >
          Gérer les composants
        </VBtn>
      </AppEmptyState>

      <template v-else>
        <VTable
          hover
          class="stock-table"
        >
          <thead>
            <tr>
              <th>Composant</th>
              <th>Niveau</th>
              <th class="text-end d-none d-md-table-cell">
                Réservé
              </th>
              <th class="text-end d-none d-md-table-cell">
                Disponible
              </th>
              <th class="d-none d-sm-table-cell">
                État
              </th>
              <th
                v-if="canWrite"
                class="text-end d-none d-sm-table-cell"
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in pager.rows.value"
              :key="row.composant.id"
            >
              <td>
                <div class="d-flex align-center gap-3 py-2">
                  <VAvatar
                    :color="STATE_INFO[row.state].color"
                    variant="tonal"
                    rounded
                    size="38"
                    class="d-none d-sm-flex"
                  >
                    <VIcon :icon="STATE_INFO[row.state].icon" />
                  </VAvatar>
                  <div class="min-w-0">
                    <div class="text-body-1 font-weight-medium text-high-emphasis text-truncate">
                      {{ row.composant.nom }}
                    </div>
                    <div class="text-body-2 text-medium-emphasis">
                      {{ componentTypeLabel(row.composant.type) }}
                    </div>
                    <div
                      v-if="canWrite"
                      class="d-sm-none mt-1 d-flex gap-1"
                    >
                      <VBtn
                        size="x-small"
                        variant="tonal"
                        :aria-label="`Mouvement de stock : ${row.composant.nom}`"
                        @click="openMovement(row)"
                      >
                        Mouvement
                      </VBtn>
                      <VBtn
                        size="x-small"
                        variant="text"
                        :aria-label="`Seuil d'alerte : ${row.composant.nom}`"
                        @click="openThreshold(row)"
                      >
                        Seuil
                      </VBtn>
                    </div>
                  </div>
                </div>
              </td>
              <td class="gauge-cell">
                <StockGauge
                  :stock="row.stock"
                  :state="row.state"
                  :unit="row.composant.stock_unite"
                />
              </td>
              <td class="text-end d-none d-md-table-cell tabular-nums text-medium-emphasis">
                {{ formatQty(row.stock.reservee) }}
              </td>
              <td class="text-end d-none d-md-table-cell tabular-nums font-weight-medium">
                {{ formatQty(row.stock.disponible) }}
              </td>
              <td class="d-none d-sm-table-cell">
                <AppStatusChip
                  :label="STATE_INFO[row.state].label"
                  :tone="STATE_INFO[row.state].tone"
                />
              </td>
              <td
                v-if="canWrite"
                class="text-end text-no-wrap d-none d-sm-table-cell"
              >
                <VBtn
                  size="small"
                  variant="tonal"
                  class="me-1 movement-btn"
                  prepend-icon="ri-arrow-left-right-line"
                  :aria-label="`Mouvement de stock : ${row.composant.nom}`"
                  @click="openMovement(row)"
                >
                  <span class="d-none d-lg-inline">Mouvement</span>
                </VBtn>
                <IconBtn
                  :aria-label="`Seuil d'alerte : ${row.composant.nom}`"
                  @click="openThreshold(row)"
                >
                  <VIcon icon="ri-alarm-warning-line" />
                  <VTooltip
                    activator="parent"
                    location="top"
                  >
                    Seuil d'alerte
                  </VTooltip>
                </IconBtn>
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
    </VCard>

    <StockMovementDialog
      v-model="movementOpen"
      :row="movementRow"
      :initial-type="movementType"
      @saved="refresh"
    />
    <StockThresholdDialog
      v-model="thresholdOpen"
      :row="thresholdRow"
      @saved="refresh"
    />
  </div>
</template>

<style scoped>
@media (max-width: 1279px) {
  .movement-btn {
    min-inline-size: 0;
    padding-inline: 10px;
  }

  .movement-btn :deep(.v-btn__prepend) {
    margin-inline: 0;
  }
}

.gauge-cell {
  min-inline-size: 7.5rem;
  max-inline-size: 16rem;
}

.filter-scroll {
  max-inline-size: 100%;
  overflow-x: auto;
}
</style>
