<script setup lang="ts">
import { catalogApi } from '../api'
import PlatDetailDrawer from '../components/PlatDetailDrawer.vue'
import PlatFormDialog from '../components/PlatFormDialog.vue'
import ProductAvatar from '../components/ProductAvatar.vue'
import { useMenus } from '../composables/useMenus'
import { platsImport } from '../imports'
import type { Plat } from '../types'
import { useAsyncData } from '@/composables/useAsyncData'
import { useClientPagination } from '@/composables/useClientPagination'
import { useSubmit } from '@/composables/useSubmit'
import { useConfirm } from '@/composables/useConfirm'
import { formatMoney } from '@/lib/format'
import { useTenantStore } from '@/stores/tenant.store'
import { useToast } from '@/stores/toast.store'

const NO_CATEGORY = '__none__'

const tenant = useTenantStore()
const toast = useToast()
const canWrite = computed(() => tenant.can('management'))

const { data, loading, error, reload, refresh } = useAsyncData(
  signal => tenant.currentId ? catalogApi.plats(tenant.currentId, signal) : Promise.resolve([]),
  { watch: [() => tenant.currentId] },
)

const { menus, categories, categoryName, refresh: refreshMenus } = useMenus()

const route = useRoute()
const importDialog = ref(false)
const importDefinition = platsImport()

const plats = computed(() => data.value ?? [])
const loadedOnce = computed(() => data.value !== null)

// Filtres
const search = ref('')
const searchDebounced = refDebounced(search, 250)
const category = ref<string | null>(null)

// « Voir les plats » d'un menu arrive ici avec ?menu=<identifiant>.
const menuFilter = ref<string | null>(typeof route.query.menu === 'string' ? route.query.menu : null)
const availability = ref<'all' | 'on' | 'off'>('all')

const hasFilters = computed(() => search.value.trim() !== '' || category.value !== null || menuFilter.value !== null || availability.value !== 'all')

const menuCategoryIds = computed(() => new Set(categories.value.filter(item => item.menu_id === menuFilter.value).map(item => item.id)))

const normalize = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

const filtered = computed(() => {
  const term = normalize(searchDebounced.value.trim())

  return plats.value
    .filter(plat => {
      if (term && !normalize(`${plat.nom} ${plat.description ?? ''}`).includes(term))
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
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
})

const pagination = useClientPagination(filtered, 10)

function clearFilters() {
  search.value = ''
  category.value = null
  menuFilter.value = null
  availability.value = 'all'
}

const menuItems = computed(() => menus.value.map(item => ({ value: item.id, title: item.name })))

const categoryItems = computed(() => [
  { value: NO_CATEGORY, title: 'Sans catégorie' },
  ...categories.value.map(item => ({ value: item.id, title: `${item.name} (${item.menuName})` })),
])

const availabilityItems = [
  { value: 'all', title: 'Tous' },
  { value: 'on', title: 'Disponibles' },
  { value: 'off', title: 'Indisponibles' },
]

// Indicateurs, sur toute la carte (indépendants des filtres).
const stats = computed(() => {
  const count = plats.value.length
  const available = plats.value.filter(plat => plat.disponible).length
  const prices = plats.value.map(plat => Number(plat.prix))
  const times = plats.value.map(plat => plat.temps_preparation).filter((value): value is number => value != null)
  const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
  const averagePrice = average(prices)
  const averageTime = average(times)

  return [
    {
      label: 'Plats à la carte',
      value: String(count),
      icon: 'ri-restaurant-2-line',
      hint: count ? undefined : 'Aucun plat',
    },
    {
      label: 'Disponibles',
      value: String(available),
      icon: 'ri-checkbox-circle-line',
      hint: count ? `${count - available} indisponible${count - available > 1 ? 's' : ''}` : undefined,
      hintColor: count - available > 0 ? 'warning' as const : 'success' as const,
    },
    {
      label: 'Prix moyen',
      value: averagePrice === null ? '—' : formatMoney(Math.round(averagePrice)),
      icon: 'ri-money-dollar-circle-line',
      hint: prices.length ? `De ${formatMoney(Math.min(...prices))} à ${formatMoney(Math.max(...prices))}` : undefined,
    },
    {
      label: 'Préparation moyenne',
      value: averageTime === null ? '—' : `${Math.round(averageTime)} min`,
      icon: 'ri-timer-line',
      hint: times.length ? undefined : 'Temps non renseignés',
    },
  ]
})

// Formulaire et tiroir
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

// Disponibilité
const toggling = ref<string | null>(null)

const { submit: toggle, error: toggleError } = useSubmit(async (plat: Plat) => {
  const accepted = await useConfirm()({
    title: plat.disponible ? 'Marquer ce plat indisponible ?' : 'Remettre ce plat en vente ?',
    text: `« ${plat.nom} » ${plat.disponible ? 'ne pourra plus être commandé.' : 'pourra de nouveau être commandé.'}`,
    confirmLabel: 'Enregistrer',
  })

  if (!accepted)
    return

  toggling.value = plat.id
  try {
    await catalogApi.updatePlat(plat.id, { disponible: !plat.disponible })
    toast.success(plat.disponible ? `« ${plat.nom} » est marqué indisponible.` : `« ${plat.nom} » est de nouveau disponible.`)
    await refresh()
  }
  finally {
    toggling.value = null
  }
})

watch(toggleError, value => {
  if (value)
    toast.error(value)
})

const openRow = (plat: Plat) => {
  selectedId.value = plat.id
}
</script>

<template>
  <div>
    <AppPageHeader
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
          variant="outlined"
          color="secondary"
          prepend-icon="ri-upload-2-line"
          @click="importDialog = true"
        >
          Importer
        </VBtn>
        <VBtn
          v-if="canWrite"
          prepend-icon="ri-add-line"
          @click="newPlat"
        >
          Nouveau plat
        </VBtn>
      </template>
    </AppPageHeader>

    <AppStatStrip
      :items="stats"
      :loading="!loadedOnce && !error"
    />

    <VCard class="mt-6">
      <VCardItem class="pb-2">
        <VCardTitle>Filtres</VCardTitle>
      </VCardItem>
      <VCardText>
        <VRow>
          <VCol
            cols="12"
            md="3"
          >
            <VTextField
              v-model="search"
              label="Rechercher"
              placeholder="Nom ou description"
              prepend-inner-icon="ri-search-line"
              clearable
              autocomplete="off"
            />
          </VCol>
          <VCol
            cols="12"
            sm="6"
            md="3"
          >
            <VSelect
              v-model="menuFilter"
              :items="menuItems"
              label="Menu"
              prepend-inner-icon="ri-book-open-line"
              placeholder="Tous les menus"
              clearable
            />
          </VCol>
          <VCol
            cols="12"
            sm="6"
            md="3"
          >
            <VSelect
              v-model="category"
              :items="categoryItems"
              label="Catégorie"
              prepend-inner-icon="ri-price-tag-3-line"
              placeholder="Toutes les catégories"
              clearable
            />
          </VCol>
          <VCol
            cols="12"
            sm="6"
            md="3"
          >
            <VSelect
              v-model="availability"
              :items="availabilityItems"
              label="Disponibilité"
              prepend-inner-icon="ri-filter-3-line"
            />
          </VCol>
        </VRow>
      </VCardText>

      <VDivider />

      <div class="d-flex flex-wrap align-center gap-3 px-5 py-4">
        <span class="text-body-1 text-medium-emphasis">
          <template v-if="loadedOnce">
            {{ filtered.length }} plat{{ filtered.length > 1 ? 's' : '' }}<template v-if="hasFilters">
              sur {{ plats.length }}
            </template>
          </template>
        </span>
        <VSpacer />
        <VBtn
          v-if="hasFilters"
          variant="outlined"
          color="secondary"
          prepend-icon="ri-filter-off-line"
          @click="clearFilters"
        >
          Effacer les filtres
        </VBtn>
      </div>

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
        icon="ri-restaurant-2-line"
        :title="hasFilters ? 'Aucun plat ne correspond' : 'Votre carte est vide'"
        :text="hasFilters
          ? 'Essayez d\'autres filtres ou une autre recherche.'
          : canWrite ? 'Ajoutez votre premier plat pour commencer à prendre des commandes.' : 'Aucun plat n\'a encore été ajouté par la direction.'"
      >
        <VBtn
          v-if="hasFilters"
          variant="outlined"
          @click="clearFilters"
        >
          Effacer les filtres
        </VBtn>
        <VBtn
          v-else-if="canWrite"
          prepend-icon="ri-add-line"
          @click="newPlat"
        >
          Ajouter un plat
        </VBtn>
      </AppEmptyState>

      <template v-else>
        <VTable
          hover
          class="catalog-table"
        >
          <thead>
            <tr>
              <th>Plat</th>
              <th class="d-none d-md-table-cell">
                Catégorie
              </th>
              <th class="text-end">
                Prix
              </th>
              <th class="text-end d-none d-md-table-cell">
                Préparation
              </th>
              <th class="text-center">
                Disponible
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="plat in pagination.rows.value"
              :key="plat.id"
              class="cursor-pointer"
              tabindex="0"
              @click="openRow(plat)"
              @keydown.enter="openRow(plat)"
            >
              <td>
                <div class="d-flex align-center gap-3 py-2">
                  <ProductAvatar
                    :photo-url="plat.photo_url"
                    icon="ri-restaurant-2-line"
                    :muted="!plat.disponible"
                    :size="38"
                  />
                  <div class="min-w-0">
                    <div class="text-body-1 font-weight-medium text-high-emphasis plat-name">
                      {{ plat.nom }}
                    </div>
                    <div
                      v-if="plat.description"
                      class="text-body-2 text-medium-emphasis plat-name"
                    >
                      {{ plat.description }}
                    </div>
                  </div>
                </div>
              </td>
              <td class="d-none d-md-table-cell">
                <VChip
                  v-if="categoryName(plat.category_id)"
                  size="small"
                  label
                  variant="tonal"
                >
                  {{ categoryName(plat.category_id) }}
                </VChip>
                <span
                  v-else
                  class="text-disabled"
                >—</span>
              </td>
              <td class="text-end font-weight-semibold text-high-emphasis">
                <AppMoney
                  :amount="plat.prix"
                  :currency="plat.devise"
                />
              </td>
              <td class="text-end d-none d-md-table-cell text-medium-emphasis">
                {{ plat.temps_preparation != null ? `${plat.temps_preparation} min` : '—' }}
              </td>
              <td
                class="text-center"
                @click.stop
                @keydown.enter.stop
              >
                <VSwitch
                  v-if="canWrite"
                  :model-value="plat.disponible"
                  :loading="toggling === plat.id"
                  :disabled="toggling !== null"
                  :aria-label="plat.disponible ? `Rendre ${plat.nom} indisponible` : `Rendre ${plat.nom} disponible`"
                  color="success"
                  density="compact"
                  hide-details
                  class="d-inline-flex"
                  @update:model-value="toggle(plat)"
                />
                <AppStatusChip
                  v-else
                  :label="plat.disponible ? 'Oui' : 'Non'"
                  :tone="plat.disponible ? 'success' : 'neutral'"
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

    <PlatFormDialog
      v-model="formOpen"
      :plat="edited"
      :categories="categories"
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
      :category-name="categoryName(plats.find(plat => plat.id === selectedId)?.category_id)"
      @edit="editPlat"
    />
  </div>
</template>

<style scoped>
.plat-name {
  max-inline-size: 22rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (width <= 600px) {
  .plat-name {
    max-inline-size: 5rem;
  }

  .catalog-table :deep(th),
  .catalog-table :deep(td) {
    padding-inline: 8px !important;
  }
}
</style>
