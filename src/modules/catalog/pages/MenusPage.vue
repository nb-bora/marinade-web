<script setup lang="ts">
import { catalogApi } from '../api'
import CategoryFormDialog from '../components/CategoryFormDialog.vue'
import MenuCard from '../components/MenuCard.vue'
import MenuDrawer from '../components/MenuDrawer.vue'
import MenuFormDialog from '../components/MenuFormDialog.vue'
import MenusIllustration from '../components/MenusIllustration.vue'
import { useMenus } from '../composables/useMenus'
import { menusImport } from '../imports'
import type { Menu, MenuCategory } from '../types'
import { useAsyncData } from '@/composables/useAsyncData'
import { useConfirm } from '@/composables/useConfirm'
import { useSubmit } from '@/composables/useSubmit'
import { useTenantStore } from '@/stores/tenant.store'
import { useToast } from '@/stores/toast.store'

type StatusFilter = 'all' | 'on' | 'off'

const tenant = useTenantStore()
const toast = useToast()
const router = useRouter()
const canWrite = computed(() => tenant.can('management'))

const { menus, categoriesOf, loading, error, loaded, reload, refresh } = useMenus()

// Nombre de plats par catégorie : il donne le nombre de plats de chaque menu.
const { data: plats, refresh: refreshPlats } = useAsyncData(
  signal => tenant.currentId ? catalogApi.plats(tenant.currentId, signal) : Promise.resolve([]),
  { watch: [() => tenant.currentId] },
)

const platCount = computed(() => {
  const counts = new Map<string, number>()

  for (const plat of plats.value ?? []) {
    if (plat.category_id)
      counts.set(plat.category_id, (counts.get(plat.category_id) ?? 0) + 1)
  }

  return counts
})

const platsOf = (menu: Menu) => categoriesOf(menu.id).reduce((sum, category) => sum + (platCount.value.get(category.id) ?? 0), 0)

// Filtres ------------------------------------------------------------------------------------

const status = ref<StatusFilter>('all')
const search = ref('')
const searchDebounced = refDebounced(search, 250)

const normalize = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

const statusOptions = computed(() => [
  { value: 'all' as const, title: `Tous (${menus.value.length})` },
  { value: 'on' as const, title: `Actifs (${menus.value.filter(menu => menu.actif).length})` },
  { value: 'off' as const, title: `Inactifs (${menus.value.filter(menu => !menu.actif).length})` },
])

const filtered = computed(() => {
  const term = normalize(searchDebounced.value.trim())

  return menus.value
    .filter(menu => status.value === 'all' || (status.value === 'on') === menu.actif)
    .filter(menu => !term || normalize(`${menu.name} ${menu.description ?? ''}`).includes(term))
    .sort((a, b) => Number(b.actif) - Number(a.actif) || a.name.localeCompare(b.name, 'fr'))
})

const hasFilters = computed(() => status.value !== 'all' || search.value.trim() !== '')

function clearFilters() {
  status.value = 'all'
  search.value = ''
}

// Formulaires et fiche ------------------------------------------------------------------------

const menuDialog = ref(false)
const editedMenu = ref<Menu | null>(null)
const categoryDialog = ref(false)
const categoryMenu = ref<Menu | null>(null)
const editedCategory = ref<MenuCategory | null>(null)
const importDialog = ref(false)
const drawer = ref(false)
const drawerMenuId = ref<string | null>(null)

const drawerMenu = computed(() => menus.value.find(menu => menu.id === drawerMenuId.value) ?? null)
const importDefinition = menusImport()

function newMenu() {
  editedMenu.value = null
  menuDialog.value = true
}

function editMenu(menu: Menu) {
  editedMenu.value = menu
  menuDialog.value = true
}

function openMenu(menu: Menu) {
  drawerMenuId.value = menu.id
  drawer.value = true
}

function newCategory(menu: Menu) {
  categoryMenu.value = menu
  editedCategory.value = null
  categoryDialog.value = true
}

function editCategory(menu: Menu, category: MenuCategory) {
  categoryMenu.value = menu
  editedCategory.value = category
  categoryDialog.value = true
}

function showPlats(menu: Menu) {
  router.push({ path: '/catalog/plats', query: { menu: menu.id } })
}

const nextOrder = computed(() => {
  const list = categoryMenu.value ? categoriesOf(categoryMenu.value.id) : []

  return list.length ? Math.max(...list.map(category => category.ordre)) + 1 : 0
})

// Activer / désactiver -----------------------------------------------------------------------

const toggling = ref<string | null>(null)

const { submit: toggleMenu, error: toggleError, message: toggleMessage } = useSubmit(async (menu: Menu) => {
  const accepted = await useConfirm()({
    title: menu.actif ? 'Désactiver ce menu ?' : 'Réactiver ce menu ?',
    text: `« ${menu.name} » ${menu.actif ? 'ne sera plus proposé, mais reste enregistré avec ses catégories.' : 'sera de nouveau proposé.'}`,
    confirmLabel: menu.actif ? 'Désactiver' : 'Réactiver',
    danger: menu.actif,
  })

  if (!accepted)
    return

  toggling.value = menu.id
  try {
    await catalogApi.updateMenu(menu.id, { actif: !menu.actif })
    toast.success(menu.actif ? `« ${menu.name} » est désactivé.` : `« ${menu.name} » est de nouveau actif.`)
    await refresh()
  }
  finally {
    toggling.value = null
  }
})

watch(toggleError, value => {
  if (value)
    toast.error(toggleMessage.value)
})

const afterChange = () => {
  refresh()
  refreshPlats()
}
</script>

<template>
  <div>
    <AppPageHeader
      title="Nos menus"
      subtitle="Organisez votre carte : chaque menu regroupe des catégories dans l'ordre où vos clients les découvrent."
    >
      <template
        v-if="canWrite"
        #actions
      >
        <VBtn
          variant="outlined"
          color="secondary"
          prepend-icon="ri-upload-2-line"
          @click="importDialog = true"
        >
          Importer
        </VBtn>
        <VBtn
          prepend-icon="ri-add-line"
          @click="newMenu"
        >
          Créer un menu
        </VBtn>
      </template>
    </AppPageHeader>

    <AppErrorState
      v-if="error && !loaded"
      :error="error"
      @retry="reload"
    />

    <VRow v-else-if="loading && !loaded">
      <VCol
        v-for="n in 3"
        :key="n"
        cols="12"
        sm="6"
        lg="4"
      >
        <VSkeletonLoader type="image, article, actions" />
      </VCol>
    </VRow>

    <VCard v-else-if="menus.length === 0">
      <div class="d-flex flex-column align-center text-center pa-8 pa-md-12 gap-2">
        <MenusIllustration />
        <h2 class="text-h5 mt-2">
          {{ canWrite ? 'Créez votre premier menu' : 'Aucun menu pour l\'instant' }}
        </h2>
        <p class="text-body-1 text-medium-emphasis mb-0 empty-text">
          {{ canWrite
            ? 'Un menu regroupe vos catégories (entrées, plats, desserts...). Créez-en un, ou importez-les tous depuis un fichier Excel.'
            : 'La carte de ce restaurant n\'a pas encore été préparée par la direction.' }}
        </p>
        <div
          v-if="canWrite"
          class="d-flex flex-wrap justify-center gap-3 mt-4"
        >
          <VBtn
            size="large"
            prepend-icon="ri-add-line"
            @click="newMenu"
          >
            Créer un menu
          </VBtn>
          <VBtn
            size="large"
            variant="outlined"
            color="secondary"
            prepend-icon="ri-upload-2-line"
            @click="importDialog = true"
          >
            Importer depuis Excel
          </VBtn>
        </div>
      </div>
    </VCard>

    <template v-else>
      <div class="menus-toolbar mb-6">
        <AppSegmented
          v-model="status"
          :options="statusOptions"
          label="Filtrer les menus par statut"
        />
        <VTextField
          v-model="search"
          class="menus-toolbar__search"
          label="Rechercher un menu"
          prepend-inner-icon="ri-search-line"
          density="compact"
          hide-details
          clearable
          autocomplete="off"
        />
      </div>

      <VCard v-if="filtered.length === 0">
        <AppEmptyState
          icon="ri-book-open-line"
          title="Aucun menu ne correspond"
          text="Essayez un autre statut ou une autre recherche."
        >
          <VBtn
            v-if="hasFilters"
            variant="outlined"
            prepend-icon="ri-filter-off-line"
            @click="clearFilters"
          >
            Effacer les filtres
          </VBtn>
        </AppEmptyState>
      </VCard>

      <VRow v-else>
        <VCol
          v-for="menu in filtered"
          :key="menu.id"
          cols="12"
          sm="6"
          lg="4"
          xl="3"
        >
          <MenuCard
            :menu="menu"
            :category-count="categoriesOf(menu.id).length"
            :plat-count="platsOf(menu)"
            :can-write="canWrite"
            :busy="toggling !== null"
            @open="openMenu(menu)"
            @edit="editMenu(menu)"
            @toggle="toggleMenu(menu)"
            @plats="showPlats(menu)"
          />
        </VCol>
      </VRow>
    </template>

    <MenuDrawer
      v-model="drawer"
      :menu="drawerMenu"
      :categories="drawerMenu ? categoriesOf(drawerMenu.id) : []"
      :plat-count="platCount"
      :can-write="canWrite"
      @add-category="drawerMenu && newCategory(drawerMenu)"
      @edit-category="drawerMenu && editCategory(drawerMenu, $event)"
      @edit-menu="drawerMenu && editMenu(drawerMenu)"
      @plats="drawerMenu && showPlats(drawerMenu)"
    />

    <MenuFormDialog
      v-model="menuDialog"
      :menu="editedMenu"
      @saved="afterChange"
    />
    <CategoryFormDialog
      v-model="categoryDialog"
      :menu="categoryMenu"
      :category="editedCategory"
      :next-order="nextOrder"
      @saved="afterChange"
    />
    <AppImportDialog
      v-if="canWrite"
      v-model="importDialog"
      v-bind="importDefinition"
      @imported="afterChange"
    />
  </div>
</template>

<style scoped>
.menus-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px 16px;
}

.menus-toolbar__search {
  flex: 0 1 320px;
  min-inline-size: 220px;
}

.empty-text {
  max-inline-size: 34rem;
}

@media (max-width: 599px) {
  .menus-toolbar > * {
    flex: 1 1 100%;
  }

  .menus-toolbar :deep(.app-segmented) {
    display: flex;
  }

  .menus-toolbar :deep(.app-segmented__item) {
    flex: 1 1 0;
    padding-inline: 6px;
    text-align: center;
  }
}
</style>
