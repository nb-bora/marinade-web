import { contactSentence, publisherLabel } from '../legalInfo'
import type { LegalInfo } from '../legalInfo'
import type { LegalDocument } from './types'

/** Conditions générales d'utilisation. */
export function buildTerms(info: LegalInfo): LegalDocument {
  return {
    title: 'Conditions d\'utilisation',
    summary: 'Les règles qui encadrent l\'utilisation de Marinade : votre compte, votre abonnement, vos encaissements, vos données, et les responsabilités de chacun.',
    updatedAt: '2026-11-09',
    version: '1.0',
    sections: [
      {
        id: 'objet',
        title: 'Objet et acceptation',
        blocks: [
          {
            type: 'p',
            text: `Les présentes conditions régissent l'accès et l'utilisation de Marinade, service en ligne de gestion pour restaurants et pressings édité par ${publisherLabel(info)}.`,
          },
          {
            type: 'p',
            text: 'En créant un compte, en cochant la case d\'acceptation ou en utilisant le service, vous reconnaissez les avoir lues et vous les acceptez. Si vous n\'êtes pas d\'accord, n\'utilisez pas Marinade.',
          },
          {
            type: 'p',
            text: 'Le traitement de vos données personnelles est décrit dans notre [politique de confidentialité](/privacy), qui fait partie intégrante de ces conditions.',
          },
        ],
      },
      {
        id: 'service',
        title: 'Le service',
        blocks: [
          { type: 'p', text: 'Marinade fournit, selon votre offre et votre type d\'établissement, des outils pour :' },
          {
            type: 'ul',
            items: [
              'un **restaurant** : carte (menus, plats, boissons), plan de salle et tables, commandes, cuisine, caisse, stock, réservations ;',
              'un **pressing** : commandes de linge, machines et cycles, caisse, rapports ;',
              'les deux : utilisateurs et rôles, abonnement, tableaux de bord, imports et exports de données.',
            ],
          },
          {
            type: 'p',
            text: 'Le service évolue : nous pouvons ajouter, modifier ou retirer des fonctions. Nous vous prévenons raisonnablement à l\'avance lorsqu\'un changement affecte de façon importante votre usage.',
          },
        ],
      },
      {
        id: 'compte',
        title: 'Votre compte',
        blocks: [
          {
            type: 'ul',
            items: [
              'Vous devez être **majeur** et avoir le pouvoir d\'engager l\'établissement pour lequel vous créez le compte.',
              'Les informations fournies (identité, e-mail, téléphone, établissement) doivent être **exactes** et tenues à jour.',
              'Un compte correspond à **une adresse e-mail**.',
              'Le compte est **activé** avec un code à 6 chiffres envoyé par e-mail, valable 15 minutes. Tant qu\'il n\'est pas activé, vous ne pouvez pas vous connecter ; vous pouvez demander un nouveau code (un envoi par minute) et le nombre d\'essais est limité.',
            ],
          },
        ],
      },
      {
        id: 'securite-compte',
        title: 'Sécurité et utilisateurs',
        blocks: [
          {
            type: 'p',
            text: 'Vous êtes responsable de la confidentialité de vos identifiants et de **toute action réalisée avec votre compte**. Choisissez un mot de passe robuste et unique, et activez la double authentification.',
          },
          {
            type: 'p',
            text: 'Si vous donnez accès à des collaborateurs (caissier, cuisine, serveur…), vous leur attribuez le rôle adapté, vous restez responsable de leur usage et vous retirez leurs accès lorsqu\'ils quittent l\'établissement.',
          },
          {
            type: 'p',
            text: 'Signalez-nous sans délai toute utilisation non autorisée ou toute suspicion de compromission.',
          },
        ],
      },
      {
        id: 'offres',
        title: 'Offres et abonnement',
        blocks: [
          {
            type: 'ul',
            items: [
              'Les offres, leurs fonctions, leurs limites et leurs prix sont ceux affichés dans l\'application au moment de votre choix, en FCFA.',
              'L\'inscription est gratuite et sans engagement. Une offre payante n\'est facturée qu\'après que vous l\'avez choisie.',
              'Vous pouvez changer d\'offre ou résilier à tout moment depuis votre espace ; le changement ou la résiliation prend effet à la fin de la période en cours, sans remboursement de la période déjà entamée, sauf disposition légale contraire.',
              'Nous pouvons modifier les prix ou les offres pour l\'avenir, en vous prévenant au moins 30 jours à l\'avance ; vous pouvez alors résilier sans frais avant l\'entrée en vigueur.',
              'En cas de non-paiement, nous pouvons restreindre ou suspendre les fonctions payantes après vous en avoir informé.',
            ],
          },
        ],
      },
      {
        id: 'paiements',
        title: 'Encaissements et paiements',
        blocks: [
          {
            type: 'p',
            text: 'Marinade est un **outil de gestion** : il enregistre et suit vos encaissements (espèces, Mobile Money, autres modes proposés) et produit vos rapports. L\'éditeur n\'est **ni banque, ni établissement de paiement** et n\'est pas partie à la vente entre vous et vos clients.',
          },
          {
            type: 'ul',
            items: [
              'Les paiements électroniques sont traités par les opérateurs concernés, selon leurs propres conditions et frais.',
              'Vous êtes responsable de l\'exactitude des prix, taxes et montants saisis, de la remise des justificatifs à vos clients et de vos obligations comptables et fiscales.',
              'Les rapports de Marinade sont une aide à la gestion ; ils ne remplacent pas votre comptabilité officielle.',
            ],
          },
        ],
      },
      {
        id: 'donnees',
        title: 'Vos données et contenus',
        blocks: [
          {
            type: 'ul',
            items: [
              '**Vous restez propriétaire** de vos données et contenus (carte, plats, photos, commandes, informations clients, etc.).',
              'Vous nous accordez uniquement le droit de les héberger, les traiter et les afficher **pour vous fournir le service**.',
              'Vous garantissez avoir le droit de les utiliser et de les confier à Marinade, notamment les données personnelles de vos clients, dont vous êtes responsable (voir la [politique de confidentialité](/privacy#donnees-de-vos-clients)).',
              'Vous pouvez exporter vos données à tout moment avec les fonctions d\'export du service. Nous vous recommandons de le faire régulièrement.',
            ],
          },
        ],
      },
      {
        id: 'usage-acceptable',
        title: 'Utilisation acceptable',
        blocks: [
          { type: 'p', text: 'Il est interdit de :' },
          {
            type: 'ul',
            items: [
              'utiliser Marinade pour une activité illégale, frauduleuse ou trompeuse ;',
              'tenter d\'accéder à des données ou à des comptes qui ne sont pas les vôtres, ou de contourner les mesures de sécurité ;',
              'perturber le service (attaque, surcharge volontaire, extraction automatisée massive) ;',
              'copier, décompiler ou revendre le service, sauf autorisation écrite ;',
              'téléverser des contenus illicites, portant atteinte aux droits de tiers ou contenant des programmes malveillants.',
            ],
          },
        ],
      },
      {
        id: 'disponibilite',
        title: 'Disponibilité du service',
        blocks: [
          {
            type: 'p',
            text: 'Nous faisons le maximum pour que Marinade soit disponible en continu, mais nous sommes tenus à une **obligation de moyens**. Le service peut être interrompu pour maintenance, mise à jour, incident technique, défaillance d\'un prestataire ou cas de force majeure.',
          },
          {
            type: 'note',
            text: 'Prévoyez une solution de repli pour les moments critiques (service du midi ou du soir, caisse) : un carnet de secours, et des exports réguliers de vos données.',
          },
        ],
      },
      {
        id: 'propriete-intellectuelle',
        title: 'Propriété intellectuelle',
        blocks: [
          {
            type: 'p',
            text: 'Marinade (logiciel, interface, marque, logo, textes, bases de données) appartient à l\'éditeur ou à ses concédants et est protégé par la loi. Nous vous accordons un droit **personnel, non exclusif, non cessible et révocable** d\'utiliser le service pour les besoins de votre établissement, pendant la durée de votre accès. Aucun autre droit n\'est transféré.',
          },
        ],
      },
      {
        id: 'suspension',
        title: 'Suspension et résiliation',
        blocks: [
          {
            type: 'ul',
            items: [
              'Vous pouvez **fermer votre compte** à tout moment.',
              'Nous pouvons **suspendre ou fermer** un compte, avec préavis lorsque c\'est possible, en cas de manquement grave ou répété à ces conditions, de risque pour la sécurité du service, de fraude ou d\'obligation légale. Nous vous en indiquons le motif.',
              'À la fermeture, vous pouvez récupérer vos données pendant un délai raisonnable, puis elles sont supprimées ou anonymisées comme décrit dans la [politique de confidentialité](/privacy#conservation).',
              'Les clauses qui, par nature, doivent survivre (propriété intellectuelle, responsabilité, litiges) continuent de s\'appliquer.',
            ],
          },
        ],
      },
      {
        id: 'responsabilite',
        title: 'Responsabilité',
        blocks: [
          {
            type: 'p',
            text: 'Chacun répond des dommages directs qu\'il cause à l\'autre par sa faute. Dans les limites autorisées par la loi :',
          },
          {
            type: 'ul',
            items: [
              'l\'éditeur n\'est pas responsable des dommages **indirects** (perte de chiffre d\'affaires, de clientèle ou d\'opportunité, manque à gagner) ;',
              'il n\'est pas responsable des pertes liées à une mauvaise utilisation du service, à une saisie erronée, à la perte de vos identifiants, à une panne de votre connexion, de votre matériel ou d\'un opérateur tiers ;',
              'sa responsabilité totale est **limitée aux sommes que vous avez payées pour le service au cours des 12 derniers mois** (ou, pour une offre gratuite, à un montant symbolique).',
            ],
          },
          {
            type: 'p',
            text: 'Rien dans ces conditions n\'exclut une responsabilité qui ne peut l\'être légalement (faute lourde ou dolosive, dommage corporel).',
          },
        ],
      },
      {
        id: 'donnees-personnelles',
        title: 'Données personnelles',
        blocks: [
          {
            type: 'p',
            text: 'Nous traitons vos données personnelles conformément à notre [politique de confidentialité](/privacy), qui précise les données collectées, leurs finalités, leur durée de conservation et vos droits.',
          },
        ],
      },
      {
        id: 'modifications',
        title: 'Modification des conditions',
        blocks: [
          {
            type: 'p',
            text: 'Nous pouvons mettre à jour ces conditions, par exemple pour tenir compte d\'une évolution du service ou de la loi. La date de dernière mise à jour figure en haut de cette page. Pour un changement important, nous vous prévenons par e-mail ou dans l\'application au moins 30 jours avant son entrée en vigueur. Si vous continuez à utiliser le service après cette date, vous acceptez la nouvelle version ; sinon, vous pouvez fermer votre compte.',
          },
        ],
      },
      {
        id: 'droit-applicable',
        title: 'Droit applicable et litiges',
        blocks: [
          {
            type: 'p',
            text: 'Ces conditions sont régies par le **droit camerounais**. En cas de différend, nous cherchons d\'abord une solution amiable. À défaut, les tribunaux compétents du Cameroun sont seuls compétents, sous réserve des règles impératives de compétence qui protégeraient une partie.',
          },
          {
            type: 'p',
            text: 'Si une clause est jugée invalide, les autres restent applicables. Le fait de ne pas exercer un droit n\'emporte pas renonciation à celui-ci.',
          },
        ],
      },
      {
        id: 'contact',
        title: 'Nous contacter',
        blocks: [
          { type: 'p', text: contactSentence(info, 'Pour toute question sur ces conditions') },
        ],
      },
    ],
  }
}
