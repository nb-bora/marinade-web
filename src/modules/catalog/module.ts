import { defineFeature } from '@/lib/module/types'

/**
 * La carte du restaurant : menus et catégories, plats, boissons.
 * La lecture est ouverte à toute l'équipe (serveurs et cuisine consultent la carte) ;
 * seules les écritures exigent `management`, ce que chaque page vérifie pour ses boutons.
 */
export default defineFeature({
  id: 'catalog',
  routes: [
    {
      path: '/catalog/menus',
      component: () => import('./pages/MenusPage.vue'),
      meta: { title: 'Menus et catégories' },
    },
    {
      path: '/catalog/plats',
      component: () => import('./pages/PlatsPage.vue'),
      meta: { title: 'Plats' },
    },
    {
      path: '/catalog/boissons',
      component: () => import('./pages/BoissonsPage.vue'),
      meta: { title: 'Boissons' },
    },
  ],
  nav: [
    { id: 'catalog-menus', title: 'Menus', icon: 'ri-book-open-line', to: '/catalog/menus', section: 'catalog', order: 10 },
    { id: 'catalog-plats', title: 'Plats', icon: 'ri-restaurant-2-line', to: '/catalog/plats', section: 'catalog', order: 20 },
    { id: 'catalog-boissons', title: 'Boissons', icon: 'ri-goblet-line', to: '/catalog/boissons', section: 'catalog', order: 30 },
  ],
})
