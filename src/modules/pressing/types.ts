import type { components } from '@/lib/api/schema'

/**
 * Types du pressing, écrits d'après le contrat de l'API
 * (`/v1/restaurants/{restaurant_id}/pressing`). Tarifs, articles et combinaisons sont décrits à la
 * main (leurs schémas ne figurent pas dans `src/lib/api/schema.d.ts`) ; les machines, zones, plan,
 * maintenances et historique sont des alias des schémas générés.
 */

export type RoundingMode = 'superieur' | 'proche'
export type RoundingStep = 1 | 100 | 500 | 1000

export interface Rounding {
  pas_grammes: RoundingStep
  mode: RoundingMode
}

export interface Tarifs {
  prix_kg: number
  prix_sechage_kg: number | null
  arrondi: Rounding
  devise: string
}

export type TarifsUpdate = Omit<Tarifs, 'devise'> & { devise?: string }

export interface Article {
  id: string
  nom: string
  prix_unitaire: number
  categorie: string | null
  actif: boolean
}

export interface ArticleWrite {
  nom: string
  prix_unitaire: number
  categorie?: string | null
  actif?: boolean
}

export interface CombinaisonLigne {
  article_id: string
  article_nom: string
  quantite: number
  prix_unitaire_reference: number
}

export interface Combinaison {
  id: string
  nom: string
  prix: number
  actif: boolean
  lignes: CombinaisonLigne[]
  total_articles: number
}

export interface CombinaisonWrite {
  nom: string
  prix: number
  lignes: Array<{ article_id: string; quantite: number }>
  actif?: boolean
}

export interface CalculRequest {
  poids_grams: number | null
  lavage: boolean
  sechage: boolean
  articles: Array<{ article_id: string; quantite: number }>
  combinaisons: Array<{ combinaison_id: string; quantite: number }>
  remise_fcfa: number
}

export type CalculLigneType = 'lavage' | 'sechage' | 'article' | 'combinaison'

export interface CalculLigne {
  type: CalculLigneType
  libelle: string

  /** Décimal sérialisé en chaîne par le serveur (« 4.000 » pour 4 kg). */
  quantite: string | number
  prix_unitaire: number
  montant: number
}

export interface Calcul {
  poids_facturable_grams: number | null
  lignes: CalculLigne[]
  sous_total: number
  remise_fcfa: number
  total: number
  devise: string
}

/** Ligne éditable « élément × quantité » (article ou combinaison). */
export interface EditableLine {
  uid: number
  id: string | null
  quantite: string
}

// --- Parc de machines, plan, maintenance ---------------------------------------------------

type Schemas = components['schemas']

export type Zone = Schemas['ZoneOut']
export type ZoneWrite = Schemas['ZoneIn']
export type ZoneType = Zone['type']

export type Machine = Schemas['MachineOut']
export type MachineWrite = Schemas['MachineIn']
export type MachineCategory = Machine['categorie']
export type MachineMode = Machine['type_fonctionnement']
export type MachineState = Machine['etat_operationnel']

export type Programme = Schemas['ProgrammeMachine']
export type ProgrammeStep = Schemas['EtapeProgramme']

export type Plan = Schemas['PlanOut']
export type PlanMachine = Schemas['PlanMachine']

export type Maintenance = Schemas['MaintenanceOut']
export type MaintenanceWrite = Schemas['MaintenanceIn']
export type MaintenanceType = Maintenance['type']

export type HistoryEvent = Schemas['EvenementOut']
export type HistoryEventType = HistoryEvent['type']

/** Filtres de `GET /machines` (chacun est facultatif). */
export interface MachineFilters {
  categorie?: MachineCategory
  etat?: MachineState
  actif?: boolean
}

// --- Commandes, affectation, caisse, clients, rapports, tableau de bord ---------------------------

export type Commande = Schemas['PressingCommandeOut']
export type CommandeStatut = Commande['statut']
export type CommandeEtape = NonNullable<Commande['etape']>
export type CommandeLigne = Schemas['LigneOut']
export type CommandeMachine = Schemas['PressingCommandeMachineOut']
export type CommandeListe = Schemas['PressingCommandeListe']
export type CommandeWrite = Schemas['PressingCommandeCreate']
export type CommandeUpdate = Schemas['PressingCommandeUpdate']

export type Recommandation = Schemas['PressingRecommandationOut']
export type OptionAffectation = Schemas['PressingOptionAffectationOut']
export type MachineProposee = Schemas['PressingMachineProposeeOut']
export type AffectationWrite = Schemas['PressingAffectationIn']
export type MachineAction = Schemas['PressingMachineActionOut']

export type Paiement = Schemas['PressingPaiementOut']
export type PaiementWrite = Schemas['PressingPaiementIn']
export type PaiementMode = PaiementWrite['mode']

export type JournalCaisse = Schemas['JournalCaisseOut']
export type JournalPaiement = Schemas['PressingPaiementJournalOut']
export type Cloture = Schemas['PressingClotureOut']

export type Client = Schemas['PressingClientOut']

export type TableauDeBord = Schemas['PressingTableauDeBordOut']
export type Occupation = Schemas['OccupationOut']
export type Alerte = Schemas['AlerteOut']

export type Rapport = Schemas['PressingRapportOut']

// --- Caisse, clients, rapports : écrans de consultation ---------------------------------------

export type ParMode = Schemas['ParMode']
export type CaJour = Schemas['CaJourOut']
export type CaParService = Schemas['CaParService']
export type RapportMachine = Schemas['PressingRapportMachineOut']

/**
 * Ligne du journal avec les champs d'annulation que le serveur ajoute (facultatifs tant qu'ils ne
 * sont pas dans le contrat). Une contre-passation a un montant négatif et `annule_paiement_id` ;
 * le paiement d'origine garde son montant et reçoit `annule_le` et `motif_annulation`.
 */
export type JournalPaiementVue = JournalPaiement & {
  annule_paiement_id?: string | null
  annule_le?: string | null
  annule_par?: string | null
  motif_annulation?: string | null
}

/**
 * Journal tel que l'écran de caisse le lit : `encaisse_apres_cloture` (net des paiements reçus
 * après la clôture du jour) reste facultatif, l'écran fonctionne sans lui.
 */
export type JournalCaisseVue = Omit<JournalCaisse, 'paiements'> & {
  paiements: JournalPaiementVue[]
  encaisse_apres_cloture?: number | null
}

/** Pagination par le serveur (`skip` / `limit`) de `GET /clients`. */
export interface ClientQuery {
  q?: string
  skip?: number
  limit?: number
}
