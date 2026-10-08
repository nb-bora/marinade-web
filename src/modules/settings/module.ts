import { defineFeature } from '@/lib/module/types'

/** Paramètres du restaurant : établissement, horaires, service et taxes, paiements. */
export default defineFeature({
  id: 'settings',
  routes: [
    {
      path: '/parametres',
      component: () => import('./pages/SettingsPage.vue'),
      meta: { title: 'Paramètres du restaurant', capability: 'management' },
    },
  ],
  nav: [
    {
      id: 'settings',
      title: 'Paramètres',
      icon: 'ri-settings-3-line',
      to: '/parametres',
      section: 'management',
      order: 90,
      capability: 'management',
    },
  ],
})
