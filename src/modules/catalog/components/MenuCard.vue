<!--
  Carte d'un menu : couverture en dégradé orange, statut, nombre de catégories et de plats, et le menu
  d'actions (⋮). Toute la carte ouvre la fiche du menu ; le bouton ⋮ garde son propre clic.
-->
<script setup lang="ts">
import type { Menu } from '../types'
import { formatDate } from '@/lib/format'

const props = defineProps<{
  menu: Menu
  categoryCount: number
  platCount: number
  canWrite: boolean

  /** Le changement de statut de ce menu est en cours. */
  busy: boolean
}>()

const emit = defineEmits<{
  open: []
  edit: []
  toggle: []
  plats: []
}>()

/**
 * Une seule couverture pour tous les menus, aux couleurs de la marque : un menu actif est orange,
 * un menu inactif reste gris. Le même pictogramme partout, pour que la grille reste lisible.
 */
const cover = computed(() => (props.menu.actif
  ? { '--cover-from': '#D55A1E', '--cover-to': '#F08A3C' }
  : {}))

const glyph = 'ri-book-open-line'

const plural = (count: number, word: string) => `${count} ${word}${count > 1 ? 's' : ''}`
</script>

<template>
  <article
    class="menu-card"
    :class="{ 'menu-card--off': !menu.actif }"
  >
    <div
      class="menu-card__cover"
      :style="cover"
    >
      <VIcon
        :icon="glyph"
        class="menu-card__glyph"
        size="88"
      />
      <AppStatusChip
        class="menu-card__status"
        :label="menu.actif ? 'Actif' : 'Inactif'"
        :tone="menu.actif ? 'success' : 'neutral'"
        :icon="menu.actif ? 'ri-check-line' : 'ri-pause-circle-line'"
      />

      <VMenu location="bottom end">
        <template #activator="{ props: activator }">
          <IconBtn
            v-bind="activator"
            class="menu-card__more"
            :aria-label="`Actions du menu ${menu.name}`"
          >
            <VIcon icon="ri-more-2-fill" />
          </IconBtn>
        </template>
        <VList
          density="comfortable"
          min-width="220"
        >
          <VListItem
            prepend-icon="ri-restaurant-2-line"
            title="Voir les plats"
            @click="emit('plats')"
          />
          <VListItem
            prepend-icon="ri-price-tag-3-line"
            :title="canWrite ? 'Gérer les catégories' : 'Voir les catégories'"
            @click="emit('open')"
          />
          <template v-if="canWrite">
            <VListItem
              prepend-icon="ri-pencil-line"
              title="Modifier le menu"
              @click="emit('edit')"
            />
            <VDivider class="my-1" />
            <VListItem
              :prepend-icon="menu.actif ? 'ri-pause-circle-line' : 'ri-play-circle-line'"
              :title="menu.actif ? 'Désactiver le menu' : 'Réactiver le menu'"
              :base-color="menu.actif ? 'error' : 'success'"
              :disabled="busy"
              @click="emit('toggle')"
            />
          </template>
        </VList>
      </VMenu>
    </div>

    <div class="menu-card__body">
      <h2 class="menu-card__title text-h6">
        <button
          type="button"
          class="menu-card__open"
          @click="emit('open')"
        >
          {{ menu.name }}
        </button>
      </h2>
      <p
        class="menu-card__description text-body-2 text-medium-emphasis"
        :class="{ 'font-italic': !menu.description }"
      >
        {{ menu.description || 'Aucune description.' }}
      </p>

      <div class="menu-card__stats">
        <span class="menu-card__stat">
          <VIcon
            icon="ri-price-tag-3-line"
            size="18"
          />
          <strong class="tabular-nums">{{ categoryCount }}</strong>
          catégorie{{ categoryCount > 1 ? 's' : '' }}
        </span>
        <span class="menu-card__stat">
          <VIcon
            icon="ri-restaurant-2-line"
            size="18"
          />
          <strong class="tabular-nums">{{ platCount }}</strong>
          plat{{ platCount > 1 ? 's' : '' }}
        </span>
      </div>
    </div>

    <footer class="menu-card__footer">
      <span class="text-caption text-medium-emphasis">Créé le {{ formatDate(menu.created_at) }}</span>
      <VBtn
        variant="text"
        size="small"
        append-icon="ri-arrow-right-line"
        :aria-label="`Voir ${plural(platCount, 'plat')} du menu ${menu.name}`"
        class="menu-card__plats"
        @click="emit('plats')"
      >
        Voir les plats
      </VBtn>
    </footer>
  </article>
</template>

<style scoped>
.menu-card {
  position: relative;
  display: flex;
  flex-direction: column;
  block-size: 100%;
  overflow: hidden;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 16px;
  background: rgb(var(--v-theme-surface));
  transition: border-color 0.2s ease;
}

/* Survol discret : seule la bordure change, la carte ne bouge pas. */
.menu-card:hover,
.menu-card:focus-within {
  border-color: rgba(var(--v-theme-primary), 0.45);
}

.menu-card__cover {
  --cover-from: #8d8d99;
  --cover-to: #b5b5bf;

  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  block-size: 124px;
  background: linear-gradient(135deg, var(--cover-from), var(--cover-to));
  color: #fff;
  transition: filter 0.25s ease;
}

.menu-card--off .menu-card__cover {
  filter: saturate(0.6);
}

.menu-card__glyph {
  position: relative;
  color: rgba(255, 255, 255, 0.92);
}

.menu-card:hover .menu-card__glyph {
  transform: none;
}

.menu-card__status {
  position: absolute;
  z-index: 2;
  inset-block-start: 12px;
  inset-inline-start: 12px;
  background: rgb(var(--v-theme-surface));
  border-radius: 6px;
}

.menu-card__more {
  position: absolute;
  z-index: 3;
  inset-block-start: 8px;
  inset-inline-end: 8px;
  background: rgba(255, 255, 255, 0.22);
  color: #fff;
  backdrop-filter: blur(2px);
}

.menu-card__more:hover {
  background: rgba(255, 255, 255, 0.36);
}

.menu-card__body {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 6px;
  padding: 16px 20px 12px;
}

.menu-card__title {
  font-weight: 600;
  line-height: 1.35;
  margin-block: 0;
}

/* Le bouton du titre s'étend sur toute la carte : un seul élément focalisable, tout reste cliquable. */
.menu-card__open {
  display: -webkit-box;
  overflow: hidden;
  color: rgb(var(--v-theme-on-surface));
  cursor: pointer;
  font: inherit;
  text-align: start;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow-wrap: anywhere;
}

.menu-card__open::after {
  position: absolute;
  z-index: 1;
  content: "";
  inset: 0;
}

.menu-card__open:focus-visible {
  outline: none;
}

.menu-card__open:focus-visible::after {
  border-radius: 12px;
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: -2px;
}

.menu-card__description {
  display: -webkit-box;
  overflow: hidden;
  margin-block: 0;
  min-block-size: 2.5rem;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.menu-card__stats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 20px;
  margin-block-start: 6px;
}

.menu-card__stat {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.875rem;
}

.menu-card__stat strong {
  color: rgb(var(--v-theme-on-surface));
  font-size: 1rem;
}

.menu-card__footer {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 4px 12px 10px 20px;
  border-block-start: 1px solid rgba(var(--v-border-color), 0.5);
  margin-block-start: 4px;
  padding-block-start: 8px;
}

@media (prefers-reduced-motion: reduce) {
  .menu-card,
  .menu-card__glyph {
    transition: none;
  }

  .menu-card:hover,
  .menu-card:focus-within,
  .menu-card:hover .menu-card__glyph {
    transform: none;
  }
}
</style>
