import { defineFeature } from '@/lib/module/types'

/** Calendrier des réservations et liste d'attente de la salle. */
export default defineFeature({
  id: 'reservations',
  routes: [
    {
      path: '/reservations',
      component: () => import('./pages/ReservationsPage.vue'),
      meta: { title: 'Réservations', capability: 'reservations' },
    },
    {
      path: '/reservations/attente',
      component: () => import('./pages/WaitlistPage.vue'),
      meta: { title: 'Liste d\'attente', capability: 'reservations' },
    },
  ],
  nav: [
    {
      id: 'reservations',
      title: 'Réservations',
      icon: 'ri-calendar-event-line',
      to: '/reservations',
      section: 'service',
      order: 40,
      capability: 'reservations',
    },
    {
      id: 'reservations-waitlist',
      title: 'Liste d\'attente',
      icon: 'ri-time-line',
      to: '/reservations/attente',
      section: 'service',
      order: 50,
      capability: 'reservations',
    },
  ],
  widgets: [
    {
      id: 'reservations-today',
      component: () => import('./widgets/TodayReservationsWidget.vue'),
      width: 6,
      order: 70,
      capability: 'reservations',
    },
  ],
})
