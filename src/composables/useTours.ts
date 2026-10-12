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
    'dashboard': {
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

    'catalog': {
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

    'stock': {
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

    'floor': {
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

    'cashdesk': {
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

    'kitchen': {
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

    'reservations': {
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

    'subscription': {
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

    'orders': {
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

    'settings': {
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

    'platform': {
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

    'group': {
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

    'payments': {
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

    'pressing': {
      title: 'Les tarifs et le calculateur',
      paths: ['/pressing/tarifs', '/pressing/articles', '/pressing/combinaisons', '/pressing/calculateur'],
      steps: [
        {
          title: 'Les tarifs',
          text: 'Fixez le prix du kilo de lavage, proposez le séchage et choisissez comment arrondir les fractions de kilo. L\'aperçu montre l\'effet de vos réglages.',
          target: CARD,
          position: 'bottom',
          action: go('/pressing/tarifs'),
        },
        {
          title: 'Les articles',
          text: 'Ajoutez les pièces facturées à l\'unité : drap, taie d\'oreiller, couette... Vous pouvez aussi les importer depuis Excel.',
          target: HEADER,
          position: 'bottom',
          action: go('/pressing/articles'),
        },
        {
          title: 'Les combinaisons',
          text: 'Composez vos propres ensembles d\'articles vendus à prix fixe. L\'économie par rapport à la vente séparée s\'affiche en direct.',
          target: HEADER,
          position: 'bottom',
          action: go('/pressing/combinaisons'),
        },
        {
          title: 'Le calculateur',
          text: 'Saisissez le poids du linge, ajoutez des articles ou des combinaisons : le total se met à jour tout seul à droite.',
          target: '.calc-summary',
          position: 'left',
          action: go('/pressing/calculateur'),
        },
      ],
    },

    'pressing-plan': {
      title: 'Le plan du pressing',
      paths: ['/pressing/plan'],
      steps: [
        {
          title: 'Votre local vu du dessus',
          text: 'Chaque zone est un rectangle de couleur ; chaque machine est un cercle (lave-linge) ou un carré (sèche-linge) teinté selon son état. Ctrl + molette ou deux doigts pour zoomer.',
          target: '[data-tour="plan-canvas"]',
          position: 'top',
          action: go('/pressing/plan'),
        },
        {
          title: 'La légende',
          text: 'Elle compte les machines par état : libre, réservée, en cycle, à décharger, en maintenance ou hors service.',
          target: '[data-tour="plan-legend"]',
          position: 'top',
        },
        {
          title: 'Ouvrir la fiche d\'une machine',
          text: 'Touchez une machine pour voir sa fiche technique et ses programmes, changer son état, déclarer une panne et lire son historique.',
          target: '[data-tour="plan-canvas"]',
          position: 'top',
        },
        {
          title: 'Aménager le plan',
          text: 'Passez en mode aménagement pour glisser les zones et les machines, tirer le coin d\'une zone pour la redimensionner, puis enregistrer. « Annuler » rend la mise en page d\'avant.',
          target: '[data-tour="plan-edit"]',
          position: 'bottom',
        },
        {
          title: 'Créer zones et machines',
          text: 'Dessinez d\'abord vos zones (lavage, séchage, réception...), puis ajoutez vos machines et posez-les sur le plan.',
          target: '[data-tour="plan-new-zone"]',
          position: 'bottom',
        },
      ],
    },

    'pressing-machines': {
      title: 'Les machines',
      paths: ['/pressing/machines'],
      steps: [
        {
          title: 'Le parc de machines',
          text: 'Toutes vos machines avec leur état, leur capacité et leur zone. Filtrez par catégorie, état ou statut, ou cherchez par nom, marque ou numéro de série.',
          target: CARD,
          position: 'bottom',
          action: go('/pressing/machines'),
        },
        {
          title: 'Ajouter une machine',
          text: 'La fiche technique tient en cinq onglets : identité, fonctionnement, programmes (nom, durée, types de linge), consommation et notes.',
          target: '[data-tour="machines-add"]',
          position: 'bottom',
        },
        {
          title: 'La fiche d\'une machine',
          text: 'Cliquez sur une ligne pour ouvrir la fiche : seuls les changements d\'état permis depuis l\'état actuel sont proposés.',
          target: TABLE,
          position: 'top',
        },
      ],
    },

    // Placées avant « pressing-dashboard », dont le chemin `/pressing` couvre toutes les pages du
    // pressing : la recherche par chemin prend la première visite qui correspond.
    'pressing-caisse': {
      title: 'La caisse du pressing',
      capability: 'front_of_house',
      paths: ['/pressing/caisse'],
      steps: [
        {
          title: 'Choisir le jour',
          text: 'Aujourd\'hui, hier ou un autre jour passé : le journal de caisse se met à jour aussitôt. Celui du jour s\'actualise tout seul.',
          target: '[data-tour="caisse-day"]',
          position: 'bottom',
          action: go('/pressing/caisse'),
        },
        {
          title: 'Ce qui a été encaissé',
          text: 'Le total encaissé du jour, puis le détail par moyen : espèces, Mobile Money, carte et autres moyens.',
          target: '[data-tour="caisse-modes"]',
          position: 'bottom',
        },
        {
          title: 'La clôture de caisse',
          text: 'En fin de journée, un responsable compte les espèces du tiroir : l\'écart avec les espèces attendues s\'affiche avant de clôturer.',
          target: '[data-tour="caisse-cloture"]',
          position: 'left',
        },
        {
          title: 'Les paiements',
          text: 'Chaque paiement avec son heure, sa commande et son client. Touchez le numéro de commande pour l\'ouvrir. Une annulation apparaît en rouge.',
          target: '[data-tour="caisse-list"]',
          position: 'top',
        },
        {
          title: 'Imprimer et exporter',
          text: 'Imprimez le journal du jour sur une page A4, ou exportez-le en CSV pour votre comptabilité.',
          target: '[data-tour="caisse-print"]',
          position: 'bottom',
        },
      ],
    },

    'pressing-clients': {
      title: 'Les clients du pressing',
      capability: 'front_of_house',
      paths: ['/pressing/clients'],
      steps: [
        {
          title: 'Retrouver un client',
          text: 'Cherchez par nom ou par numéro de téléphone. Un client apparaît dès sa première commande.',
          target: '[data-tour="clients-search"]',
          position: 'bottom',
          action: go('/pressing/clients'),
        },
        {
          title: 'Ce que chaque client a commandé',
          text: 'Nombre de commandes, total dépensé et reste à payer, en orange s\'il reste quelque chose. Touchez un client pour voir toutes ses commandes.',
          target: '[data-tour="clients-list"]',
          position: 'top',
        },
      ],
    },

    'pressing-rapports': {
      title: 'Les rapports du pressing',
      capability: 'management',
      paths: ['/pressing/rapports'],
      steps: [
        {
          title: 'Choisir la période',
          text: 'Les 7, 30 ou 90 derniers jours, ou deux dates de votre choix, sur un an au plus.',
          target: '[data-tour="rapports-period"]',
          position: 'bottom',
          action: go('/pressing/rapports'),
        },
        {
          title: 'Les chiffres clés',
          text: 'Le chiffre d\'affaires facturé compte les commandes non annulées ; la durée des cycles est mesurée sur les cycles réellement terminés.',
          target: '[data-tour="rapports-metrics"]',
          position: 'bottom',
        },
        {
          title: 'Jour après jour',
          text: 'Le chiffre d\'affaires facturé de chaque jour. Survolez la courbe pour lire le montant d\'un jour.',
          target: '[data-tour="rapports-chart"]',
          position: 'top',
        },
        {
          title: 'Les machines',
          text: 'Les cycles terminés et le temps d\'utilisation de chaque machine, de la plus utilisée à la moins utilisée.',
          target: '[data-tour="rapports-machines"]',
          position: 'top',
        },
        {
          title: 'Exporter',
          text: 'Téléchargez tout le rapport de la période en CSV, lisible dans Excel.',
          target: '[data-tour="rapports-export"]',
          position: 'bottom',
        },
      ],
    },

    'pressing-dashboard': {
      title: 'Le tableau de bord du pressing',
      paths: ['/pressing'],
      steps: [
        {
          title: 'Bienvenue',
          text: 'Cette page résume l\'activité de votre pressing : le parc de machines, les cycles en cours et les alertes.',
          action: go('/pressing'),
        },
        {
          title: 'L\'état du parc',
          text: 'Chaque tuile compte les machines libres, occupées, réservées, en maintenance ou hors service. Touchez-en une pour afficher ces machines.',
          target: '[data-tour="dashboard-tiles"]',
          position: 'bottom',
        },
        {
          title: 'Le plan',
          text: 'Le plan montre l\'emplacement et l\'état de chaque machine dans votre local.',
          target: '[data-tour="dashboard-plan"]',
          position: 'bottom',
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
