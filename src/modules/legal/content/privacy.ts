import { contactSentence, publisherLabel } from '../legalInfo'
import type { LegalInfo } from '../legalInfo'
import type { LegalDocument } from './types'

/** Politique de confidentialité. Les données citées sont celles que l'application traite réellement. */
export function buildPrivacy(info: LegalInfo): LegalDocument {
  return {
    title: 'Politique de confidentialité',
    summary: 'Quelles données Marinade collecte, pourquoi, avec qui elles sont partagées, combien de temps elles sont gardées et comment exercer vos droits. Nous ne vendons pas vos données et n\'utilisons aucun traceur publicitaire.',
    updatedAt: '2026-11-09',
    version: '1.0',
    sections: [
      {
        id: 'qui-sommes-nous',
        title: 'Qui sommes-nous ?',
        blocks: [
          {
            type: 'p',
            text: `Marinade est un service en ligne de gestion pour restaurants et pressings (salle, cuisine, caisse, stock, commandes, abonnement). Il est édité par ${publisherLabel(info)}.`,
          },
          {
            type: 'p',
            text: 'Cette politique s\'applique au site et à l\'application Marinade. Selon les données, nous intervenons de deux façons différentes :',
          },
          {
            type: 'ul',
            items: [
              '**Responsable du traitement** pour les données de votre compte et de votre utilisation du service (inscription, connexion, sécurité, gestion de l\'abonnement).',
              '**Sous-traitant** pour les données de vos propres clients que vous saisissez dans Marinade (commandes, coordonnées). Vous restez responsable de ces données et nous ne les traitons que pour vous fournir le service (voir [Les données de vos clients](#donnees-de-vos-clients)).',
            ],
          },
        ],
      },
      {
        id: 'donnees-collectees',
        title: 'Les données que nous collectons',
        blocks: [
          { type: 'p', text: 'Nous ne collectons que ce qui est nécessaire au fonctionnement du service.' },
          {
            type: 'table',
            caption: 'Données collectées et usage',
            head: ['Catégorie', 'Exemples', 'À quoi cela sert'],
            rows: [
              ['Identité et contact', 'Nom, prénom, adresse e-mail, numéro de téléphone mobile', 'Créer votre compte, vous identifier, vous écrire (code d\'activation, réinitialisation du mot de passe, alertes de sécurité)'],
              ['Accès et sécurité', 'Mot de passe (stocké uniquement sous forme chiffrée irréversible), codes d\'activation et de réinitialisation (stockés hachés), secret de double authentification, codes de secours, nombre de tentatives', 'Protéger votre compte, limiter les tentatives abusives, vérifier votre e-mail'],
              ['Rôle et droits', 'Rôle (administrateur, caissier, cuisine, etc.), établissement rattaché', 'N\'afficher que ce que vous avez le droit de voir'],
              ['Votre établissement', 'Nom, type (restaurant ou pressing), adresse, carte et prix, tables et plan de salle, stock, fournisseurs, machines', 'Faire fonctionner votre espace de gestion'],
              ['Activité et encaissements', 'Commandes, tickets, montants, mode de paiement (espèces, Mobile Money, etc.), sessions de caisse', 'Gérer le service, la caisse et vos rapports'],
              ['Abonnement', 'Offre choisie, statut, dates', 'Appliquer les fonctions et limites de votre offre'],
              ['Données techniques', 'Adresse IP, type de navigateur, identifiant de requête, horodatage, erreurs', 'Sécuriser le service, détecter les abus, diagnostiquer les pannes'],
            ],
          },
          {
            type: 'note',
            text: 'Nous ne collectons ni pièce d\'identité, ni numéro de carte bancaire, ni localisation précise, ni donnée sensible au sens de la loi.',
          },
        ],
      },
      {
        id: 'donnees-de-vos-clients',
        title: 'Les données de vos clients',
        blocks: [
          {
            type: 'p',
            text: 'Vous pouvez enregistrer dans Marinade des informations sur vos propres clients (par exemple le nom et le téléphone d\'un client de pressing, ou le détail d\'une commande). Pour ces données, **vous êtes le responsable du traitement** et nous agissons pour votre compte.',
          },
          {
            type: 'ul',
            items: [
              'Nous les traitons uniquement pour fournir le service, selon vos instructions.',
              'Nous ne les utilisons ni pour notre propre compte, ni pour de la publicité, et ne les partageons pas en dehors des prestataires listés plus bas.',
              'C\'est à vous d\'informer vos clients et de répondre à leurs demandes. Nous vous y aidons (export, correction, suppression).',
              'À la fin de votre abonnement, ces données sont supprimées ou vous sont restituées (voir [Durée de conservation](#conservation)).',
            ],
          },
        ],
      },
      {
        id: 'finalites',
        title: 'Pourquoi nous utilisons vos données',
        blocks: [
          { type: 'p', text: 'Chaque usage repose sur un fondement précis :' },
          {
            type: 'ul',
            items: [
              '**Exécuter le contrat** : créer et activer votre compte, fournir les fonctions de gestion, gérer votre abonnement.',
              '**Intérêt légitime** : assurer la sécurité du service, prévenir la fraude et les abus, améliorer la fiabilité.',
              '**Obligation légale** : conserver les pièces exigées par la réglementation comptable et fiscale, répondre à une demande d\'une autorité compétente.',
              '**Votre consentement** lorsqu\'il est demandé (par exemple l\'acceptation de ces règles à l\'inscription). Vous pouvez le retirer à tout moment, sans effet sur ce qui a eu lieu avant.',
            ],
          },
          {
            type: 'p',
            text: 'Nous n\'effectuons **aucune décision entièrement automatisée** ayant des effets juridiques sur vous, et nous ne **vendons jamais** vos données.',
          },
        ],
      },
      {
        id: 'cookies-stockage',
        title: 'Cookies et stockage dans votre navigateur',
        blocks: [
          {
            type: 'p',
            text: 'Marinade n\'utilise **aucun cookie publicitaire, aucun traceur d\'audience tiers et aucun outil de suivi comportemental**. Le service enregistre seulement, dans le stockage local de votre navigateur, des informations indispensables à son fonctionnement ou à votre confort. Elles restent sur votre appareil, à l\'exception du jeton de session, envoyé à nos serveurs pour vous authentifier.',
          },
          {
            type: 'table',
            caption: 'Informations enregistrées dans votre navigateur',
            head: ['Nom', 'Contenu', 'Durée', 'Nature'],
            rows: [
              ['marinade.session', 'Jetons de session (accès et renouvellement)', 'Fermeture de l\'onglet, ou déconnexion si vous avez coché « Rester connecté »', 'Indispensable'],
              ['marinade.theme', 'Thème clair ou sombre', 'Jusqu\'à effacement', 'Confort'],
              ['marinade.locale', 'Langue d\'affichage', 'Jusqu\'à effacement', 'Confort'],
              ['marinade.floor.*, marinade.kitchen.*, marinade.pressing.*, marinade.settings.*, marinade.platform.*', 'Préférences d\'affichage (niveau du plan de salle, son des alertes, brouillons de formulaire, filtres)', 'Jusqu\'à effacement', 'Confort'],
              ['marinade.tours.dismissed', 'Visites guidées déjà vues', 'Jusqu\'à effacement', 'Confort'],
            ],
          },
          {
            type: 'p',
            text: 'Ces éléments étant strictement nécessaires ou de pur confort, ils ne demandent pas de bandeau de consentement. Vous pouvez les supprimer à tout moment dans les réglages de votre navigateur ; vous serez alors déconnecté et vos préférences réinitialisées.',
          },
        ],
      },
      {
        id: 'destinataires',
        title: 'Avec qui nous partageons vos données',
        blocks: [
          {
            type: 'p',
            text: 'Vos données ne sont accessibles qu\'aux personnes habilitées de l\'éditeur et à des prestataires techniques strictement nécessaires, qui agissent sur nos instructions :',
          },
          {
            type: 'table',
            caption: 'Prestataires techniques',
            head: ['Prestataire', 'Rôle', 'Données concernées'],
            rows: [
              ['Render (région de Francfort, Allemagne)', 'Hébergement de l\'API et de la base de données', 'Toutes les données du service'],
              ['Vercel', 'Diffusion du site et de l\'application web', 'Données techniques de connexion (adresse IP, requêtes) ; Vercel relaie vos appels à l\'API'],
              ['Prestataire d\'envoi d\'e-mails (SMTP)', 'Envoi des messages du service', 'Votre adresse e-mail, votre prénom et le contenu du message (code, lien)'],
              ['Opérateurs de paiement mobile', 'Traitement des paiements que vous choisissez d\'encaisser', 'Numéro et montant du paiement, selon les conditions de ces opérateurs'],
            ],
          },
          {
            type: 'p',
            text: 'Nous pouvons aussi communiquer des données à une autorité judiciaire, administrative ou de régulation lorsque la loi l\'impose. En cas de réorganisation de l\'éditeur (fusion, cession), vos données pourraient être transmises à l\'entité reprenant le service, avec les mêmes garanties.',
          },
        ],
      },
      {
        id: 'transferts',
        title: 'Où sont stockées vos données',
        blocks: [
          {
            type: 'p',
            text: 'La base de données et l\'API sont hébergées dans l\'Union européenne (Francfort). Le réseau de diffusion de Vercel peut servir les pages du site depuis d\'autres pays, mais ne stocke pas le contenu de votre compte.',
          },
          {
            type: 'p',
            text: 'Lorsque des données sont traitées en dehors de votre pays, nous veillons à ce que le prestataire offre des garanties appropriées (engagements contractuels, certifications, mesures de sécurité) conformes à la réglementation applicable.',
          },
        ],
      },
      {
        id: 'conservation',
        title: 'Durée de conservation',
        blocks: [
          {
            type: 'table',
            caption: 'Durées de conservation',
            head: ['Donnée', 'Durée'],
            rows: [
              ['Code d\'activation', 'Valable 15 minutes ; un compte non activé reste en attente tant qu\'il n\'est pas activé ou supprimé'],
              ['Jetons de session', 'Courte durée, renouvelés à l\'usage ; retirés de votre navigateur à la déconnexion'],
              ['Compte et données de l\'établissement', 'Pendant toute la durée d\'utilisation du service'],
              ['Après suppression du compte', 'Suppression ou anonymisation des données personnelles, hors celles que la loi nous oblige à garder'],
              ['Pièces comptables et de facturation', 'Durée imposée par la réglementation comptable et fiscale applicable'],
              ['Journaux techniques et de sécurité', 'Durée limitée, strictement nécessaire à la sécurité et au diagnostic'],
            ],
          },
          {
            type: 'p',
            text: 'Ce que vous supprimez vous-même (un plat, une commande, un client) cesse d\'apparaître immédiatement ; l\'effacement définitif des sauvegardes de l\'hébergeur intervient à l\'expiration de leur cycle de rotation.',
          },
        ],
      },
      {
        id: 'securite',
        title: 'Comment nous protégeons vos données',
        blocks: [
          {
            type: 'ul',
            items: [
              'Connexions chiffrées (HTTPS) entre votre appareil, le site et l\'API.',
              'Mots de passe jamais stockés en clair : seul un condensé irréversible l\'est. Codes d\'activation et de réinitialisation également hachés, à usage unique et limités dans le temps.',
              'Double authentification disponible, avec codes de secours à usage unique.',
              'Limitation du nombre de tentatives de connexion et d\'activation, contre les attaques par essais répétés.',
              'Cloisonnement par établissement : un compte n\'accède qu\'aux données de son établissement, selon son rôle.',
              'Accès internes restreints et limités au besoin d\'en connaître.',
            ],
          },
          {
            type: 'p',
            text: 'Aucun système n\'est infaillible. En cas de violation de données susceptible de vous porter préjudice, nous vous en informons, ainsi que l\'autorité compétente, dans les délais prévus par la loi. De votre côté, choisissez un mot de passe unique et robuste, activez la double authentification et ne partagez jamais votre accès.',
          },
        ],
      },
      {
        id: 'vos-droits',
        title: 'Vos droits',
        blocks: [
          {
            type: 'p',
            text: 'Conformément à la réglementation applicable en matière de protection des données personnelles, notamment la législation camerounaise et, lorsqu\'il s\'applique, le règlement européen (RGPD), vous disposez des droits suivants :',
          },
          {
            type: 'ul',
            items: [
              '**Accès** : obtenir une copie des données vous concernant.',
              '**Rectification** : corriger des données inexactes (la plupart se modifient dans votre profil).',
              '**Effacement** : demander la suppression de vos données, sous réserve des obligations légales de conservation.',
              '**Opposition et limitation** : vous opposer à un usage fondé sur l\'intérêt légitime ou en demander la suspension.',
              '**Portabilité** : récupérer vos données dans un format structuré et courant.',
              '**Retrait du consentement** à tout moment.',
            ],
          },
          { type: 'p', text: contactSentence(info, 'Pour exercer vos droits') },
          {
            type: 'p',
            text: 'Nous répondons dans un délai maximal d\'un mois et pouvons vous demander de justifier de votre identité. Si, après nous avoir contactés, vous estimez que vos droits ne sont pas respectés, vous pouvez saisir l\'autorité de protection des données compétente.',
          },
        ],
      },
      {
        id: 'mineurs',
        title: 'Mineurs',
        blocks: [
          {
            type: 'p',
            text: 'Marinade est destiné à des professionnels majeurs. Nous ne collectons pas sciemment de données concernant des mineurs ; si vous pensez que c\'est le cas, signalez-le-nous et nous les supprimerons.',
          },
        ],
      },
      {
        id: 'modifications',
        title: 'Modifications de cette politique',
        blocks: [
          {
            type: 'p',
            text: 'Nous pouvons faire évoluer cette politique, par exemple pour ajouter un prestataire ou une fonction. La date de dernière mise à jour figure en haut de cette page. En cas de changement important, nous vous en informons par e-mail ou dans l\'application avant son entrée en vigueur. L\'usage du service est aussi régi par nos [conditions d\'utilisation](/terms).',
          },
        ],
      },
      {
        id: 'contact',
        title: 'Nous contacter',
        blocks: [
          { type: 'p', text: contactSentence(info, 'Pour toute question sur cette politique ou sur vos données') },
        ],
      },
    ],
  }
}
