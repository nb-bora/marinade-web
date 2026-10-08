<script setup lang="ts">
import { catalogApi } from '../api'
import CategoryFormDialog from '../components/CategoryFormDialog.vue'
import MenuFormDialog from '../components/MenuFormDialog.vue'
import { useMenus } from '../composables/useMenus'
import type { Menu, MenuCategory } from '../types'
import { useAsyncData } from '@/composables/useAsyncData'
import { useSubmit } from '@/composables/useSubmit'
import { formatDate } from '@/lib/format'
import { useTenantStore } from '@/stores/tenant.store'
import { useToast } from '@/stores/toast.store'

const tenant = useTenantStore()
const toast = useToast()
const canWrite = computed(() => tenant.can('management'))

const { menus, categoriesOf, loading, error, loaded, reload, refresh } = useMenus()

// Nombre de plats par catégorie, pour donner du relief aux listes.
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

const menuDialog = ref(false)
const editedMenu = ref<Menu | null>(null)
const categoryDialog = ref(false)
const categoryMenu = ref<Menu | null>(null)
const editedCategory = ref<MenuCategory | null>(null)

function newMenu() {
  editedMenu.value = null
  menuDialog.value = true
}

function editMenu(menu: Menu) {
  editedMenu.value = menu
  menuDialog.value = true
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

const nextOrder = computed(() => {
  const list = categoryMenu.value ? categoriesOf(categoryMenu.value.id) : []

  return list.length ? Math.max(...list.map(category => category.ordre)) + 1 : 0
})

const toggling = ref<string | null>(null)

const { submit: toggleMenu, error: toggleError, message: toggleMessage } = useSubmit(async (menu: Menu) => {
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
      title="Menus et catégories"
      subtitle="Organisez votre carte : chaque menu regroupe des catégories dans l'ordre où vos clients les découvrent."
    >
      <template
        v-if="canWrite"
        #actions
      >
        <VBtn
          prepend-icon="ri-add-line"
          @click="newMenu"
        >
          Nouveau menu
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
        md="6"
        xl="4"
      >
        <VSkeletonLoader type="card" />
      </VCol>
    </VRow>

    <VCard v-else-if="menus.length === 0">
      <AppEmptyState
        icon="ri-book-open-line"
        title="Aucun menu pour l'instant"
        :text="canWrite
          ? 'Créez votre premier menu, puis ajoutez-y des catégories (entrées, plats, desserts...).'
          : 'La carte de ce restaurant n\'a pas encore été préparée par la direction.'"
      >
        <VBtn
          v-if="canWrite"
          prepend-icon="ri-add-line"
          @click="newMenu"
        >
          Créer un menu
        </VBtn>
      </AppEmptyState>
    </VCard>

    <VRow v-else>
      <VCol
        v-for="menu in menus"
        :key="menu.id"
        cols="12"
        md="6"
        xl="4"
      >
        <VCard class="h-100 d-flex flex-column">
          <VCardItem class="pb-2">
            <template #prepend>
              <VAvatar
                :color="menu.actif ? 'primary' : 'secondary'"
                variant="tonal"
                rounded
              >
                <VIcon icon="ri-book-open-line" />
              </VAvatar>
            </template>
            <VCardTitle class="text-wrap">
              {{ menu.name }}
            </VCardTitle>
            <VCardSubtitle>Créé le {{ formatDate(menu.created_at) }}</VCardSubtitle>
            <template
              v-if="canWrite"
              #append
            >
              <IconBtn
                :aria-label="`Modifier le menu ${menu.name}`"
                @click="editMenu(menu)"
              >
                <VIcon icon="ri-pencil-line" />
              </IconBtn>
            </template>
          </VCardItem>

          <VCardText class="pb-2">
            <p
              v-if="menu.description"
              class="text-body-1 mb-3"
            >
              {{ menu.description }}
            </p>

            <div class="d-flex align-center justify-space-between gap-3">
              <AppStatusChip
                :label="menu.actif ? 'Actif' : 'Désactivé'"
                :tone="menu.actif ? 'success' : 'neutral'"
                :icon="menu.actif ? 'ri-checkbox-circle-line' : 'ri-pause-circle-line'"
              />
              <VSwitch
                v-if="canWrite"
                :model-value="menu.actif"
                :loading="toggling === menu.id"
                :disabled="toggling !== null"
                :aria-label="menu.actif ? `Désactiver le menu ${menu.name}` : `Activer le menu ${menu.name}`"
                color="primary"
                density="compact"
                hide-details
                @update:model-value="toggleMenu(menu)"
              />
            </div>
          </VCardText>

          <VDivider />

          <div class="d-flex align-center justify-space-between px-5 pt-4 pb-1">
            <span class="text-subtitle-1 font-weight-medium">Catégories</span>
            <VBtn
              v-if="canWrite"
              size="small"
              variant="tonal"
              prepend-icon="ri-add-line"
              @click="newCategory(menu)"
            >
              Ajouter
            </VBtn>
          </div>

          <VList
            v-if="categoriesOf(menu.id).length"
            class="py-1 flex-grow-1"
            density="comfortable"
          >
            <VListItem
              v-for="category in categoriesOf(menu.id)"
              :key="category.id"
            >
              <template #prepend>
                <VAvatar
                  size="30"
                  variant="tonal"
                  color="secondary"
                  class="me-3 tabular-nums"
                >
                  {{ category.ordre }}
                </VAvatar>
              </template>
              <VListItemTitle class="font-weight-medium">
                {{ category.name }}
              </VListItemTitle>
              <VListItemSubtitle>
                {{ platCount.get(category.id) ?? 0 }} plat{{ (platCount.get(category.id) ?? 0) > 1 ? 's' : '' }}
              </VListItemSubtitle>
              <template
                v-if="canWrite"
                #append
              >
                <IconBtn
                  size="small"
                  :aria-label="`Modifier la catégorie ${category.name}`"
                  @click="editCategory(menu, category)"
                >
                  <VIcon icon="ri-pencil-line" />
                </IconBtn>
              </template>
            </VListItem>
          </VList>

          <div
            v-else
            class="text-body-2 text-medium-emphasis px-5 py-4 flex-grow-1"
          >
            Ce menu n'a pas encore de catégorie.
          </div>
        </VCard>
      </VCol>
    </VRow>

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
  </div>
</template>
