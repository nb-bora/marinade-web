<script setup lang="ts">
import { catalogApi } from '../api'
import AvailabilitySwitch from '../components/AvailabilitySwitch.vue'
import BoissonDetailDrawer from '../components/BoissonDetailDrawer.vue'
import BoissonFormDialog from '../components/BoissonFormDialog.vue'
import CatalogToolbar from '../components/CatalogToolbar.vue'
import ProductIdentity from '../components/ProductIdentity.vue'
import { useAvailabilityToggle } from '../composables/useAvailabilityToggle'
import { boissonsImport } from '../imports'
import { SORT_NAME, SORT_PRICE_ASC, SORT_PRICE_DESC, SORT_RECENT, matchesSearch, normalize, plural, priceStats, sortProducts } from '../products'
import type { SortKey } from '../products'
import type { Boisson } from '../types'
import { useAsyncData } from '@/composables/useAsyncData'
import { useClientPagination } from '@/composables/useClientPagination'
import { formatMoney } from '@/lib/format'
import { useTenantStore } from '@/stores/tenant.store'

const NO_CATEGORY = '__none__'

const tenant = useTenantStore()
const canWrite = computed(() => tenant.can('management'))
const importDialog = ref(false)
const importDefinition = boissonsImport()

const { data, loading, error, reload, refresh } = useAsyncData(
  signal => tenant.currentId ? catalogApi.boissons(tenant.currentId, signal) : Promise.resolve([]),
  { watch: [() => tenant.currentId] },
)

const boissons = computed(() => data.value ?? [])
const loadedOnce = computed(() => data.value !== null)

// Catégories : « Jus » et « jus » sont la même (comparées sans casse ni accents), la première écriture rencontrée est affichée.
const categoryKey = (value: string) => normalize(value.trim())

const usedCategories = computed(() => {
  const byKey = new Map<string, string>()

  for (const boisson of boissons.value) {
    const name = boisson.category?.trim()

    if (name && !byKey.has(categoryKey(name)))
      byKey.set(categoryKey(name), name)
  }

  return [...byKey.entries()]
    .map(([key, title]) => ({ value: key, title }))
    .sort((a, b) => a.title.localeCompare(b.title, 'fr'))
})

// Filtres ------------------------------------------------------------------------------------

const search = ref('')
const searchDebounced = refDebounced(search, 250)
const category = ref<string | null>(null)
const alcohol = ref<'all' | 'with' | 'without'>('all')
const availability = ref<'all' | 'on' | 'off'>('all')
const sort = ref<SortKey>('name')

const hasFilters = computed(() =>
  search.value.trim() !== '' || category.value !== null || alcohol.value !== 'all' || availability.value !== 'all')

const categoryItems = computed(() => [{ value: NO_CATEGORY, title: 'Sans catégorie' }, ...usedCategories.value])

// Une catégorie qui n'existe plus (boisson renommée ou retirée) ne doit pas laisser un filtre invisible.
watch(categoryItems, items => {
  if (category.value && !items.some(item => item.value === category.value))
    category.value = null
})

const alcoholItems = [
  { value: 'all', title: 'Toutes' },
  { value: 'without', title: 'Sans alcool' },
  { value: 'with', title: 'Avec alcool' },
]

const filtered = computed(() => {
  const term = normalize(searchDebounced.value.trim())

  const rows = boissons.value.filter(boisson => {
    const key = boisson.category?.trim() ? categoryKey(boisson.category) : null

    if (!matchesSearch(term, boisson.nom, boisson.description, boisson.category))
      return false
    if (category.value === NO_CATEGORY && key)
      return false
    if (category.value && category.value !== NO_CATEGORY && key !== category.value)
      return false
    if (alcohol.value === 'with' && !boisson.alcool)
      return false
    if (alcohol.value === 'without' && boisson.alcool)
      return false
    if (availability.value === 'on' && !boisson.disponible)
      return false

    return !(availability.value === 'off' && boisson.disponible)
  })

  return sortProducts(rows, sort.value)
})

const pagination = useClientPagination(filtered, 25)

function clearFilters() {
  search.value = ''
  category.value = null
  alcohol.value = 'all'
  availability.value = 'all'
}

const sortOptions = [SORT_NAME, SORT_PRICE_ASC, SORT_PRICE_DESC, SORT_RECENT]

// Indicateurs, sur toute la carte (indépendants des filtres) ----------------------------------

const counts = computed(() => {
  const on = boissons.value.filter(boisson => boisson.disponible).length

  return { all: boissons.value.length, on, off: boissons.value.length - on }
})

const alcoholic = computed(() => boissons.value.filter(boisson => boisson.alcool).length)
const prices = computed(() => priceStats(boissons.value))
const availablePercent = computed(() => counts.value.all ? Math.round(counts.value.on / counts.value.all * 100) : 0)

// Formulaire et tiroir -----------------------------------------------------------------------

const formOpen = ref(false)
const edited = ref<Boisson | null>(null)
const selectedId = ref<string | null>(null)
const drawer = ref<InstanceType<typeof BoissonDetailDrawer>>()

function newBoisson() {
  edited.value = null
  formOpen.value = true
}

function editBoisson(boisson: Boisson) {
  edited.value = boisson
  formOpen.value = true
}

function afterSave() {
  refresh()
  drawer.value?.reload()
}

// Disponibilité ------------------------------------------------------------------------------

const { toggle, busyId } = useAvailabilityToggle<Boisson>({
  copy: boisson => ({
    off: {
      title: 'Marquer cette boisson indisponible ?',
      text: `« ${boisson.nom} » ne pourra plus être commandée.`,
      done: `« ${boisson.nom} » est marquée indisponible.`,
    },
    on: {
      title: 'Remettre cette boisson en vente ?',
      text: `« ${boisson.nom} » pourra de nouveau être commandée.`,
      done: `« ${boisson.nom} » est de nouveau disponible.`,
    },
  }),
  update: (id, disponible) => catalogApi.updateBoisson(id, { disponible }),
  done: async () => {
    await refresh()
    await drawer.value?.reload()
  },
})

const openRow = (boisson: Boisson) => {
  selectedId.value = boisson.id
}
</script>

<template>
  <div>
    <AppHero
      eyebrow="Carte"
      title="Boissons"
      subtitle="La carte des boissons : catégories, prix, alcool et disponibilité."
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
        <VBtn
          v-if="canWrite"
          variant="tonal"
          color="secondary"
          prepend-icon="ri-upload-2-line"
          @click="importDialog = true"
        >
          Importer
        </VBtn>
        <VBtn
          v-if="canWrite"
          color="primary"
          prepend-icon="ri-add-line"
          @click="newBoisson"
        >
          Nouvelle boisson
        </VBtn>
      </template>
    </AppHero>

    <AppErrorState
      v-if="error"
      :class="loadedOnce ? 'mt-5' : 'mt-6'"
      :error="error"
      @retry="reload"
    />

    <AppMetricGrid
      v-if="!loadedOnce && !error"
      class="mt-5 mb-6"
    >
      <VSkeletonLoader
        v-for="n in 4"
        :key="n"
        type="heading, text"
        class="metric-skeleton"
      />
    </AppMetricGrid>

    <!-- Carte vide : on invite à créer la première boisson plutôt que d'afficher des zéros. -->
    <VCard
      v-else-if="loadedOnce && boissons.length === 0"
      class="mt-6"
    >
      <AppEmptyState
        icon="ri-goblet-line"
        :title="canWrite ? 'Aucune boisson à la carte' : 'Aucune boisson pour l\'instant'"
        :text="canWrite
          ? 'Ajoutez vos boissons pour pouvoir les servir et les encaisser, ou importez-les depuis un fichier Excel.'
          : 'Aucune boisson n\'a encore été ajoutée par la direction.'"
      >
        <div
          v-if="canWrite"
          class="d-flex flex-wrap justify-center gap-3"
        >
          <VBtn
            prepend-icon="ri-add-line"
            @click="newBoisson"
          >
            Ajouter une boisson
          </VBtn>
          <VBtn
            variant="outlined"
            color="secondary"
            prepend-icon="ri-upload-2-line"
            @click="importDialog = true"
          >
            Importer depuis Excel
          </VBtn>
        </div>
      </AppEmptyState>
    </VCard>

    <template v-else-if="loadedOnce">
      <AppMetricGrid class="mt-5 mb-6">
        <AppMetricTile
          hero
          label="Boissons à la carte"
          icon="ri-goblet-line"
          :hint="usedCategories.length ? plural(usedCategories.length, 'catégorie') : 'Sans catégorie'"
        >
          <AppAnimatedNumber
            v-slot="{ current }"
            :value="counts.all"
          >
            {{ current }}
          </AppAnimatedNumber>
        </AppMetricTile>
        <AppMetricTile
          label="Disponibles"
          icon="ri-checkbox-circle-line"
          color="success"
          :hint="counts.off ? `${plural(counts.off, 'indisponible')} en ce moment` : 'Tout est en vente'"
          :gauge="availablePercent"
          :gauge-label="`${availablePercent} % de la carte est disponible`"
        >
          <AppAnimatedNumber
            v-slot="{ current }"
            :value="counts.on"
          >
            {{ current }}
          </AppAnimatedNumber>
        </AppMetricTile>
        <AppMetricTile
          label="Avec alcool"
          icon="ri-goblet-fill"
          color="warning"
          :hint="`${counts.all - alcoholic} sans alcool`"
        >
          <AppAnimatedNumber
            v-slot="{ current }"
            :value="alcoholic"
          >
            {{ current }}
          </AppAnimatedNumber>
        </AppMetricTile>
        <AppMetricTile
          label="Prix moyen"
          icon="ri-money-dollar-circle-line"
          color="info"
          :hint="prices ? `De ${formatMoney(prices.min, prices.currency)} à ${formatMoney(prices.max, prices.currency)}` : undefined"
        >
          {{ prices ? formatMoney(Math.round(prices.average), prices.currency) : '—' }}
        </AppMetricTile>
      </AppMetricGrid>

      <VCard class="catalog-card">
        <CatalogToolbar
          v-model:availability="availability"
          v-model:search="search"
          v-model:sort="sort"
          :counts="counts"
          noun="boisson"
          :shown="filtered.length"
          :total="boissons.length"
          :has-filters="hasFilters"
          :loaded="loadedOnce"
          :sort-options="sortOptions"
          @clear="clearFilters"
        >
          <VSelect
            v-model="category"
            :items="categoryItems"
            label="Catégorie"
            prepend-inner-icon="ri-price-tag-3-line"
            placeholder="Toutes les catégories"
            density="compact"
            variant="solo-filled"
            flat
            rounded="lg"
            hide-details
            clearable
          />
          <VSelect
            v-model="alcohol"
            :items="alcoholItems"
            label="Alcool"
            prepend-inner-icon="ri-goblet-line"
            density="compact"
            variant="solo-filled"
            flat
            rounded="lg"
            hide-details
          />
        </CatalogToolbar>

        <VDivider />

        <AppEmptyState
          v-if="filtered.length === 0"
          icon="ri-goblet-line"
          title="Aucune boisson ne correspond"
          text="Essayez d'autres filtres ou une autre recherche."
        >
          <VBtn
            variant="outlined"
            prepend-icon="ri-filter-off-line"
            @click="clearFilters"
          >
            Effacer les filtres
          </VBtn>
        </AppEmptyState>

        <template v-else>
          <VTable
            hover
            class="catalog-table"
          >
            <thead>
              <tr>
                <th scope="col">
                  Boisson
                </th>
                <th
                  scope="col"
                  class="d-none d-md-table-cell"
                >
                  Catégorie
                </th>
                <th
                  scope="col"
                  class="d-none d-sm-table-cell"
                >
                  Alcool
                </th>
                <th
                  scope="col"
                  class="text-end"
                >
                  Prix
                </th>
                <th
                  scope="col"
                  class="text-center"
                >
                  En vente
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="boisson in pagination.rows.value"
                :key="boisson.id"
                class="catalog-row"
                :class="{ 'catalog-row--off': !boisson.disponible }"
                tabindex="0"
                :aria-label="`Ouvrir la fiche de ${boisson.nom}`"
                @click="openRow(boisson)"
                @keydown.enter="openRow(boisson)"
                @keydown.space.prevent="openRow(boisson)"
              >
                <td>
                  <ProductIdentity
                    :name="boisson.nom"
                    :description="boisson.description"
                    icon="ri-goblet-line"
                    :color="boisson.alcool ? 'warning' : 'info'"
                    :muted="!boisson.disponible"
                  >
                    <span
                      v-if="boisson.category"
                      class="catalog-pill"
                    >{{ boisson.category }}</span>
                    <AppStatusChip
                      v-if="boisson.alcool"
                      class="d-sm-none"
                      label="Alcool"
                      tone="warning"
                    />
                  </ProductIdentity>
                </td>
                <td class="d-none d-md-table-cell">
                  <span
                    v-if="boisson.category"
                    class="catalog-pill"
                  >{{ boisson.category }}</span>
                  <span
                    v-else
                    class="text-disabled"
                    title="Cette boisson n'a pas de catégorie"
                  >—</span>
                </td>
                <td class="d-none d-sm-table-cell">
                  <AppStatusChip
                    :label="boisson.alcool ? 'Avec alcool' : 'Sans alcool'"
                    :tone="boisson.alcool ? 'warning' : 'info'"
                    :icon="boisson.alcool ? 'ri-goblet-fill' : 'ri-drop-line'"
                  />
                </td>
                <td class="text-end catalog-price">
                  <AppMoney
                    :amount="boisson.prix"
                    :currency="boisson.devise"
                  />
                </td>
                <td class="text-center">
                  <AvailabilitySwitch
                    :available="boisson.disponible"
                    :can-write="canWrite"
                    :name="boisson.nom"
                    :busy="busyId === boisson.id"
                    :locked="busyId !== null"
                    @toggle="toggle(boisson)"
                  />
                </td>
              </tr>
            </tbody>
          </VTable>

          <VDivider />

          <AppTablePagination
            :page="pagination.page.value"
            :page-size="pagination.pageSize.value"
            :count="pagination.rows.value.length"
            :total="pagination.total.value"
            :pages="pagination.pages.value"
            :has-next="pagination.hasNext.value"
            @update:page="pagination.page.value = $event"
            @update:page-size="pagination.pageSize.value = $event"
          />
        </template>
      </VCard>
    </template>

    <BoissonFormDialog
      v-model="formOpen"
      :boisson="edited"
      :suggestions="usedCategories.map(item => item.title)"
      @saved="afterSave"
    />

    <AppImportDialog
      v-if="canWrite"
      v-model="importDialog"
      v-bind="importDefinition"
      @imported="afterSave"
    />

    <BoissonDetailDrawer
      ref="drawer"
      v-model="selectedId"
      :can-write="canWrite"
      :busy="busyId !== null && busyId === selectedId"
      @edit="editBoisson"
      @toggle="toggle"
    />
  </div>
</template>

<style scoped>
.catalog-card {
  overflow: hidden;
  border: 1px solid rgba(var(--v-border-color), 0.16);
  border-radius: 18px;
}

.metric-skeleton {
  border: 1px solid rgba(var(--v-border-color), 0.16);
  border-radius: 16px;
}

.catalog-row {
  cursor: pointer;
}

.catalog-row:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: -2px;
}

.catalog-row--off .catalog-price {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

.catalog-price {
  font-weight: 700;
}

.catalog-pill {
  display: inline-block;
  max-inline-size: 14rem;
  overflow: hidden;
  padding: 2px 10px;
  border-radius: 999px;
  background: rgba(var(--v-theme-primary), 0.1);
  color: rgb(var(--v-theme-primary));
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1.5;
  text-overflow: ellipsis;
  vertical-align: middle;
  white-space: nowrap;
}

.catalog-row--off .catalog-pill {
  background: rgba(var(--v-theme-on-surface), 0.07);
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

@media (width <= 599px) {
  .catalog-table :deep(th),
  .catalog-table :deep(td) {
    padding-inline: 8px !important;
  }
}
</style>
