import { defineFeature } from '@/lib/module/types'

/** Administration de la plateforme, réservée aux administrateurs : comptes, offres, abonnements, opérateurs. */
export default defineFeature({
  id: 'platform',
  routes: [
    {
      path: '/admin/utilisateurs',
      component: () => import('./pages/UsersPage.vue'),
      meta: { title: 'Utilisateurs', platformAdmin: true },
    },
    {
      path: '/admin/offres',
      component: () => import('./pages/TiersPage.vue'),
      meta: { title: 'Offres', platformAdmin: true },
    },
    {
      path: '/admin/abonnements',
      component: () => import('./pages/SubscriptionsPage.vue'),
      meta: { title: 'Abonnements', platformAdmin: true },
    },
    {
      path: '/admin/operateurs',
      component: () => import('./pages/OperatorsPage.vue'),
      meta: { title: 'Opérateurs mobiles', platformAdmin: true },
    },
  ],
  nav: [
    { id: 'platform-users', title: 'Utilisateurs', icon: 'ri-group-line', to: '/admin/utilisateurs', section: 'platform', order: 10, platformAdmin: true },
    { id: 'platform-tiers', title: 'Offres', icon: 'ri-price-tag-3-line', to: '/admin/offres', section: 'platform', order: 20, platformAdmin: true },
    { id: 'platform-subscriptions', title: 'Abonnements', icon: 'ri-vip-crown-line', to: '/admin/abonnements', section: 'platform', order: 30, platformAdmin: true },
    { id: 'platform-operators', title: 'Opérateurs', icon: 'ri-sim-card-line', to: '/admin/operateurs', section: 'platform', order: 40, platformAdmin: true },
  ],
})
