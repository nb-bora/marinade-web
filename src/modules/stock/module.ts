import { defineFeature } from '@/lib/module/types'

/**
 * Stock des composants, fiches techniques, combinaisons et approvisionnement.
 * La lecture est ouverte à l'équipe de production (capacité `stock`) ; les écritures sur les
 * composants, fiches et combinaisons demandent `management` (boutons masqués sinon).
 */
export default defineFeature({
  id: 'stock',
  etablissement: 'restaurant',
  routes: [
    {
      path: '/stock',
      component: () => import('./pages/StockPage.vue'),
      meta: { title: 'Stock', capability: 'stock' },
    },
    {
      path: '/stock/import',
      component: () => import('./pages/ImportPage.vue'),
      meta: { title: 'Importer le stock', capability: 'management' },
    },
    {
      path: '/stock/composants',
      component: () => import('./pages/ComposantsPage.vue'),
      meta: { title: 'Composants', capability: 'stock' },
    },
    {
      path: '/stock/recettes',
      component: () => import('./pages/RecettesPage.vue'),
      meta: { title: 'Fiches techniques', capability: 'stock' },
    },
    {
      path: '/stock/combinaisons',
      component: () => import('./pages/CombinaisonsPage.vue'),
      meta: { title: 'Combinaisons', capability: 'stock' },
    },
    {
      path: '/stock/approvisionnement',
      component: () => import('./pages/ApprovisionnementPage.vue'),
      meta: { title: 'Approvisionnement', capability: 'stock' },
    },
  ],
  nav: [
    { id: 'stock-import', title: 'Importer', icon: 'ri-file-excel-2-line', to: '/stock/import', section: 'catalog', order: 39, capability: 'management' },
    { id: 'stock', title: 'Stock', icon: 'ri-stack-line', to: '/stock', section: 'catalog', order: 40, capability: 'stock' },
    { id: 'stock-composants', title: 'Composants', icon: 'ri-leaf-line', to: '/stock/composants', section: 'catalog', order: 50, capability: 'stock' },
    { id: 'stock-recettes', title: 'Fiches techniques', icon: 'ri-list-check-2', to: '/stock/recettes', section: 'catalog', order: 60, capability: 'stock' },
    { id: 'stock-combinaisons', title: 'Combinaisons', icon: 'ri-restaurant-2-line', to: '/stock/combinaisons', section: 'catalog', order: 70, capability: 'stock' },
    { id: 'stock-approvisionnement', title: 'Approvisionnement', icon: 'ri-shopping-basket-2-line', to: '/stock/approvisionnement', section: 'catalog', order: 80, capability: 'stock' },
  ],
  widgets: [
    { id: 'stock-alerts', component: () => import('./widgets/StockAlertsWidget.vue'), width: 6, order: 70, capability: 'stock' },
  ],
})
