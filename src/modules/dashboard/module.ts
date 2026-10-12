import { defineFeature } from '@/lib/module/types'

/** Page d'accueil : un tableau de bord fait des widgets que les autres modules lui apportent. */
export default defineFeature({
  id: 'dashboard',
  etablissement: 'restaurant',
  accueil: '/dashboard',
  routes: [
    {
      path: '/dashboard',
      component: () => import('./pages/DashboardPage.vue'),
      meta: { title: 'Tableau de bord' },
    },
  ],
  nav: [
    {
      id: 'dashboard',
      title: 'Tableau de bord',
      icon: 'ri-dashboard-line',
      to: '/dashboard',
      section: 'overview',
      order: 0,
    },
  ],
})
