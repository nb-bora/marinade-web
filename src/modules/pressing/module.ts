import { defineFeature } from '@/lib/module/types'

/**
 * L'espace pressing, réservé aux établissements de ce type : tableau de bord, plan du local,
 * parc de machines, tarifs au kilo, articles à l'unité, combinaisons à prix fixe et calculateur.
 *
 * La lecture du parc exige `front_of_house` (routes du back) ; toutes les écritures (zones, machines,
 * états, maintenances) exigent `management`, ce que chaque page vérifie pour ses boutons. Les tarifs,
 * articles et combinaisons sont ouverts à l'équipe en lecture. Le calculateur est réservé à la salle
 * et à la caisse : la route ne porte qu'une capacité, la page contrôle donc elle-même les deux.
 *
 * La caisse (journal du jour) et les clients sont ouverts à la salle (`front_of_house`) ; seule la
 * clôture de caisse exige `management`, ce que la page vérifie. Les rapports sont réservés à
 * `management`.
 */
export default defineFeature({
  id: 'pressing',
  etablissement: 'pressing',
  accueil: '/pressing',
  routes: [
    {
      path: '/pressing',
      component: () => import('./pages/PressingDashboardPage.vue'),
      meta: { title: 'Tableau de bord du pressing' },
    },
    {
      path: '/pressing/commandes',
      component: () => import('./pages/CommandesPage.vue'),
      meta: { title: 'Commandes du pressing', capability: 'front_of_house' },
    },
    {
      path: '/pressing/commandes/nouvelle',
      component: () => import('./pages/CommandeFormPage.vue'),
      meta: { title: 'Nouvelle commande', capability: 'front_of_house' },
    },
    {
      path: '/pressing/commandes/:id',
      component: () => import('./pages/CommandeDetailPage.vue'),
      meta: { title: 'Commande du pressing', capability: 'front_of_house' },
    },
    {
      path: '/pressing/commandes/:id/modifier',
      component: () => import('./pages/CommandeFormPage.vue'),
      meta: { title: 'Modifier la commande', capability: 'front_of_house' },
    },
    {
      path: '/pressing/caisse',
      component: () => import('./pages/CaissePage.vue'),
      meta: { title: 'Caisse du pressing', capability: 'front_of_house' },
    },
    {
      path: '/pressing/clients',
      component: () => import('./pages/ClientsPage.vue'),
      meta: { title: 'Clients du pressing', capability: 'front_of_house' },
    },
    {
      path: '/pressing/rapports',
      component: () => import('./pages/RapportsPage.vue'),
      meta: { title: 'Rapports du pressing', capability: 'management' },
    },
    {
      path: '/pressing/plan',
      component: () => import('./pages/PlanPage.vue'),
      meta: { title: 'Plan du pressing', capability: 'front_of_house' },
    },
    {
      path: '/pressing/machines',
      component: () => import('./pages/MachinesPage.vue'),
      meta: { title: 'Machines du pressing', capability: 'front_of_house' },
    },
    {
      path: '/pressing/tarifs',
      component: () => import('./pages/TarifsPage.vue'),
      meta: { title: 'Tarifs du pressing' },
    },
    {
      path: '/pressing/articles',
      component: () => import('./pages/ArticlesPage.vue'),
      meta: { title: 'Articles du pressing' },
    },
    {
      path: '/pressing/combinaisons',
      component: () => import('./pages/CombinaisonsPage.vue'),
      meta: { title: 'Combinaisons du pressing' },
    },
    {
      path: '/pressing/calculateur',
      component: () => import('./pages/CalculateurPage.vue'),
      meta: { title: 'Calculateur du pressing' },
    },
  ],
  nav: [
    { id: 'pressing-dashboard', title: 'Tableau de bord', icon: 'ri-dashboard-3-line', to: '/pressing', section: 'overview', order: 0 },
    { id: 'pressing-commandes', title: 'Commandes', icon: 'ri-shopping-basket-2-line', to: '/pressing/commandes', section: 'operations', order: 5, capability: 'front_of_house' },
    { id: 'pressing-caisse', title: 'Caisse', icon: 'ri-safe-2-line', to: '/pressing/caisse', section: 'operations', order: 6, capability: 'front_of_house' },
    { id: 'pressing-clients', title: 'Clients', icon: 'ri-group-line', to: '/pressing/clients', section: 'operations', order: 7, capability: 'front_of_house' },
    { id: 'pressing-plan', title: 'Plan du pressing', icon: 'ri-layout-grid-line', to: '/pressing/plan', section: 'operations', order: 10, capability: 'front_of_house' },
    { id: 'pressing-machines', title: 'Machines', icon: 'ri-t-shirt-air-line', to: '/pressing/machines', section: 'operations', order: 20, capability: 'front_of_house' },
    { id: 'pressing-rapports', title: 'Rapports', icon: 'ri-line-chart-line', to: '/pressing/rapports', section: 'management', order: 30, capability: 'management' },
    { id: 'pressing-tarifs', title: 'Tarifs du pressing', icon: 'ri-scales-3-line', to: '/pressing/tarifs', section: 'management', order: 40 },
    { id: 'pressing-articles', title: 'Articles du pressing', icon: 'ri-t-shirt-line', to: '/pressing/articles', section: 'management', order: 41 },
    { id: 'pressing-combinaisons', title: 'Combinaisons', icon: 'ri-stack-line', to: '/pressing/combinaisons', section: 'management', order: 42 },
    { id: 'pressing-calculateur', title: 'Calculateur', icon: 'ri-calculator-line', to: '/pressing/calculateur', section: 'management', order: 43 },
  ],
})
