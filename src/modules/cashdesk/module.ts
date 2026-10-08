import { defineFeature } from '@/lib/module/types'

/**
 * La caisse : shift (ouverture, fermeture avec audit des écarts), sessions à encaisser,
 * encaissement en espèces / Mobile Money / carte / paiement partagé, reçu imprimable.
 * Tout exige la capacité `cash_desk` (les routes de paiement et de shift du back).
 */
export default defineFeature({
  id: 'cashdesk',
  routes: [
    {
      path: '/caisse',
      component: () => import('./pages/CashDeskPage.vue'),
      meta: { title: 'Caisse', capability: 'cash_desk' },
    },
    {
      // Chemin attendu par le module « salle » (bouton Encaisser de la session) : ne pas le changer.
      path: '/caisse/sessions/:sessionId',
      component: () => import('./pages/CheckoutPage.vue'),
      meta: { title: 'Encaissement', capability: 'cash_desk' },
    },
    {
      path: '/caisse/factures/:invoiceId',
      component: () => import('./pages/InvoicePage.vue'),
      meta: { title: 'Facture', capability: 'cash_desk' },
    },
  ],
  nav: [
    {
      id: 'cashdesk',
      title: 'Caisse',
      icon: 'ri-store-3-line',
      to: '/caisse',
      section: 'finance',
      order: 5,
      capability: 'cash_desk',
    },
  ],
})
