<script setup lang="ts">
import ItemCell from '../components/ItemCell.vue'
import StockCard from '../components/StockCard.vue'
import StockGauge from '../components/StockGauge.vue'
import StockMovementDialog from '../components/StockMovementDialog.vue'
import StockThresholdDialog from '../components/StockThresholdDialog.vue'
import { useStockOverview } from '../composables/useStockOverview'
import { STATE_INFO, componentTypeLabel, formatQty, matchesSearch } from '../labels'
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
const searchDebounced = refDebounced(search, 250)
const canWrite = computed(() => tenant.can('stock'))

const hasFilters = computed(() => filter.value !== 'all' || search.value.trim() !== '')
const toOrder = computed(() => counts.value.alerte + counts.value.rupture)

const filtered = computed(() => rows.value
  .filter(row => filter.value === 'all' || row.state === filter.value)
  .filter(row => matchesSearch(searchDebounced.value, row.composant.nom, row.composant.type, componentTypeLabel(row.composant.type)))

  // Les plus urgents d'abord, puis l'ordre alphabétique.
  .sort((a, b) => ORDER[a.state] - ORDER[b.state] || a.composant.nom.localeCompare(b.composant.nom, 'fr')))

const pager = useClientPagination(filtered, 10)

const filterOptions = computed(() => [
  { value: 'all' as const, title: `Tous (${counts.value.total})` },
  { value: 'alerte' as const, title: `Sous le seuil (${counts.value.alerte})` },
  { value: 'rupture' as const, title: `Ruptures (${counts.value.rupture})` },
])

const plural = (count: number, word: string) => `${count} ${word}${count > 1 ? 's' : ''}`

// Les dialogues retrouvent leur ligne par identifiant : le stock actualisé en arrière-plan (useLive) leur parvient,
// et les contrôles de quantité ne reposent jamais sur un niveau périmé.
const movementId = ref<string | null>(null)
const movementOpen = ref(false)
const movementType = ref<StockMovementType>('entree')
const thresholdId = ref<string | null>(null)
const thresholdOpen = ref(false)

const rowOf = (id: string | null) => rows.value.find(row => row.composant.id === id) ?? null
const movementRow = computed<StockRow | null>(() => rowOf(movementId.value))
const thresholdRow = computed<StockRow | null>(() => rowOf(thresholdId.value))

function openMovement(row: StockRow, type: StockMovementType = 'entree') {
  movementId.value = row.composant.id
  movementType.value = type
  movementOpen.value = true
}

function openThreshold(row: StockRow) {
  thresholdId.value = row.composant.id
  thresholdOpen.value = true
}

function clearFilters() {
  filter.value = 'all'
  search.value = ''
}
</script>

<template>
  <div>
    <AppHero
      eyebrow="Stock"
      title="Niveaux de stock"
      subtitle="Les quantités de chaque composant, ce qui est réservé par les commandes et ce qu'il faut réapprovisionner."
      live
    >
      <template #actions>
        <VBtn
          v-if="toOrder"
          variant="tonal"
          color="warning"
          prepend-icon="ri-shopping-basket-2-line"
          to="/stock/approvisionnement"
        >
          À réapprovisionner ({{ toOrder }})
        </VBtn>
        <VBtn
          variant="tonal"
          prepend-icon="ri-refresh-line"
          :loading="loading"
          @click="reload"
        >
          Actualiser
        </VBtn>
      </template>
    </AppHero>

    <AppErrorState
      v-if="error && !loadedOnce"
      class="mt-5"
      :error="error"
      @retry="reload"
    />

    <template v-else>
      <AppMetricGrid class="mt-5 mb-6">
        <template v-if="!loadedOnce">
          <VSkeletonLoader
            v-for="n in 4"
            :key="n"
            type="article"
            class="rounded-lg"
          />
        </template>
        <template v-else>
          <AppMetricTile
            hero
            label="Composants suivis"
            icon="ri-stack-line"
            :hint="counts.total ? `${plural(counts.total - toOrder, 'suffisant')} sur ${counts.total}` : 'Aucun composant pour l\'instant'"
            :gauge="counts.total ? Math.round(((counts.total - toOrder) / counts.total) * 100) : undefined"
            gauge-label="Part des composants en quantité suffisante"
          >
            <AppAnimatedNumber
              v-slot="{ current }"
              :value="counts.total"
            >
              {{ Math.round(current) }}
            </AppAnimatedNumber>
          </AppMetricTile>
          <AppMetricTile
            label="Sous le seuil"
            icon="ri-alarm-warning-line"
            color="warning"
            :hint="counts.alerte ? 'À réapprovisionner' : 'Rien à signaler'"
          >
            <AppAnimatedNumber
              v-slot="{ current }"
              :value="counts.alerte"
            >
              {{ Math.round(current) }}
            </AppAnimatedNumber>
          </AppMetricTile>
          <AppMetricTile
            label="Ruptures"
            icon="ri-error-warning-line"
            :color="counts.rupture ? 'error' : 'success'"
            :hint="counts.rupture ? 'Indisponibles à la vente' : 'Aucune rupture'"
          >
            <AppAnimatedNumber
              v-slot="{ current }"
              :value="counts.rupture"
            >
              {{ Math.round(current) }}
            </AppAnimatedNumber>
          </AppMetricTile>
          <AppMetricTile
            label="Composants réservés"
            icon="ri-lock-line"
            color="info"
            hint="Engagés par des commandes en cours"
          >
            <AppAnimatedNumber
              v-slot="{ current }"
              :value="counts.reserved"
            >
              {{ Math.round(current) }}
            </AppAnimatedNumber>
          </AppMetricTile>
        </template>
      </AppMetricGrid>

      <StockCard>
        <template #toolbar>
          <div class="stock-filter">
            <AppSegmented
              v-model="filter"
              :options="filterOptions"
              label="Filtrer par état"
            />
          </div>
          <VTextField
            v-model="search"
            class="stock-search"
            label="Rechercher un composant"
            placeholder="Nom ou catégorie"
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
            prepend-icon="ri-filter-off-line"
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
            aria-label="Niveaux de stock des composants"
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
                :class="`row--${row.state}`"
              >
                <td>
                  <ItemCell
                    :icon="STATE_INFO[row.state].icon"
                    :color="STATE_INFO[row.state].color"
                    :title="row.composant.nom"
                    :subtitle="componentTypeLabel(row.composant.type)"
                    hide-avatar-on-mobile
                  >
                    <div class="d-sm-none mt-1 d-flex flex-wrap align-center gap-1">
                      <AppStatusChip
                        :label="STATE_INFO[row.state].label"
                        :tone="STATE_INFO[row.state].tone"
                      />
                      <template v-if="canWrite">
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
                      </template>
                    </div>
                  </ItemCell>
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
                  <span class="text-medium-emphasis font-weight-regular">{{ row.composant.stock_unite }}</span>
                </td>
                <td class="d-none d-sm-table-cell">
                  <AppStatusChip
                    :label="STATE_INFO[row.state].label"
                    :tone="STATE_INFO[row.state].tone"
                    :icon="STATE_INFO[row.state].icon"
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
      </StockCard>
    </template>

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
</style>
