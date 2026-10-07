import { defineFeature } from '@/lib/module/types'

/** Historique des paiements Mobile Money du restaurant (Easy Transact). */
export default defineFeature({
  id: 'payments',
  routes: [
    {
      path: '/payments',
      component: () => import('./pages/PaymentsPage.vue'),
      meta: { title: 'Transactions', capability: 'cash_desk' },
    },
  ],
  nav: [
    {
      id: 'payments',
      title: 'Transactions',
      icon: 'ri-bank-card-line',
      to: '/payments',
      section: 'finance',
      order: 10,
      capability: 'cash_desk',
    },
  ],
  widgets: [
    {
      id: 'payments-today',
      component: () => import('./widgets/TodayPaymentsWidget.vue'),
      width: 12,
      order: 10,
      capability: 'cash_desk',
    },
    {
      id: 'payments-recent',
      component: () => import('./widgets/RecentPaymentsWidget.vue'),
      width: 6,
      order: 20,
      capability: 'cash_desk',
    },
  ],
})
