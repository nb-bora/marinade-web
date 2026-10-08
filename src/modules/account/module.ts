import { defineFeature } from '@/lib/module/types'

/** Mon compte : identité, vérification de l'e-mail et du téléphone, double authentification, codes de secours. */
export default defineFeature({
  id: 'account',
  routes: [
    {
      path: '/account',
      component: () => import('./pages/AccountPage.vue'),
      meta: { title: 'Mon compte', withoutRestaurant: true },
    },
    {
      path: '/2fa/setup',
      component: () => import('./pages/TwoFactorSetupPage.vue'),
      meta: { title: 'Activer la double authentification', withoutRestaurant: true },
    },
  ],
})
