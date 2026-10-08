import { defineFeature } from '@/lib/module/types'

/**
 * Abonnement du restaurant : offre, plafond et solde du jour, transactions.
 * Réservé au management : l'abonnement engage le restaurant (c'est le propriétaire qui le détient).
 */
export default defineFeature({
  id: 'subscription',
  routes: [
    {
      path: '/abonnement',
      component: () => import('./pages/SubscriptionPage.vue'),
      meta: { title: 'Mon abonnement', capability: 'management' },
    },
  ],
  nav: [
    {
      id: 'subscription',
      title: 'Abonnement',
      icon: 'ri-vip-crown-2-line',
      to: '/abonnement',
      section: 'management',
      order: 20,
      capability: 'management',
    },
  ],
})
