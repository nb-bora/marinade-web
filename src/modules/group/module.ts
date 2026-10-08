import { defineFeature } from '@/lib/module/types'

/** Reporting consolidé du propriétaire de plusieurs restaurants. */
export default defineFeature({
  id: 'group',
  routes: [
    {
      path: '/groupe',
      component: () => import('./pages/GroupPage.vue'),
      meta: { title: 'Mon groupe', capability: 'management' },
    },
  ],
  nav: [
    {
      id: 'group',
      title: 'Mon groupe',
      icon: 'ri-building-4-line',
      to: '/groupe',
      section: 'management',
      order: 10,
      capability: 'management',
    },
  ],
})
