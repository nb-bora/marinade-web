import { defineFeature } from '@/lib/module/types'

/** Historique des paiements Mobile Money du restaurant (Easy Transact). */
export default defineFeature({
  id: 'payments',
  etablissement: 'restaurant',
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
    { id: 'payments-highlight', component: () => import('./widgets/HighlightWidget.vue'), width: 4, order: 10, capability: 'cash_desk' },
    { id: 'payments-overview', component: () => import('./widgets/OverviewWidget.vue'), width: 8, order: 20, capability: 'cash_desk' },
    { id: 'payments-weekly', component: () => import('./widgets/WeeklyChartWidget.vue'), width: 8, order: 30, capability: 'cash_desk' },
    { id: 'payments-statuses', component: () => import('./widgets/StatusDonutWidget.vue'), width: 4, order: 40, capability: 'cash_desk' },
    { id: 'payments-recent', component: () => import('./widgets/RecentPaymentsWidget.vue'), width: 6, order: 50, capability: 'cash_desk' },
    { id: 'payments-watchlist', component: () => import('./widgets/WatchlistWidget.vue'), width: 6, order: 60, capability: 'cash_desk' },
  ],
})
