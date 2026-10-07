import { defineFeature } from '@/lib/module/types'

/** Pages d'erreur : accès refusé, serveur injoignable, page introuvable. */
export default defineFeature({
  id: 'errors',
  routes: [
    {
      path: '/forbidden',
      component: () => import('./pages/ForbiddenPage.vue'),
      meta: { layout: 'blank', public: true, title: 'Accès refusé' },
    },
    {
      path: '/unavailable',
      component: () => import('./pages/UnavailablePage.vue'),
      meta: { layout: 'blank', public: true, title: 'Service indisponible' },
    },
    {
      // Doit rester la dernière route : elle attrape tout ce qui n'existe pas.
      path: '/:pathMatch(.*)*',
      component: () => import('./pages/NotFoundPage.vue'),
      meta: { layout: 'blank', public: true, title: 'Page introuvable' },
    },
  ],
})
