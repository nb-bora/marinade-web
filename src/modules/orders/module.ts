import { defineFeature } from '@/lib/module/types'

/** Commandes de l'ancien circuit (routes dépréciées du back) et leurs remboursements. */
export default defineFeature({
  id: 'orders',
  routes: [
    {
      path: '/commandes/import',
      component: () => import('./pages/ImportPage.vue'),
      meta: { title: 'Importer des commandes', capability: 'front_of_house' },
    },
    {
      path: '/commandes',
      component: () => import('./pages/OrdersPage.vue'),
      meta: { title: 'Commandes', capability: 'front_of_house' },
    },
  ],
  nav: [
    {
      id: 'orders-import',
      title: 'Importer',
      icon: 'ri-file-excel-2-line',
      to: '/commandes/import',
      section: 'finance',
      order: 29,
      capability: 'front_of_house',
    },
    {
      id: 'orders',
      title: 'Commandes',
      icon: 'ri-file-list-3-line',
      to: '/commandes',
      section: 'finance',
      order: 30,
      capability: 'front_of_house',
    },
  ],
})
