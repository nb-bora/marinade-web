import { defineFeature } from '@/lib/module/types'

/** Mon compte : identité, vérification de l'e-mail, authentification à deux facteurs. */
export default defineFeature({
  id: 'account',
  routes: [
    {
      path: '/account',
      component: () => import('./pages/AccountPage.vue'),
      meta: { title: 'Mon compte', withoutRestaurant: true },
    },
  ],
})
