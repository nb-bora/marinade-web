<script setup lang="ts">
import { catalogApi } from '../api'
import BoissonDetailDrawer from '../components/BoissonDetailDrawer.vue'
import BoissonFormDialog from '../components/BoissonFormDialog.vue'
import ProductAvatar from '../components/ProductAvatar.vue'
import { boissonsImport } from '../imports'
import type { Boisson } from '../types'
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
const importDialog = ref(false)
const importDefinition = boissonsImport()

const { data, loading, error, reload, refresh } = useAsyncData(
  signal => tenant.currentId ? catalogApi.boissons(tenant.currentId, signal) : Promise.resolve([]),
  { watch: [() => tenant.currentId] },
)

const boissons = computed(() => data.value ?? [])
const loadedOnce = computed(() => data.value !== null)

const usedCategories = computed(() =>
  [...new Set(boissons.value.map(boisson => boisson.category).filter((value): value is string => !!value))]
    .sort((a, b) => a.localeCompare(b, 'fr')))

// Filtres
const search = ref('')
const searchDebounced = refDebounced(search, 250)
const category = ref<string | null>(null)
const alcohol = ref<'all' | 'with' | 'without'>('all')
const availability = ref<'all' | 'on' | 'off'>('all')

const hasFilters = computed(() =>
  search.value.trim() !== '' || category.value !== null || alcohol.value !== 'all' || availability.value !== 'all')

const normalize = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

const filtered = computed(() => {
  const term = normalize(searchDebounced.value.trim())

  return boissons.value
    .filter(boisson => {
      if (term && !normalize(`${boisson.nom} ${boisson.description ?? ''}`).includes(term))
        return false
      if (category.value === NO_CATEGORY && boisson.category)
        return false
      if (category.value && category.value !== NO_CATEGORY && boisson.category !== category.value)
        return false
      if (alcohol.value === 'with' && !boisson.alcool)
        return false
      if (alcohol.value === 'without' && boisson.alcool)
        return false
      if (availability.value === 'on' && !boisson.disponible)
        return false

      return !(availability.value === 'off' && boisson.disponible)
    })
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
})

const pagination = useClientPagination(filtered, 10)

function clearFilters() {
  search.value = ''
  category.value = null
  alcohol.value = 'all'
  availability.value = 'all'
}

const categoryItems = computed(() => [
  { value: NO_CATEGORY, title: 'Sans catégorie' },
  ...usedCategories.value.map(value => ({ value, title: value })),
])

const alcoholItems = [
  { value: 'all', title: 'Toutes' },
  { value: 'without', title: 'Sans alcool' },
  { value: 'with', title: 'Avec alcool' },
]

const availabilityItems = [
  { value: 'all', title: 'Toutes' },
  { value: 'on', title: 'Disponibles' },
  { value: 'off', title: 'Indisponibles' },
]

const stats = computed(() => {
  const count = boissons.value.length
  const available = boissons.value.filter(boisson => boisson.disponible).length
  const alcoholic = boissons.value.filter(boisson => boisson.alcool).length
  const prices = boissons.value.map(boisson => Number(boisson.prix))
  const average = prices.length ? prices.reduce((sum, value) => sum + value, 0) / prices.length : null

  return [
    {
      label: 'Boissons à la carte',
      value: String(count),
      icon: 'ri-goblet-line',
      hint: usedCategories.value.length ? `${usedCategories.value.length} catégorie${usedCategories.value.length > 1 ? 's' : ''}` : undefined,
    },
    {
      label: 'Disponibles',
      value: String(available),
      icon: 'ri-checkbox-circle-line',
      hint: count ? `${count - available} indisponible${count - available > 1 ? 's' : ''}` : undefined,
      hintColor: count - available > 0 ? 'warning' as const : 'success' as const,
    },
    {
      label: 'Avec alcool',
      value: String(alcoholic),
      icon: 'ri-goblet-fill',
      hint: count ? `${count - alcoholic} sans alcool` : undefined,
    },
    {
      label: 'Prix moyen',
      value: average === null ? '—' : formatMoney(Math.round(average)),
      icon: 'ri-money-dollar-circle-line',
      hint: prices.length ? `De ${formatMoney(Math.min(...prices))} à ${formatMoney(Math.max(...prices))}` : undefined,
    },
  ]
})

// Formulaire et tiroir
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

// Disponibilité
const toggling = ref<string | null>(null)

const { submit: toggle, error: toggleError } = useSubmit(async (boisson: Boisson) => {
  const accepted = await useConfirm()({
    title: boisson.disponible ? 'Marquer cette boisson indisponible ?' : 'Remettre cette boisson en vente ?',
    text: `« ${boisson.nom} » ${boisson.disponible ? 'ne pourra plus être commandée.' : 'pourra de nouveau être commandée.'}`,
    confirmLabel: 'Enregistrer',
  })

  if (!accepted)
    return

  toggling.value = boisson.id
  try {
    await catalogApi.updateBoisson(boisson.id, { disponible: !boisson.disponible })
    toast.success(boisson.disponible ? `« ${boisson.nom} » est marquée indisponible.` : `« ${boisson.nom} » est de nouveau disponible.`)
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

const openRow = (boisson: Boisson) => {
  selectedId.value = boisson.id
}
</script>

<template>
  <div>
    <AppPageHeader
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
          @click="newBoisson"
        >
          Nouvelle boisson
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
            sm="4"
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
            sm="4"
            md="3"
          >
            <VSelect
              v-model="alcohol"
              :items="alcoholItems"
              label="Alcool"
              prepend-inner-icon="ri-goblet-line"
            />
          </VCol>
          <VCol
            cols="12"
            sm="4"
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
            {{ filtered.length }} boisson{{ filtered.length > 1 ? 's' : '' }}<template v-if="hasFilters">
              sur {{ boissons.length }}
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
        icon="ri-goblet-line"
        :title="hasFilters ? 'Aucune boisson ne correspond' : 'Aucune boisson à la carte'"
        :text="hasFilters
          ? 'Essayez d\'autres filtres ou une autre recherche.'
          : canWrite ? 'Ajoutez vos boissons pour pouvoir les servir et les encaisser.' : 'Aucune boisson n\'a encore été ajoutée par la direction.'"
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
          @click="newBoisson"
        >
          Ajouter une boisson
        </VBtn>
      </AppEmptyState>

      <template v-else>
        <VTable
          hover
          class="catalog-table"
        >
          <thead>
            <tr>
              <th>Boisson</th>
              <th class="d-none d-md-table-cell">
                Catégorie
              </th>
              <th class="d-none d-sm-table-cell">
                Alcool
              </th>
              <th class="text-end">
                Prix
              </th>
              <th class="text-center">
                Disponible
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="boisson in pagination.rows.value"
              :key="boisson.id"
              class="cursor-pointer"
              tabindex="0"
              @click="openRow(boisson)"
              @keydown.enter="openRow(boisson)"
            >
              <td>
                <div class="d-flex align-center gap-3 py-2">
                  <ProductAvatar
                    icon="ri-goblet-line"
                    :color="boisson.alcool ? 'warning' : 'info'"
                    :muted="!boisson.disponible"
                    :size="38"
                  />
                  <div class="min-w-0">
                    <div class="text-body-1 font-weight-medium text-high-emphasis boisson-name">
                      {{ boisson.nom }}
                    </div>
                    <div
                      v-if="boisson.description"
                      class="text-body-2 text-medium-emphasis boisson-name"
                    >
                      {{ boisson.description }}
                    </div>
                  </div>
                </div>
              </td>
              <td class="d-none d-md-table-cell">
                <VChip
                  v-if="boisson.category"
                  size="small"
                  label
                  variant="tonal"
                >
                  {{ boisson.category }}
                </VChip>
                <span
                  v-else
                  class="text-disabled"
                >—</span>
              </td>
              <td class="d-none d-sm-table-cell">
                <AppStatusChip
                  :label="boisson.alcool ? 'Avec alcool' : 'Sans alcool'"
                  :tone="boisson.alcool ? 'warning' : 'info'"
                />
              </td>
              <td class="text-end font-weight-semibold text-high-emphasis">
                <AppMoney
                  :amount="boisson.prix"
                  :currency="boisson.devise"
                />
              </td>
              <td
                class="text-center"
                @click.stop
                @keydown.enter.stop
              >
                <VSwitch
                  v-if="canWrite"
                  :model-value="boisson.disponible"
                  :loading="toggling === boisson.id"
                  :disabled="toggling !== null"
                  :aria-label="boisson.disponible ? `Rendre ${boisson.nom} indisponible` : `Rendre ${boisson.nom} disponible`"
                  color="success"
                  density="compact"
                  hide-details
                  class="d-inline-flex"
                  @update:model-value="toggle(boisson)"
                />
                <AppStatusChip
                  v-else
                  :label="boisson.disponible ? 'Oui' : 'Non'"
                  :tone="boisson.disponible ? 'success' : 'neutral'"
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

    <BoissonFormDialog
      v-model="formOpen"
      :boisson="edited"
      :suggestions="usedCategories"
      @saved="afterSave"
    />

    <AppImportDialog
      v-if="canWrite"
      v-model="importDialog"
      v-bind="importDefinition"
      @imported="refresh"
    />

    <BoissonDetailDrawer
      ref="drawer"
      v-model="selectedId"
      :can-write="canWrite"
      @edit="editBoisson"
    />
  </div>
</template>

<style scoped>
.boisson-name {
  max-inline-size: 22rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (width <= 600px) {
  .boisson-name {
    max-inline-size: 5rem;
  }

  .catalog-table :deep(th),
  .catalog-table :deep(td) {
    padding-inline: 8px !important;
  }
}
</style>
