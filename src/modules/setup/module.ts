import { defineFeature } from '@/lib/module/types'

/** Premier lancement : ouvrir son restaurant, ou attendre d'être ajouté à une équipe. */
export default defineFeature({
  id: 'setup',
  routes: [
    {
      path: '/setup',
      component: () => import('./pages/SetupPage.vue'),
      meta: { layout: 'blank', withoutRestaurant: true, title: 'Mon restaurant' },
    },
  ],
})
