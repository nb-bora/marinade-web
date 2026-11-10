<script setup lang="ts">
import { stockApi } from '../api'
import CombinaisonFormDialog from '../components/CombinaisonFormDialog.vue'
import ItemCell from '../components/ItemCell.vue'
import StockCard from '../components/StockCard.vue'
import { useStockOverview } from '../composables/useStockOverview'
import { matchesSearch } from '../labels'
import type { Combinaison, Composant } from '../types'
import { useAsyncData } from '@/composables/useAsyncData'
import { useClientPagination } from '@/composables/useClientPagination'
import { formatMoney } from '@/lib/format'
import { useTenantStore } from '@/stores/tenant.store'

type Filter = 'all' | 'sale' | 'blocked' | 'off'
type Sale = 'sale' | 'blocked' | 'off' | 'unknown'

const tenant = useTenantStore()
const canWrite = computed(() => tenant.can('management'))

const all = useAsyncData(
  signal => tenant.currentId ? stockApi.combinaisons(tenant.currentId, signal) : Promise.resolve([] as Combinaison[]),
  { watch: [() => tenant.currentId] },
)

const recommended = useAsyncData(
  signal => tenant.currentId ? stockApi.recommendations(tenant.currentId, signal) : Promise.resolve([] as Combinaison[]),
  { watch: [() => tenant.currentId] },
)

const composants = useAsyncData(
  signal => tenant.currentId ? stockApi.composants(tenant.currentId, signal) : Promise.resolve([] as Composant[]),
  { watch: [() => tenant.currentId] },
)

// Le niveau de stock de chaque composant : il explique pourquoi une offre active n'est pas vendable.
const overview = useStockOverview()

const nameById = computed(() => new Map((composants.data.value ?? []).map(item => [item.id, item.nom])))
const rowById = computed(() => new Map(overview.rows.value.map(row => [row.composant.id, row])))
const recommendedIds = computed(() => new Set((recommended.data.value ?? []).map(item => item.id)))

const names = (item: Combinaison) => item.composant_ids.map(id => nameById.value.get(id) ?? 'Composant supprimé')

/**
 * Ce qui empêche la vente, composant par composant : le serveur ne vend une offre que si tous ses composants
 * sont proposés et ont du stock libre. Vide si rien de précis n'est connu (stock chargé en retard, quantité exigée).
 */
function blockers(item: Combinaison): string[] {
  return item.composant_ids.flatMap(id => {
    const name = nameById.value.get(id)
    const row = rowById.value.get(id)

    if (!name)
      return ['un composant supprimé']
    if (row?.composant && !row.composant.disponible)
      return [`${name} (masqué)`]
    if (row?.state === 'rupture')
      return [`${name} (en rupture)`]

    return []
  })
}

// Tant que les recommandations ne sont pas chargées, on ne dit pas « bloquée » : on ne le sait pas.
const salesKnown = computed(() => recommended.data.value !== null)

function saleOf(item: Combinaison): Sale {
  if (!item.disponible)
    return 'off'
  if (!salesKnown.value)
    return 'unknown'

  return recommendedIds.value.has(item.id) ? 'sale' : 'blocked'
}

const SALE_INFO: Record<Sale, { label: string; tone: 'success' | 'warning' | 'neutral'; icon: string }> = {
  sale: { label: 'En vente', tone: 'success', icon: 'ri-checkbox-circle-line' },
  blocked: { label: 'Non vendable', tone: 'warning', icon: 'ri-alarm-warning-line' },
  off: { label: 'Désactivée', tone: 'neutral', icon: 'ri-pause-circle-line' },
  unknown: { label: 'À vérifier', tone: 'neutral', icon: 'ri-question-line' },
}

const loadedOnce = computed(() => all.data.value !== null)
const list = computed(() => all.data.value ?? [])

const counts = computed(() => ({
  total: list.value.length,
  sale: list.value.filter(item => saleOf(item) === 'sale').length,
  blocked: list.value.filter(item => saleOf(item) === 'blocked').length,
  off: list.value.filter(item => saleOf(item) === 'off').length,
}))

const filter = ref<Filter>('all')
const search = ref('')
const searchDebounced = refDebounced(search, 250)

const filterOptions = computed(() => [
  { value: 'all' as const, title: `Toutes (${counts.value.total})` },
  { value: 'sale' as const, title: `En vente (${counts.value.sale})` },
  { value: 'blocked' as const, title: `Non vendables (${counts.value.blocked})` },
  { value: 'off' as const, title: `Désactivées (${counts.value.off})` },
])

const hasFilters = computed(() => filter.value !== 'all' || search.value.trim() !== '')

const filtered = computed(() => list.value
  .filter(item => filter.value === 'all' || saleOf(item) === filter.value)
  .filter(item => matchesSearch(searchDebounced.value, item.nom, item.description, ...names(item)))
  .sort((a, b) => a.nom.localeCompare(b.nom, 'fr')))

const pager = useClientPagination(filtered, 10)

const editing = ref<Combinaison | null>(null)
const dialogOpen = ref(false)

function openDialog(item: Combinaison | null) {
  editing.value = item
  dialogOpen.value = true
}

function clearFilters() {
  filter.value = 'all'
  search.value = ''
}

function reloadAll() {
  all.reload()
  recommended.reload()
  composants.reload()
  overview.reload()
}

function afterSave() {
  all.refresh()
  recommended.refresh()
  overview.refresh()
}
</script>

<template>
  <div>
    <AppHero
      eyebrow="Stock"
      title="Combinaisons"
      subtitle="Des offres à prix unique composées de plusieurs composants. Une offre dont un composant manque n'est plus proposée."
    >
      <template #actions>
        <VBtn
          variant="tonal"
          prepend-icon="ri-refresh-line"
          :loading="all.loading.value"
          @click="reloadAll"
        >
          Actualiser
        </VBtn>
        <VBtn
          v-if="canWrite"
          color="primary"
          prepend-icon="ri-add-line"
          @click="openDialog(null)"
        >
          Nouvelle combinaison
        </VBtn>
      </template>
    </AppHero>

    <AppErrorState
      v-if="all.error.value && !loadedOnce"
      class="mt-5"
      :error="all.error.value"
      @retry="reloadAll"
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
            label="Combinaisons"
            icon="ri-restaurant-2-line"
            :hint="salesKnown ? `${counts.sale} en vente sur ${counts.total}` : 'Disponibilité en cours de calcul'"
            :gauge="salesKnown && counts.total ? Math.round((counts.sale / counts.total) * 100) : undefined"
            gauge-label="Part des offres en vente"
          >
            <AppAnimatedNumber
              v-slot="{ current }"
              :value="counts.total"
            >
              {{ Math.round(current) }}
            </AppAnimatedNumber>
          </AppMetricTile>
          <AppMetricTile
            label="En vente"
            icon="ri-thumb-up-line"
            color="success"
            hint="Tous les composants sont en stock"
          >
            <AppAnimatedNumber
              v-slot="{ current }"
              :value="counts.sale"
            >
              {{ Math.round(current) }}
            </AppAnimatedNumber>
          </AppMetricTile>
          <AppMetricTile
            label="Non vendables"
            icon="ri-alarm-warning-line"
            :color="counts.blocked ? 'warning' : 'success'"
            :hint="counts.blocked ? 'Un composant manque ou est masqué' : 'Aucune offre bloquée'"
          >
            <AppAnimatedNumber
              v-slot="{ current }"
              :value="counts.blocked"
            >
              {{ Math.round(current) }}
            </AppAnimatedNumber>
          </AppMetricTile>
          <AppMetricTile
            label="Désactivées"
            icon="ri-pause-circle-line"
            color="secondary"
            hint="Retirées de la carte"
          >
            <AppAnimatedNumber
              v-slot="{ current }"
              :value="counts.off"
            >
              {{ Math.round(current) }}
            </AppAnimatedNumber>
          </AppMetricTile>
        </template>
      </AppMetricGrid>

      <StockCard
        title="Vendables en ce moment"
        subtitle="Offres actives dont tous les composants sont en stock"
        class="recommended mb-6"
      >
        <div class="pa-5">
          <VSkeletonLoader
            v-if="recommended.data.value === null && !recommended.error.value"
            type="list-item-two-line"
          />
          <VAlert
            v-else-if="recommended.data.value === null"
            type="warning"
            variant="tonal"
            density="comfortable"
          >
            Impossible de calculer les offres vendables.
            <template #append>
              <VBtn
                size="small"
                variant="text"
                @click="recommended.reload()"
              >
                Réessayer
              </VBtn>
            </template>
          </VAlert>
          <p
            v-else-if="recommended.data.value.length === 0"
            class="text-body-2 text-medium-emphasis mb-0"
          >
            Aucune combinaison n'est vendable pour l'instant : activez une offre ou réapprovisionnez ses composants.
          </p>
          <VRow v-else>
            <VCol
              v-for="item in recommended.data.value"
              :key="item.id"
              cols="12"
              sm="6"
              lg="4"
            >
              <div class="recommended__item pa-4">
                <div class="d-flex justify-space-between align-start gap-3">
                  <div class="text-body-1 font-weight-semibold text-high-emphasis min-w-0 text-break">
                    {{ item.nom }}
                  </div>
                  <span class="text-body-1 font-weight-semibold text-primary tabular-nums text-no-wrap">
                    {{ formatMoney(item.prix, item.devise) }}
                  </span>
                </div>
                <div class="d-flex flex-wrap gap-1 mt-2">
                  <VChip
                    v-for="name in names(item)"
                    :key="name"
                    size="small"
                    label
                  >
                    {{ name }}
                  </VChip>
                </div>
              </div>
            </VCol>
          </VRow>
        </div>
      </StockCard>

      <StockCard title="Toutes les combinaisons">
        <template #toolbar>
          <div class="stock-filter">
            <AppSegmented
              v-model="filter"
              :options="filterOptions"
              label="Filtrer les combinaisons par statut"
            />
          </div>
          <VTextField
            v-model="search"
            class="stock-search"
            label="Rechercher une combinaison"
            placeholder="Nom ou composant"
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
          icon="ri-restaurant-2-line"
          :title="hasFilters ? 'Aucune combinaison ne correspond' : 'Aucune combinaison pour l\'instant'"
          :text="hasFilters ? 'Essayez un autre statut ou une autre recherche.' : 'Composez une offre à prix unique à partir de vos composants.'"
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
            v-else-if="canWrite"
            color="primary"
            prepend-icon="ri-add-line"
            @click="openDialog(null)"
          >
            Nouvelle combinaison
          </VBtn>
        </AppEmptyState>

        <template v-else>
          <VTable
            hover
            aria-label="Liste des combinaisons"
          >
            <thead>
              <tr>
                <th>Combinaison</th>
                <th class="d-none d-md-table-cell">
                  Composants
                </th>
                <th class="text-end">
                  Prix
                </th>
                <th>Statut</th>
                <th
                  v-if="canWrite"
                  class="text-end"
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in pager.rows.value"
                :key="item.id"
                :class="[saleOf(item) === 'blocked' ? 'row--alerte' : undefined, saleOf(item) === 'off' ? 'row--muted' : undefined]"
              >
                <td>
                  <ItemCell
                    icon="ri-restaurant-2-line"
                    :title="item.nom"
                    :muted="saleOf(item) === 'off'"
                  >
                    <template #subtitle>
                      {{ item.composant_ids.length }} composant{{ item.composant_ids.length > 1 ? 's' : '' }}
                    </template>
                    <div
                      v-if="saleOf(item) === 'blocked' && blockers(item).length"
                      class="text-caption text-warning mt-1"
                    >
                      Bloquée par {{ blockers(item).join(', ') }}
                    </div>
                  </ItemCell>
                </td>
                <td class="d-none d-md-table-cell">
                  <div class="d-flex flex-wrap gap-1 py-2">
                    <VChip
                      v-for="name in names(item)"
                      :key="name"
                      size="small"
                      label
                    >
                      {{ name }}
                    </VChip>
                  </div>
                </td>
                <td class="text-end font-weight-semibold text-high-emphasis tabular-nums text-no-wrap">
                  {{ formatMoney(item.prix, item.devise) }}
                </td>
                <td>
                  <AppStatusChip
                    :label="SALE_INFO[saleOf(item)].label"
                    :tone="SALE_INFO[saleOf(item)].tone"
                    :icon="SALE_INFO[saleOf(item)].icon"
                  />
                </td>
                <td
                  v-if="canWrite"
                  class="text-end"
                >
                  <IconBtn
                    :aria-label="`Modifier ${item.nom}`"
                    @click="openDialog(item)"
                  >
                    <VIcon icon="ri-edit-line" />
                    <VTooltip
                      activator="parent"
                      location="top"
                    >
                      Modifier
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

    <CombinaisonFormDialog
      v-model="dialogOpen"
      :combinaison="editing"
      :composants="composants.data.value ?? []"
      @saved="afterSave"
    />
  </div>
</template>

<style scoped>
.recommended {
  border-color: rgba(var(--v-theme-success), 0.35) !important;
}

.recommended__item {
  border: 1px solid rgba(var(--v-theme-success), 0.25);
  border-radius: 14px;
  background:
    radial-gradient(circle at 100% 0%, rgba(var(--v-theme-success), 0.12), transparent 60%),
    rgba(var(--v-theme-success), 0.04);
  block-size: 100%;
}
</style>
