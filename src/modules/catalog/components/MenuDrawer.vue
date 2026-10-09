<!-- Fiche d'un menu, en tiroir latéral : description, statut et catégories (ajout et modification). -->
<script setup lang="ts">
import { onKeyStroke } from '@vueuse/core'
import type { Menu, MenuCategory } from '../types'
import { formatDate } from '@/lib/format'

defineProps<{
  menu: Menu | null
  categories: MenuCategory[]

  /** Nombre de plats par catégorie. */
  platCount: Map<string, number>
  canWrite: boolean
}>()

const emit = defineEmits<{
  addCategory: []
  editCategory: [category: MenuCategory]
  editMenu: []
  plats: []
}>()

const open = defineModel<boolean>({ required: true })

onKeyStroke('Escape', () => {
  if (open.value)
    open.value = false
})
</script>

<template>
  <VNavigationDrawer
    v-model="open"
    location="end"
    temporary
    width="440"
    class="menu-drawer"
  >
    <template v-if="menu">
      <div class="d-flex align-start gap-3 pa-5">
        <VAvatar
          :color="menu.actif ? 'primary' : 'secondary'"
          variant="tonal"
          rounded
        >
          <VIcon icon="ri-book-open-line" />
        </VAvatar>
        <div class="min-w-0 flex-grow-1">
          <h2 class="text-h6 text-wrap">
            {{ menu.name }}
          </h2>
          <div class="d-flex align-center gap-2 mt-1">
            <AppStatusChip
              :label="menu.actif ? 'Actif' : 'Inactif'"
              :tone="menu.actif ? 'success' : 'neutral'"
              :icon="menu.actif ? 'ri-check-line' : 'ri-pause-circle-line'"
            />
            <span class="text-caption text-medium-emphasis">Créé le {{ formatDate(menu.created_at) }}</span>
          </div>
        </div>
        <IconBtn
          aria-label="Fermer la fiche du menu"
          @click="open = false"
        >
          <VIcon icon="ri-close-line" />
        </IconBtn>
      </div>

      <VDivider />

      <div class="pa-5">
        <p
          class="text-body-1 mb-4"
          :class="{ 'text-medium-emphasis font-italic': !menu.description }"
        >
          {{ menu.description || 'Ce menu n\'a pas de description.' }}
        </p>
        <div class="d-flex flex-wrap gap-3">
          <VBtn
            variant="tonal"
            prepend-icon="ri-restaurant-2-line"
            @click="emit('plats')"
          >
            Voir les plats
          </VBtn>
          <VBtn
            v-if="canWrite"
            variant="outlined"
            color="secondary"
            prepend-icon="ri-pencil-line"
            @click="emit('editMenu')"
          >
            Modifier
          </VBtn>
        </div>
      </div>

      <VDivider />

      <div class="d-flex align-center justify-space-between px-5 pt-4 pb-1">
        <h3 class="text-subtitle-1 font-weight-medium">
          Catégories
        </h3>
        <VBtn
          v-if="canWrite"
          size="small"
          variant="tonal"
          prepend-icon="ri-add-line"
          @click="emit('addCategory')"
        >
          Ajouter
        </VBtn>
      </div>

      <VList
        v-if="categories.length"
        class="py-1"
        density="comfortable"
      >
        <VListItem
          v-for="category in categories"
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
              @click="emit('editCategory', category)"
            >
              <VIcon icon="ri-pencil-line" />
            </IconBtn>
          </template>
        </VListItem>
      </VList>

      <div
        v-else
        class="text-body-2 text-medium-emphasis px-5 py-4"
      >
        Ce menu n'a pas encore de catégorie.
      </div>
    </template>
  </VNavigationDrawer>
</template>
