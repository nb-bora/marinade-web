<script setup lang="ts">
import { catalogApi } from '../api'
import AvailabilitySwitch from '../components/AvailabilitySwitch.vue'
import CatalogToolbar from '../components/CatalogToolbar.vue'
import PlatDetailDrawer from '../components/PlatDetailDrawer.vue'
import PlatFormDialog from '../components/PlatFormDialog.vue'
import ProductIdentity from '../components/ProductIdentity.vue'
import { useAvailabilityToggle } from '../composables/useAvailabilityToggle'
import { useMenus } from '../composables/useMenus'
import { platsImport } from '../imports'
import { SORT_NAME, SORT_PRICE_ASC, SORT_PRICE_DESC, SORT_RECENT, SORT_TIME, matchesSearch, normalize, plural, priceStats, sortProducts } from '../products'
import type { SortKey } from '../products'
import type { Plat } from '../types'
import { useAsyncData } from '@/composables/useAsyncData'
import { useClientPagination } from '@/composables/useClientPagination'
import { formatMoney } from '@/lib/format'
import { useTenantStore } from '@/stores/tenant.store'

const NO_CATEGORY = '__none__'

const tenant = useTenantStore()
const canWrite = computed(() => tenant.can('management'))

const { data, loading, error, reload, refresh } = useAsyncData(
  signal => tenant.currentId ? catalogApi.plats(tenant.currentId, signal) : Promise.resolve([]),
  { watch: [() => tenant.currentId] },
)

const { menus, categories, loaded: menusLoaded, refresh: refreshMenus } = useMenus()

const route = useRoute()
const router = useRouter()
const importDialog = ref(false)
const importDefinition = platsImport()

const plats = computed(() => data.value ?? [])
const loadedOnce = computed(() => data.value !== null)

// Filtres ------------------------------------------------------------------------------------

const search = ref('')
const searchDebounced = refDebounced(search, 250)
const category = ref<string | null>(null)
const availability = ref<'all' | 'on' | 'off'>('all')
const sort = ref<SortKey>('name')

// « Voir les plats » d'un menu arrive ici avec ?menu=<identifiant> ; le filtre reste synchronisé avec l'adresse.
const queryMenu = () => typeof route.query.menu === 'string' ? route.query.menu : null
const menuFilter = ref<string | null>(queryMenu())

watch(() => route.query.menu, () => {
  if (menuFilter.value !== queryMenu())
    menuFilter.value = queryMenu()
})

watch(menuFilter, value => {
  if (value !== queryMenu())
    router.replace({ query: { ...route.query, menu: value ?? undefined } })
})

// Un lien périmé (menu supprimé) ne doit pas laisser une liste vide sans explication.
watch([menusLoaded, menus], () => {
  if (menusLoaded.value && menuFilter.value && !menus.value.some(menu => menu.id === menuFilter.value))
    menuFilter.value = null
})

const hasFilters = computed(() => search.value.trim() !== '' || category.value !== null || menuFilter.value !== null || availability.value !== 'all')

// Catégories proposées : celles du menu choisi, sinon toutes (avec le menu pour les distinguer).
const categoryInfo = computed(() => new Map(categories.value.map(item => [item.id, item])))

const categoryItems = computed(() => {
  const scoped = menuFilter.value ? categories.value.filter(item => item.menu_id === menuFilter.value) : categories.value
  const withMenu = !menuFilter.value && menus.value.length > 1

  return [
    { value: NO_CATEGORY, title: 'Sans catégorie' },
    ...scoped.map(item => ({ value: item.id, title: withMenu ? `${item.name} (${item.menuName})` : item.name })),
  ]
})

// Choisir un autre menu efface une catégorie qui n'en fait pas partie.
watch(menuFilter, () => {
  if (category.value && category.value !== NO_CATEGORY && !categoryItems.value.some(item => item.value === category.value))
    category.value = null
})

const menuItems = computed(() => menus.value.map(item => ({ value: item.id, title: item.name })))

const menuCategoryIds = computed(() => new Set(categories.value.filter(item => item.menu_id === menuFilter.value).map(item => item.id)))

const filtered = computed(() => {
  const term = normalize(searchDebounced.value.trim())

  const rows = plats.value.filter(plat => {
    if (!matchesSearch(term, plat.nom, plat.description))
      return false
    if (menuFilter.value && !(plat.category_id && menuCategoryIds.value.has(plat.category_id)))
      return false
    if (category.value === NO_CATEGORY && plat.category_id)
      return false
    if (category.value && category.value !== NO_CATEGORY && plat.category_id !== category.value)
      return false
    if (availability.value === 'on' && !plat.disponible)
      return false

    return !(availability.value === 'off' && plat.disponible)
  })

  return sortProducts(rows, sort.value)
})

const pagination = useClientPagination(filtered, 25)

function clearFilters() {
  search.value = ''
  category.value = null
  menuFilter.value = null
  availability.value = 'all'
}

const sortOptions = [SORT_NAME, SORT_PRICE_ASC, SORT_PRICE_DESC, SORT_TIME, SORT_RECENT]

// Le filtre par menu a besoin des catégories : tant qu'elles se chargent, on n'affiche pas une liste vide.
const listReady = computed(() => loadedOnce.value && (!menuFilter.value || menusLoaded.value))

// Indicateurs, sur toute la carte (indépendants des filtres) ----------------------------------

const counts = computed(() => {
  const on = plats.value.filter(plat => plat.disponible).length

  return { all: plats.value.length, on, off: plats.value.length - on }
})

const uncategorized = computed(() => plats.value.filter(plat => !plat.category_id).length)
const prices = computed(() => priceStats(plats.value))

const averageTime = computed(() => {
  const times = plats.value.map(plat => plat.temps_preparation).filter((value): value is number => value != null)

  return times.length ? Math.round(times.reduce((sum, value) => sum + value, 0) / times.length) : null
})

const availablePercent = computed(() => counts.value.all ? Math.round(counts.value.on / counts.value.all * 100) : 0)

// Formulaire et tiroir -----------------------------------------------------------------------

const formOpen = ref(false)
const edited = ref<Plat | null>(null)
const selectedId = ref<string | null>(null)
const drawer = ref<InstanceType<typeof PlatDetailDrawer>>()

function newPlat() {
  edited.value = null
  formOpen.value = true
}

function editPlat(plat: Plat) {
  edited.value = plat
  formOpen.value = true
}

function afterSave() {
  refresh()
  refreshMenus()
  drawer.value?.reload()
}

// Disponibilité ------------------------------------------------------------------------------

const { toggle, busyId } = useAvailabilityToggle<Plat>({
  copy: plat => ({
    off: {
      title: 'Marquer ce plat indisponible ?',
      text: `« ${plat.nom} » ne pourra plus être commandé.`,
      done: `« ${plat.nom} » est marqué indisponible.`,
    },
    on: {
      title: 'Remettre ce plat en vente ?',
      text: `« ${plat.nom} » pourra de nouveau être commandé.`,
      done: `« ${plat.nom} » est de nouveau disponible.`,
    },
  }),
  update: (id, disponible) => catalogApi.updatePlat(id, { disponible }),
  done: async () => {
    await refresh()
    await drawer.value?.reload()
  },
})

const openRow = (plat: Plat) => {
  selectedId.value = plat.id
}

const selectedPlat = computed(() => plats.value.find(plat => plat.id === selectedId.value))
</script>

<template>
  <div>
    <AppHero
      eyebrow="Carte"
      title="Plats"
      subtitle="Les plats proposés par votre restaurant, leurs prix et leur disponibilité en salle."
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
          @click="newPlat"
        >
          Nouveau plat
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

    <!-- Carte vide : on invite à créer le premier plat plutôt que d'afficher des zéros. -->
    <VCard
      v-else-if="loadedOnce && plats.length === 0"
      class="mt-6"
    >
      <AppEmptyState
        icon="ri-restaurant-2-line"
        :title="canWrite ? 'Votre carte est vide' : 'Aucun plat pour l\'instant'"
        :text="canWrite
          ? 'Ajoutez votre premier plat, ou importez toute votre carte depuis un fichier Excel.'
          : 'Aucun plat n\'a encore été ajouté par la direction.'"
      >
        <div
          v-if="canWrite"
          class="d-flex flex-wrap justify-center gap-3"
        >
          <VBtn
            prepend-icon="ri-add-line"
            @click="newPlat"
          >
            Ajouter un plat
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
          label="Plats à la carte"
          icon="ri-restaurant-2-line"
          :hint="uncategorized ? `${uncategorized} sans catégorie` : 'Tous rangés dans un menu'"
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
          label="Prix moyen"
          icon="ri-money-dollar-circle-line"
          color="info"
          :hint="prices ? `De ${formatMoney(prices.min, prices.currency)} à ${formatMoney(prices.max, prices.currency)}` : undefined"
        >
          {{ prices ? formatMoney(Math.round(prices.average), prices.currency) : '—' }}
        </AppMetricTile>
        <AppMetricTile
          label="Préparation moyenne"
          icon="ri-timer-line"
          color="warning"
          :hint="averageTime === null ? 'Temps non renseignés' : undefined"
        >
          {{ averageTime === null ? '—' : `${averageTime} min` }}
        </AppMetricTile>
      </AppMetricGrid>

      <VCard class="catalog-card">
        <CatalogToolbar
          v-model:availability="availability"
          v-model:search="search"
          v-model:sort="sort"
          :counts="counts"
          noun="plat"
          :shown="filtered.length"
          :total="plats.length"
          :has-filters="hasFilters"
          :loaded="listReady"
          :sort-options="sortOptions"
          @clear="clearFilters"
        >
          <VSelect
            v-model="menuFilter"
            :items="menuItems"
            label="Menu"
            prepend-inner-icon="ri-book-open-line"
            placeholder="Tous les menus"
            density="compact"
            variant="solo-filled"
            flat
            rounded="lg"
            hide-details
            clearable
          />
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
        </CatalogToolbar>

        <VDivider />

        <VSkeletonLoader
          v-if="!listReady"
          type="table-thead, table-tbody"
        />

        <AppEmptyState
          v-else-if="filtered.length === 0"
          icon="ri-restaurant-2-line"
          title="Aucun plat ne correspond"
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
                  Plat
                </th>
                <th
                  scope="col"
                  class="d-none d-md-table-cell"
                >
                  Catégorie
                </th>
                <th
                  scope="col"
                  class="text-end"
                >
                  Prix
                </th>
                <th
                  scope="col"
                  class="text-end d-none d-md-table-cell"
                >
                  Préparation
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
                v-for="plat in pagination.rows.value"
                :key="plat.id"
                class="catalog-row"
                :class="{ 'catalog-row--off': !plat.disponible }"
                tabindex="0"
                :aria-label="`Ouvrir la fiche de ${plat.nom}`"
                @click="openRow(plat)"
                @keydown.enter="openRow(plat)"
                @keydown.space.prevent="openRow(plat)"
              >
                <td>
                  <ProductIdentity
                    :name="plat.nom"
                    :description="plat.description"
                    :photo-url="plat.photo_url"
                    icon="ri-restaurant-2-line"
                    :muted="!plat.disponible"
                  >
                    <span
                      v-if="categoryInfo.get(plat.category_id ?? '')"
                      class="catalog-pill"
                    >{{ categoryInfo.get(plat.category_id ?? '')?.name }}</span>
                    <span
                      v-if="plat.temps_preparation != null"
                      class="catalog-meta"
                    >
                      <VIcon
                        icon="ri-timer-line"
                        size="14"
                      />
                      {{ plat.temps_preparation }} min
                    </span>
                  </ProductIdentity>
                </td>
                <td class="d-none d-md-table-cell">
                  <span
                    v-if="categoryInfo.get(plat.category_id ?? '')"
                    class="catalog-pill"
                    :title="`Menu ${categoryInfo.get(plat.category_id ?? '')?.menuName}`"
                  >{{ categoryInfo.get(plat.category_id ?? '')?.name }}</span>
                  <span
                    v-else
                    class="text-disabled"
                    title="Ce plat n'est dans aucune catégorie"
                  >—</span>
                </td>
                <td class="text-end catalog-price">
                  <AppMoney
                    :amount="plat.prix"
                    :currency="plat.devise"
                  />
                </td>
                <td class="text-end d-none d-md-table-cell">
                  <span
                    v-if="plat.temps_preparation != null"
                    class="catalog-meta"
                  >
                    <VIcon
                      icon="ri-timer-line"
                      size="14"
                    />
                    {{ plat.temps_preparation }} min
                  </span>
                  <span
                    v-else
                    class="text-disabled"
                  >—</span>
                </td>
                <td class="text-center">
                  <AvailabilitySwitch
                    :available="plat.disponible"
                    :can-write="canWrite"
                    :name="plat.nom"
                    :busy="busyId === plat.id"
                    :locked="busyId !== null"
                    @toggle="toggle(plat)"
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

    <PlatFormDialog
      v-model="formOpen"
      :plat="edited"
      :categories="categories"
      :categories-ready="menusLoaded"
      @saved="afterSave"
    />

    <AppImportDialog
      v-if="canWrite"
      v-model="importDialog"
      v-bind="importDefinition"
      @imported="afterSave"
    />

    <PlatDetailDrawer
      ref="drawer"
      v-model="selectedId"
      :can-write="canWrite"
      :category-name="categoryInfo.get(selectedPlat?.category_id ?? '')?.name ?? null"
      :busy="busyId !== null && busyId === selectedId"
      @edit="editPlat"
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

.catalog-meta {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.8125rem;
}

@media (width <= 599px) {
  .catalog-table :deep(th),
  .catalog-table :deep(td) {
    padding-inline: 8px !important;
  }
}
</style>
