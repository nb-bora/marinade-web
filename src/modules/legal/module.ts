import { defineFeature } from '@/lib/module/types'

/** Pages légales publiques : politique de confidentialité et conditions d'utilisation. */
export default defineFeature({
  id: 'legal',
  routes: [
    {
      // Publiques : lues avant l'inscription (lien de la case d'acceptation) comme depuis un compte connecté.
      path: '/privacy',
      component: () => import('./pages/PrivacyPage.vue'),
      meta: { layout: 'blank', public: true, title: 'Politique de confidentialité' },
    },
    {
      path: '/terms',
      component: () => import('./pages/TermsPage.vue'),
      meta: { layout: 'blank', public: true, title: 'Conditions d\'utilisation' },
    },
  ],
})
