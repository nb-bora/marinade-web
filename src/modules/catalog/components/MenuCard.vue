<!--
  Carte d'un menu : couverture orange avec trame de points, pastille d'icône à cheval sur le bord,
  statut, aperçu des catégories, chiffres clés et menu d'actions (⋮). Toute la carte ouvre la fiche
  du menu ; le bouton ⋮ et le pied de carte gardent leur propre clic.
-->
<script setup lang="ts">
import type { Menu, MenuCategory } from '../types'
import { formatDate } from '@/lib/format'

const props = defineProps<{
  menu: Menu

  /** Catégories du menu, déjà triées par ordre. */
  categories: MenuCategory[]
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

/** Nombre de catégories nommées sur la carte ; les suivantes sont résumées en « +N ». */
const PREVIEW = 3

const glyph = 'ri-book-open-line'

const shown = computed(() => props.categories.slice(0, PREVIEW))
const hidden = computed(() => Math.max(0, props.categories.length - PREVIEW))
</script>

<template>
  <article
    class="menu-card"
    :class="{ 'menu-card--off': !menu.actif }"
  >
    <div class="menu-card__cover">
      <VIcon
        :icon="glyph"
        class="menu-card__watermark"
        size="132"
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
      <span class="menu-card__badge">
        <VIcon
          :icon="glyph"
          size="26"
        />
      </span>

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

      <ul
        v-if="categories.length"
        class="menu-card__chips"
        :aria-label="`Catégories du menu ${menu.name}`"
      >
        <li
          v-for="category in shown"
          :key="category.id"
          class="menu-card__chip"
        >
          {{ category.name }}
        </li>
        <li
          v-if="hidden"
          class="menu-card__chip menu-card__chip--more"
        >
          +{{ hidden }}
        </li>
      </ul>
      <p
        v-else
        class="menu-card__chips-empty text-caption"
      >
        <VIcon
          icon="ri-information-line"
          size="14"
        />
        Pas encore de catégorie
      </p>

      <dl class="menu-card__stats">
        <div class="menu-card__stat">
          <dt>
            <VIcon
              icon="ri-price-tag-3-line"
              size="14"
            />
            Catégorie{{ categories.length > 1 ? 's' : '' }}
          </dt>
          <dd class="tabular-nums">
            {{ categories.length }}
          </dd>
        </div>
        <div class="menu-card__stat">
          <dt>
            <VIcon
              icon="ri-restaurant-2-line"
              size="14"
            />
            Plat{{ platCount > 1 ? 's' : '' }}
          </dt>
          <dd class="tabular-nums">
            {{ platCount }}
          </dd>
        </div>
      </dl>
    </div>

    <footer class="menu-card__footer">
      <span class="text-caption text-medium-emphasis">Créé le {{ formatDate(menu.created_at) }}</span>
      <VBtn
        variant="text"
        size="small"
        append-icon="ri-arrow-right-line"
        :aria-label="`Voir les ${platCount} plat${platCount > 1 ? 's' : ''} du menu ${menu.name}`"
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
  --cover-from: #c24d14;
  --cover-to: #f08a3c;

  position: relative;
  display: flex;
  flex-direction: column;
  block-size: 100%;
  overflow: hidden;
  border: 1px solid rgba(var(--v-border-color), 0.16);
  border-radius: 18px;
  background: rgb(var(--v-theme-surface));
  box-shadow: 0 1px 2px rgba(var(--v-theme-on-surface), 0.04);
  transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
}

/* Un menu inactif reste lisible mais passe en gris : la grille montre d'un coup d'œil ce qui est proposé. */
.menu-card--off {
  --cover-from: #7f7f8c;
  --cover-to: #b1b1bb;
}

.menu-card:hover,
.menu-card:focus-within {
  border-color: rgba(var(--v-theme-primary), 0.5);
  box-shadow: 0 12px 28px -14px rgba(var(--v-theme-primary), 0.55);
  transform: translateY(-2px);
}

/* Couverture : dégradé, halo en haut à droite et trame de points, comme le bandeau de la page. */
.menu-card__cover {
  position: relative;
  overflow: hidden;
  block-size: 112px;
  background:
    radial-gradient(circle at 88% -20%, rgba(255, 255, 255, 0.34), transparent 60%),
    linear-gradient(135deg, var(--cover-from), var(--cover-to));
  color: #fff;
}

.menu-card__cover::before {
  position: absolute;
  content: "";
  inset: 0;
  background-image: radial-gradient(rgba(255, 255, 255, 0.35) 1px, transparent 1px);
  background-size: 14px 14px;
  mask-image: linear-gradient(120deg, transparent 20%, #000 100%);
  opacity: 0.5;
}

.menu-card__watermark {
  position: absolute;
  inset-block-end: -28px;
  inset-inline-end: 8px;
  color: rgba(255, 255, 255, 0.2);
  transform: rotate(-12deg);
}

.menu-card__status {
  position: absolute;
  z-index: 2;
  inset-block-start: 12px;
  inset-inline-start: 12px;
  border-radius: 6px;
  background: rgb(var(--v-theme-surface));
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
  padding: 0 20px 14px;
}

/* La pastille d'icône déborde sur la couverture : elle donne un point d'ancrage à la carte. */
.menu-card__badge {
  display: grid;
  place-items: center;
  align-self: flex-start;
  inline-size: 52px;
  block-size: 52px;
  margin-block: -26px 6px;
  border: 4px solid rgb(var(--v-theme-surface));
  border-radius: 16px;
  background: rgb(var(--v-theme-surface));
  box-shadow: 0 4px 12px -4px rgba(var(--v-theme-on-surface), 0.25);
  color: rgb(var(--v-theme-primary));
  position: relative;
}

.menu-card__badge::before {
  position: absolute;
  content: "";
  inset: 0;
  border-radius: 12px;
  background: rgba(var(--v-theme-primary), 0.12);
}

.menu-card__badge > * {
  position: relative;
}

.menu-card--off .menu-card__badge {
  color: rgba(var(--v-theme-on-surface), 0.6);
}

.menu-card--off .menu-card__badge::before {
  background: rgba(var(--v-theme-on-surface), 0.08);
}

.menu-card__title {
  font-weight: 700;
  line-height: 1.3;
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
  border-radius: 14px;
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: -4px;
}

.menu-card__description {
  display: -webkit-box;
  overflow: hidden;
  margin-block: 0;
  min-block-size: 2.5rem;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.menu-card__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 0;
  margin: 6px 0 0;
  list-style: none;
}

.menu-card__chip {
  overflow: hidden;
  max-inline-size: 100%;
  padding: 3px 10px;
  border-radius: 999px;
  background: rgba(var(--v-theme-primary), 0.1);
  color: rgb(var(--v-theme-primary));
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.menu-card__chip--more {
  background: rgba(var(--v-theme-on-surface), 0.07);
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

.menu-card--off .menu-card__chip {
  background: rgba(var(--v-theme-on-surface), 0.07);
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

.menu-card__chips-empty {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  gap: 6px;
  margin: 6px 0 0;
  padding: 3px 10px;
  border: 1px dashed rgba(var(--v-border-color), 0.4);
  border-radius: 999px;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

/* Deux chiffres clés côte à côte, dans un bloc teinté : la valeur d'abord, le libellé en dessous. */
.menu-card__stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  margin: auto 0 0;
  padding-block-start: 10px;
}

.menu-card__stats .menu-card__stat {
  padding: 8px 14px;
  background: rgba(var(--v-theme-on-surface), 0.04);
}

.menu-card__stat:first-child {
  border-radius: 12px 0 0 12px;
}

.menu-card__stat:last-child {
  border-radius: 0 12px 12px 0;
  border-inline-start: 1px solid rgba(var(--v-border-color), 0.2);
}

.menu-card__stat dt {
  display: flex;
  align-items: center;
  gap: 5px;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.75rem;
  font-weight: 500;
}

.menu-card__stat dd {
  margin: 2px 0 0;
  font-size: 1.35rem;
  font-weight: 700;
  line-height: 1.2;
}

.menu-card__footer {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 12px 10px 20px;
  border-block-start: 1px solid rgba(var(--v-border-color), 0.3);
}

@media (prefers-reduced-motion: reduce) {
  .menu-card {
    transition: none;
  }

  .menu-card:hover,
  .menu-card:focus-within {
    transform: none;
  }
}
</style>
