import { defineFeature } from '@/lib/module/types'

/** Plan de salle et service en salle : tables, sessions, prise de commande. */
export default defineFeature({
  id: 'floor',
  etablissement: 'restaurant',
  routes: [
    {
      path: '/salle',
      component: () => import('./pages/FloorPage.vue'),
      meta: { title: 'Plan de salle', capability: 'front_of_house' },
    },
    {
      path: '/salle/sessions/:sessionId',
      component: () => import('./pages/SessionPage.vue'),
      meta: { title: 'Session', capability: 'front_of_house' },
    },
    {
      path: '/salle/tables',
      component: () => import('./pages/TablesPage.vue'),
      meta: { title: 'Tables', capability: 'front_of_house' },
    },
  ],
  nav: [
    {
      id: 'floor-plan',
      title: 'Plan de salle',
      icon: 'ri-layout-grid-line',
      to: '/salle',
      section: 'service',
      order: 10,
      capability: 'front_of_house',
    },
    {
      id: 'floor-tables',
      title: 'Tables',
      icon: 'ri-table-line',
      to: '/salle/tables',
      section: 'service',
      order: 20,
      capability: 'front_of_house',
    },
  ],
  widgets: [
    { id: 'floor-overview', component: () => import('./widgets/FloorWidget.vue'), width: 4, order: 15, capability: 'front_of_house' },
  ],
})
