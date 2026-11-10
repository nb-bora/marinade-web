<!--
  Carte qui porte un tableau du stock : en-tête (titre, sous-titre, actions), barre d'outils facultative, puis le
  contenu. Même grammaire que les tuiles et les cartes de menu : bordure fine, rayon de 16 px, en-têtes de colonne
  en petites capitales. Les lignes d'état (`tr.row--rupture`, `tr.row--alerte`) reçoivent un filet coloré.
-->
<script setup lang="ts">
defineProps<{
  title?: string
  subtitle?: string
}>()
</script>

<template>
  <VCard class="stock-card">
    <div
      v-if="title || $slots.actions"
      class="stock-card__head"
    >
      <div class="min-w-0">
        <h2
          v-if="title"
          class="text-h6"
        >
          {{ title }}
        </h2>
        <p
          v-if="subtitle"
          class="text-body-2 text-medium-emphasis mb-0"
        >
          {{ subtitle }}
        </p>
      </div>
      <div
        v-if="$slots.actions"
        class="d-flex flex-wrap gap-2"
      >
        <slot name="actions" />
      </div>
    </div>

    <div
      v-if="$slots.toolbar"
      class="stock-card__toolbar"
    >
      <slot name="toolbar" />
    </div>

    <VDivider v-if="title || $slots.toolbar" />

    <slot />
  </VCard>
</template>

<style scoped>
.stock-card {
  overflow: hidden;
  border: 1px solid rgba(var(--v-border-color), 0.16);
  border-radius: 16px;
  box-shadow: 0 1px 2px rgba(var(--v-theme-on-surface), 0.04) !important;
}

.stock-card__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px 16px;
  padding: 16px 20px 12px;
}

.stock-card__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px 16px;
  padding: 4px 20px 16px;
}

.stock-card__toolbar :deep(.stock-search) {
  flex: 0 1 340px;
  min-inline-size: 220px;
}

.stock-card__toolbar :deep(.stock-filter) {
  max-inline-size: 100%;
  overflow-x: auto;
}

/* En-têtes de colonne : petites capitales sur fond teinté, comme les libellés des tuiles. */
.stock-card :deep(.v-table thead th) {
  background: rgba(var(--v-theme-on-surface), 0.03) !important;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.stock-card :deep(.v-table tbody tr) {
  transition: background-color 0.15s ease;
}

.stock-card :deep(tr.row--rupture > td:first-child) {
  box-shadow: inset 3px 0 0 rgb(var(--v-theme-error));
}

.stock-card :deep(tr.row--alerte > td:first-child) {
  box-shadow: inset 3px 0 0 rgb(var(--v-theme-warning));
}

.stock-card :deep(tr.row--muted .item-cell__title) {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

@media (max-width: 599px) {
  .stock-card__head,
  .stock-card__toolbar {
    padding-inline: 16px;
  }

  .stock-card__toolbar > * {
    flex: 1 1 100%;
  }

  .stock-card__toolbar :deep(.stock-search) {
    flex-basis: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .stock-card :deep(.v-table tbody tr) {
    transition: none;
  }
}
</style>
