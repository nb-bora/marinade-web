import { defineFeature } from '@/lib/module/types'

/** Écrans de production : cuisine, bar et desserts (tickets en direct). */
export default defineFeature({
  id: 'kitchen',
  routes: [
    {
      path: '/cuisine',
      component: () => import('./pages/KitchenPage.vue'),
      meta: { title: 'Cuisine et bar', capability: 'production' },
    },
  ],
  nav: [
    {
      id: 'kitchen',
      title: 'Cuisine et bar',
      icon: 'ri-restaurant-2-line',
      to: '/cuisine',
      section: 'service',
      order: 30,
      capability: 'production',
    },
  ],
  widgets: [
    { id: 'kitchen-production', component: () => import('./widgets/ProductionWidget.vue'), width: 4, order: 70, capability: 'production' },
  ],
})
