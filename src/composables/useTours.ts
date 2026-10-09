import { createSharedComposable, useStorage } from '@vueuse/core'
import type { Capability } from '@/lib/api/types'
import { useSessionStore } from '@/stores/session.store'
import { useTenantStore } from '@/stores/tenant.store'

export interface TourStep {
  title: string
  text: string

  /** Sélecteur CSS de l'élément à mettre en valeur ; sans lui (ou s'il est introuvable), la bulle est centrée. */
  target?: string
  position?: 'top' | 'bottom' | 'left' | 'right'

  /** Exécuté en arrivant à cette étape (par exemple pour changer de page). */
  action?: () => void
}

export interface Tour {
  title: string
  steps: TourStep[]

  /** Capacité du restaurant requise (ou `platformAdmin`) pour proposer la visite. */
  capability?: Capability | 'platformAdmin'

  /** Début des chemins d'écran couverts par la visite : sert à retrouver la visite de la page courante. */
  paths?: string[]
}

// Éléments communs à tous les écrans (Vuetify et gabarit de l'application).
const HEADER = '.app-page-header'
const MAIN_ACTION = '.app-page-header .v-btn--variant-elevated'
const TABLE = '.layout-page-content .v-table'
const CARD = '.layout-page-content .v-card'
const NAV = '.layout-vertical-nav'

/**
 * Visites guidées de l'application, une par module. L'état (visite en cours, étape,
 * visites déjà vues) est partagé : le bouton de la barre du haut et la bulle lisent le même.
 */
export const useTours = createSharedComposable(() => {
  const router = useRouter()
  const session = useSessionStore()
  const tenant = useTenantStore()

  const go = (path: string) => () => {
    if (router.currentRoute.value.path !== path)
      void router.push(path)
  }

  /** Ouvre l'onglet numéro `index` (à partir de 1) de la page courante. */
  const openTab = (index: number) => () => {
    document.querySelectorAll<HTMLElement>('.layout-page-content .v-tabs .v-tab')[index - 1]?.click()
  }

  const tours = ref<Record<string, Tour>>({
    dashboard: {
      title: 'Le tableau de bord',
      paths: ['/dashboard'],
      steps: [
        {
          title: 'Bienvenue dans Marinade',
          text: 'Cette page résume l\'activité de votre restaurant d\'un coup d\'œil. Faisons le tour en trois étapes.',
          action: go('/dashboard'),
        },
        {
          title: 'Vos indicateurs principaux',
          text: 'Les six blocs principaux montrent les encaissements, l\'état de la salle, le stock à surveiller et la production en cours. Ils se mettent à jour tout seuls.',
          target: '.layout-page-content .v-row',
          position: 'top',
        },
        {
          title: 'Le menu de gauche',
          text: 'Chaque écran se trouve dans le menu de gauche. Vous n\'y voyez que ce que votre rôle dans ce restaurant vous permet d\'utiliser.',
          target: NAV,
          position: 'right',
        },
      ],
    },

    catalog: {
      title: 'La carte du restaurant',
      paths: ['/catalog'],
      steps: [
        {
          title: 'Menus et catégories',
          text: 'Un menu regroupe des catégories (entrées, plats, desserts...) dans l\'ordre où vos clients les découvrent.',
          target: HEADER,
          position: 'bottom',
          action: go('/catalog/menus'),
        },
        {
          title: 'Les plats',
          text: 'Chaque plat a un nom, une description et un prix. Vous pouvez le rendre indisponible en salle sans le supprimer.',
          target: TABLE,
          position: 'top',
          action: go('/catalog/plats'),
        },
        {
          title: 'Les boissons',
          text: 'Les boissons ont leur propre carte : catégories, prix, mention alcool et disponibilité.',
          target: TABLE,
          position: 'top',
          action: go('/catalog/boissons'),
        },
        {
          title: 'Créer un nouveau plat',
          text: 'Utilisez ce bouton pour ajouter un plat à la carte. Il apparaît aussitôt dans le plan de salle.',
          target: MAIN_ACTION,
          position: 'bottom',
          action: go('/catalog/plats'),
        },
      ],
    },

    stock: {
      title: 'Le stock',
      capability: 'stock',
      paths: ['/stock'],
      steps: [
        {
          title: 'Le stock par produit',
          text: 'Pour chaque composant, vous voyez la quantité disponible, celle réservée par les commandes en cours et son état.',
          target: TABLE,
          position: 'top',
          action: go('/stock'),
        },
        {
          title: 'Seuils et alertes',
          text: 'Fixez un seuil d\'alerte par produit : dès que le stock passe dessous, il apparaît en alerte et dans l\'approvisionnement.',
          target: `${TABLE} tbody tr:first-child`,
          position: 'bottom',
          action: go('/stock'),
        },
        {
          title: 'Les composants',
          text: 'Les composants sont les ingrédients de base : sauces, protéines, légumes... C\'est ici que vous les créez.',
          target: HEADER,
          position: 'bottom',
          action: go('/stock/composants'),
        },
        {
          title: 'Les recettes',
          text: 'Une fiche technique indique ce que consomme chaque plat. Le stock baisse alors automatiquement à chaque commande.',
          target: HEADER,
          position: 'bottom',
          action: go('/stock/recettes'),
        },
        {
          title: 'L\'approvisionnement',
          text: 'Cette page liste ce qu\'il faut racheter et en quelle quantité pour revenir à un niveau confortable.',
          target: HEADER,
          position: 'bottom',
          action: go('/stock/approvisionnement'),
        },
      ],
    },

    floor: {
      title: 'La salle',
      capability: 'front_of_house',
      paths: ['/salle'],
      steps: [
        {
          title: 'Voici le plan de votre salle',
          text: 'Chaque table est dessinée à sa place, vue du dessus, et change de couleur en direct. Ctrl + molette ou deux doigts pour zoomer ; « Réorganiser » pour déplacer les tables.',
          target: '.floor-plan',
          position: 'top',
          action: go('/salle'),
        },
        {
          title: 'Table libre : vert',
          text: 'Table libre = vert. Ouvrez une session en cliquant dessus : indiquez le nombre de couverts et, si besoin, le client.',
          target: '.floor-table--free',
          position: 'bottom',
        },
        {
          title: 'Table occupée : orange',
          text: 'Table occupée = orange. Cliquez pour voir les détails : couverts, durée, montant, puis reprenez la commande ou ajoutez des articles.',
          target: '.floor-table--busy',
          position: 'bottom',
        },
        {
          title: 'Table en paiement : rouge',
          text: 'Table en paiement = rouge. Les clients ont demandé l\'addition : réglez-la via la caisse.',
          target: '.floor-table--paying',
          position: 'bottom',
        },
      ],
    },

    cashdesk: {
      title: 'La caisse',
      capability: 'cash_desk',
      paths: ['/caisse'],
      steps: [
        {
          title: 'Ouvrir un shift',
          text: 'Commencez votre service en ouvrant un shift avec le fond de caisse. Sans shift ouvert, aucun encaissement n\'est possible.',
          target: HEADER,
          position: 'bottom',
          action: go('/caisse'),
        },
        {
          title: 'Les sessions en attente de paiement',
          text: 'Les additions demandées par la salle apparaissent ici. Choisissez celle que vous voulez encaisser.',
          target: CARD,
          position: 'top',
        },
        {
          title: 'Choisir le moyen de paiement',
          text: 'Espèces, Mobile Money ou carte : sélectionnez le moyen utilisé par le client. Un paiement peut être partagé.',
        },
        {
          title: 'Valider et clôturer',
          text: 'Une fois le montant reçu, validez : la session est clôturée, la table est libérée et la facture est prête à imprimer.',
        },
      ],
    },

    kitchen: {
      title: 'La cuisine et le bar',
      capability: 'production',
      paths: ['/cuisine'],
      steps: [
        {
          title: 'Les tickets en attente',
          text: 'Chaque commande envoyée par la salle arrive ici sous forme de ticket. Choisissez votre poste (cuisine ou bar) en haut.',
          target: HEADER,
          position: 'bottom',
          action: go('/cuisine'),
        },
        {
          title: 'Passer en préparation',
          text: 'Touchez le gros bouton d\'un ticket quand vous commencez à le préparer : la salle voit qu\'il est pris en charge.',
          target: `${CARD} .v-btn, ${CARD}`,
          position: 'top',
        },
        {
          title: 'Marquer comme prêt',
          text: 'Quand le plat est terminé, touchez de nouveau le bouton : le serveur est prévenu qu\'il peut venir le chercher.',
          target: `${CARD} .v-btn, ${CARD}`,
          position: 'top',
        },
      ],
    },

    reservations: {
      title: 'Les réservations',
      capability: 'reservations',
      paths: ['/reservations'],
      steps: [
        {
          title: 'Le calendrier',
          text: 'Parcourez les jours pour voir les tables réservées, avec l\'heure et le nombre de personnes.',
          target: '.layout-page-content .v-row',
          position: 'top',
          action: go('/reservations'),
        },
        {
          title: 'Créer une réservation',
          text: 'Utilisez le bouton de création pour noter le nom du client, son téléphone, l\'heure et le nombre de couverts.',
          target: MAIN_ACTION,
          position: 'bottom',
          action: go('/reservations'),
        },
        {
          title: 'La liste d\'attente',
          text: 'Les clients sans réservation qui attendent une table sont notés ici dans l\'ordre d\'arrivée.',
          target: HEADER,
          position: 'bottom',
          action: go('/reservations/attente'),
        },
        {
          title: 'Accueillir le client',
          text: 'À son arrivée, faites le check-in : vous lui attribuez une table et la session s\'ouvre en salle.',
          action: go('/reservations'),
        },
      ],
    },

    subscription: {
      title: 'Votre abonnement',
      capability: 'management',
      paths: ['/abonnement'],
      steps: [
        {
          title: 'L\'offre active et son plafond',
          text: 'Voici votre offre en cours et ce qu\'il vous reste à encaisser aujourd\'hui avant d\'atteindre le plafond journalier.',
          target: '.layout-page-content .v-row',
          position: 'bottom',
          action: go('/abonnement'),
        },
        {
          title: 'Transactions et historique',
          text: 'Retrouvez ici l\'historique de vos achats et les mouvements qui ont fait baisser votre solde.',
          target: `${CARD}:nth-of-type(2), ${TABLE}`,
          position: 'top',
        },
        {
          title: 'Comparer les offres',
          text: 'Comparez les formules disponibles et leur plafond pour savoir laquelle correspond à votre activité.',
          target: '.layout-page-content .v-row:nth-of-type(2), .layout-page-content .v-row',
          position: 'top',
        },
      ],
    },

    orders: {
      title: 'Les commandes',
      capability: 'front_of_house',
      paths: ['/commandes'],
      steps: [
        {
          title: 'Actives et historique',
          text: 'L\'onglet « Actives » montre les commandes en cours ; l\'onglet « Historique » garde toutes les commandes terminées.',
          target: '.layout-page-content .v-tabs',
          position: 'bottom',
          action: go('/commandes'),
        },
        {
          title: 'Créer une commande',
          text: 'Ce bouton ouvre une commande directe, sans passer par une table : utile pour la vente à emporter.',
          target: MAIN_ACTION,
          position: 'bottom',
          action: openTab(1),
        },
        {
          title: 'Les remboursements',
          text: 'Sur une commande payée, vous pouvez demander un remboursement ; un responsable doit ensuite l\'approuver.',
          target: TABLE,
          position: 'top',
        },
      ],
    },

    settings: {
      title: 'Les paramètres',
      capability: 'management',
      paths: ['/parametres'],
      steps: [
        {
          title: 'Les infos de l\'établissement',
          text: 'Nom, adresse, téléphone : ces informations apparaissent sur vos factures et vos reçus.',
          target: '.layout-page-content .v-tabs',
          position: 'bottom',
          action: () => {
            go('/parametres')()
            openTab(1)()
          },
        },
        {
          title: 'Les horaires',
          text: 'Indiquez vos horaires d\'ouverture jour par jour : ils servent à proposer des créneaux de réservation valides.',
          target: '.layout-page-content .v-tabs',
          position: 'bottom',
          action: openTab(2),
        },
        {
          title: 'Easy Transact',
          text: 'Configurez ici l\'encaissement par Mobile Money avec Easy Transact : sans cela, les paiements mobiles ne sont pas disponibles.',
          target: '.layout-page-content .v-tabs',
          position: 'bottom',
          action: openTab(4),
        },
      ],
    },

    platform: {
      title: 'La plateforme',
      capability: 'platformAdmin',
      paths: ['/admin'],
      steps: [
        {
          title: 'Utilisateurs et rôles',
          text: 'Tous les comptes de la plateforme : propriétaires, équipes et administrateurs. Vous pouvez changer le rôle d\'un compte.',
          target: HEADER,
          position: 'bottom',
          action: go('/admin/utilisateurs'),
        },
        {
          title: 'Les offres',
          text: 'Définissez les formules d\'abonnement proposées aux restaurants, avec leur prix et leur plafond d\'encaissement par jour.',
          target: HEADER,
          position: 'bottom',
          action: go('/admin/offres'),
        },
        {
          title: 'Les abonnements',
          text: 'Abonnez un restaurant à une offre puis activez-la : le restaurant peut alors encaisser jusqu\'au plafond.',
          target: MAIN_ACTION,
          position: 'bottom',
          action: go('/admin/abonnements'),
        },
      ],
    },

    group: {
      title: 'Votre groupe',
      capability: 'management',
      paths: ['/groupe'],
      steps: [
        {
          title: 'Les chiffres consolidés',
          text: 'Les ventes, le nombre de commandes et le panier moyen de tous vos restaurants, additionnés.',
          target: CARD,
          position: 'bottom',
          action: go('/groupe'),
        },
        {
          title: 'Comparaison par restaurant',
          text: 'Voyez ce que chaque restaurant apporte au total et repérez celui qui progresse ou qui décroche.',
          target: `${CARD}:nth-of-type(2), ${CARD}`,
          position: 'top',
        },
        {
          title: 'Répartition par moyen de paiement',
          text: 'Voyez comment l\'argent est encaissé : espèces, Mobile Money ou carte, tous restaurants confondus.',
          target: '.apexcharts-canvas',
          position: 'top',
        },
      ],
    },

    payments: {
      title: 'Les transactions',
      capability: 'cash_desk',
      paths: ['/payments'],
      steps: [
        {
          title: 'Les paiements Mobile Money',
          text: 'Chaque paiement reçu par Easy Transact apparaît ici, mis à jour en continu.',
          target: HEADER,
          position: 'bottom',
          action: go('/payments'),
        },
        {
          title: 'Filtrer la liste',
          text: 'Choisissez la période et filtrez par statut pour retrouver un paiement précis.',
          target: CARD,
          position: 'bottom',
        },
        {
          title: 'Le détail d\'un paiement',
          text: 'Cliquez sur une ligne pour voir la référence, le numéro payeur et l\'historique des étapes du paiement.',
          target: TABLE,
          position: 'top',
        },
      ],
    },
  })

  const currentTour = ref<string | null>(null)
  const step = ref(0)
  const dismissed = useStorage('marinade.tours.dismissed', new Set<string>())

  const current = computed(() => currentTour.value ? tours.value[currentTour.value] ?? null : null)
  const currentStep = computed(() => current.value?.steps[step.value] ?? null)
  const isLast = computed(() => !!current.value && step.value >= current.value.steps.length - 1)

  /** La visite est-elle proposée à cet utilisateur dans ce restaurant ? */
  function isAvailable(id: string): boolean {
    const capability = tours.value[id]?.capability

    if (!tours.value[id])
      return false

    if (!capability)
      return true

    return capability === 'platformAdmin' ? session.isPlatformAdmin : tenant.can(capability)
  }

  /** Visite de l'écran donné (chemin de la route), si elle existe et est permise. */
  function tourForPath(path: string): string | null {
    const found = Object.entries(tours.value).find(([id, tour]) =>
      isAvailable(id) && tour.paths?.some(prefix => path === prefix || path.startsWith(`${prefix}/`)))

    return found?.[0] ?? null
  }

  function isDismissed(id: string): boolean {
    return dismissed.value.has(id)
  }

  function enter(index: number): void {
    step.value = index
    current.value?.steps[index]?.action?.()
  }

  function start(id: string): void {
    if (!isAvailable(id))
      return

    currentTour.value = id
    enter(0)
  }

  function close(): void {
    currentTour.value = null
    step.value = 0
  }

  /** Marque la visite comme vue : on ne la propose plus (le bouton reste disponible). */
  function dismiss(id: string | null = currentTour.value): void {
    if (!id)
      return

    dismissed.value = new Set([...dismissed.value, id])
  }

  function next(): void {
    if (!current.value)
      return

    if (isLast.value) {
      dismiss()
      close()

      return
    }

    enter(step.value + 1)
  }

  function previous(): void {
    if (step.value > 0)
      enter(step.value - 1)
  }

  /** Passer : on ferme la visite et on ne la propose plus. */
  function skip(): void {
    dismiss()
    close()
  }

  return { tours, currentTour, step, dismissed, current, currentStep, isLast, isAvailable, isDismissed, tourForPath, start, next, previous, skip, dismiss, close }
})
