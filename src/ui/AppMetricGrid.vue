<!--
  Grille des tuiles d'indicateurs (`AppMetricTile`) : autant de colonnes que la largeur le permet, et sur
  téléphone deux par ligne avec la première (la tuile mise en avant) sur toute la largeur. Même grille
  partout (salle, session, tables) pour que les écrans se lisent de la même façon.
-->
<template>
  <div
    class="metric-grid"
    role="group"
  >
    <slot />
  </div>
</template>

<style scoped>
.metric-grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
}

@media (max-width: 599px) {
  .metric-grid {
    gap: 0.75rem;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .metric-grid > :first-child {
    grid-column: 1 / -1;
  }
}
</style>
