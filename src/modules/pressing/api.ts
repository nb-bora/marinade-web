import type {
  AffectationWrite,
  Article,
  ArticleWrite,
  Calcul,
  CalculRequest,
  Client,
  ClientQuery,
  Cloture,
  Combinaison,
  CombinaisonWrite,
  Commande,
  CommandeListe,
  CommandeStatut,
  CommandeUpdate,
  CommandeWrite,
  HistoryEvent,
  JournalCaisse,
  JournalCaisseVue,
  Machine,
  MachineAction,
  MachineFilters,
  MachineState,
  MachineWrite,
  Maintenance,
  MaintenanceWrite,
  Paiement,
  PaiementWrite,
  Plan,
  Rapport,
  Recommandation,
  TableauDeBord,
  Tarifs,
  TarifsUpdate,
  Zone,
  ZoneWrite,
} from './types'
import { container } from '@/container'
import type { HttpClient } from '@/lib/http/HttpClient'

const BASE = '/v1/restaurants'

/** Tarifs, articles, combinaisons et calcul de la pesée d'un pressing (en-tête `X-Tenant-ID`). */
export class PressingApi {
  constructor(private readonly http: HttpClient) {}

  private root(restaurantId: string) {
    return `${BASE}/${restaurantId}/pressing`
  }

  tarifs(restaurantId: string, signal?: AbortSignal) {
    return this.http.get<Tarifs>(`${this.root(restaurantId)}/tarifs`, { signal })
  }

  updateTarifs(restaurantId: string, body: TarifsUpdate) {
    return this.http.put<Tarifs>(`${this.root(restaurantId)}/tarifs`, body)
  }

  /** Sans `actif`, le serveur renvoie les articles actifs et inactifs. */
  articles(restaurantId: string, actif?: boolean, signal?: AbortSignal) {
    return this.http.get<Article[]>(`${this.root(restaurantId)}/articles`, { signal, query: { actif } })
  }

  createArticle(restaurantId: string, body: ArticleWrite) {
    return this.http.post<Article>(`${this.root(restaurantId)}/articles`, body)
  }

  updateArticle(restaurantId: string, id: string, body: ArticleWrite) {
    return this.http.put<Article>(`${this.root(restaurantId)}/articles/${id}`, body)
  }

  /** Désactive l'article (il n'est jamais supprimé). */
  deactivateArticle(restaurantId: string, id: string) {
    return this.http.delete<void>(`${this.root(restaurantId)}/articles/${id}`)
  }

  combinaisons(restaurantId: string, signal?: AbortSignal) {
    return this.http.get<Combinaison[]>(`${this.root(restaurantId)}/combinaisons`, { signal })
  }

  createCombinaison(restaurantId: string, body: CombinaisonWrite) {
    return this.http.post<Combinaison>(`${this.root(restaurantId)}/combinaisons`, body)
  }

  updateCombinaison(restaurantId: string, id: string, body: CombinaisonWrite) {
    return this.http.put<Combinaison>(`${this.root(restaurantId)}/combinaisons/${id}`, body)
  }

  deactivateCombinaison(restaurantId: string, id: string) {
    return this.http.delete<void>(`${this.root(restaurantId)}/combinaisons/${id}`)
  }

  // --- Plan, zones --------------------------------------------------------------------------

  plan(restaurantId: string, includeInactive = false, signal?: AbortSignal) {
    return this.http.get<Plan>(`${this.root(restaurantId)}/plan`, {
      signal,
      query: { inclure_inactives: includeInactive || undefined },
    })
  }

  zones(restaurantId: string, signal?: AbortSignal) {
    return this.http.get<Zone[]>(`${this.root(restaurantId)}/zones`, { signal })
  }

  createZone(restaurantId: string, body: ZoneWrite) {
    return this.http.post<Zone>(`${this.root(restaurantId)}/zones`, body)
  }

  updateZone(restaurantId: string, id: string, body: ZoneWrite) {
    return this.http.put<Zone>(`${this.root(restaurantId)}/zones/${id}`, body)
  }

  /** Refusée (409) tant que des machines sont rattachées à la zone. */
  deleteZone(restaurantId: string, id: string) {
    return this.http.delete<void>(`${this.root(restaurantId)}/zones/${id}`)
  }

  // --- Machines -----------------------------------------------------------------------------

  machines(restaurantId: string, filters: MachineFilters = {}, signal?: AbortSignal) {
    return this.http.get<Machine[]>(`${this.root(restaurantId)}/machines`, { signal, query: { ...filters } })
  }

  machine(restaurantId: string, id: string, signal?: AbortSignal) {
    return this.http.get<Machine>(`${this.root(restaurantId)}/machines/${id}`, { signal })
  }

  createMachine(restaurantId: string, body: MachineWrite) {
    return this.http.post<Machine>(`${this.root(restaurantId)}/machines`, body)
  }

  /** Remplace les champs de saisie (jamais l'état opérationnel). */
  updateMachine(restaurantId: string, id: string, body: MachineWrite) {
    return this.http.put<Machine>(`${this.root(restaurantId)}/machines/${id}`, body)
  }

  /** Désactive la machine (refusée si elle est réservée ou en cycle). */
  deactivateMachine(restaurantId: string, id: string) {
    return this.http.delete<void>(`${this.root(restaurantId)}/machines/${id}`)
  }

  changeState(restaurantId: string, id: string, etat: MachineState, motif?: string) {
    return this.http.post<Machine>(`${this.root(restaurantId)}/machines/${id}/etat`, { etat, motif: motif || undefined })
  }

  history(restaurantId: string, id: string, options: { skip?: number; limit?: number } = {}, signal?: AbortSignal) {
    return this.http.get<HistoryEvent[]>(`${this.root(restaurantId)}/machines/${id}/historique`, { signal, query: { ...options } })
  }

  /** Le texte de la note part dans le champ `motif` (contrat du serveur). */
  addNote(restaurantId: string, id: string, text: string) {
    return this.http.post<HistoryEvent>(`${this.root(restaurantId)}/machines/${id}/historique`, { motif: text })
  }

  maintenances(restaurantId: string, id: string, signal?: AbortSignal) {
    return this.http.get<Maintenance[]>(`${this.root(restaurantId)}/machines/${id}/maintenances`, { signal, query: { limit: 50 } })
  }

  declareMaintenance(restaurantId: string, id: string, body: MaintenanceWrite) {
    return this.http.post<Maintenance>(`${this.root(restaurantId)}/machines/${id}/maintenances`, body)
  }

  closeMaintenance(restaurantId: string, maintenanceId: string) {
    return this.http.post<Maintenance>(`${this.root(restaurantId)}/machines/maintenances/${maintenanceId}/cloture`, {})
  }

  calcul(restaurantId: string, body: CalculRequest, signal?: AbortSignal) {
    return this.http.post<Calcul>(`${this.root(restaurantId)}/calcul`, body, { signal })
  }

  // --- Tableau de bord, rapports -------------------------------------------------------------

  tableauDeBord(restaurantId: string, signal?: AbortSignal) {
    return this.http.get<TableauDeBord>(`${this.root(restaurantId)}/tableau-de-bord`, { signal })
  }

  /** `du` et `au` au format AAAA-MM-JJ, inclus ; 366 jours au plus. */
  rapports(restaurantId: string, du: string, au: string, signal?: AbortSignal) {
    return this.http.get<Rapport>(`${this.root(restaurantId)}/rapports`, { signal, query: { du, au, granularite: 'jour' } })
  }

  // --- Commandes -----------------------------------------------------------------------------

  commandes(restaurantId: string, query: { statut?: CommandeStatut; q?: string; skip?: number; limit?: number } = {}, signal?: AbortSignal) {
    return this.http.get<CommandeListe>(`${this.root(restaurantId)}/commandes`, { signal, query: { ...query, q: query.q || undefined } })
  }

  commande(restaurantId: string, id: string, signal?: AbortSignal) {
    return this.http.get<Commande>(`${this.root(restaurantId)}/commandes/${id}`, { signal })
  }

  createCommande(restaurantId: string, body: CommandeWrite) {
    return this.http.post<Commande>(`${this.root(restaurantId)}/commandes`, body)
  }

  /** Remplace le contenu d'une commande encore « reçue ». */
  updateCommande(restaurantId: string, id: string, body: CommandeUpdate) {
    return this.http.put<Commande>(`${this.root(restaurantId)}/commandes/${id}`, body)
  }

  /** Réservée à `management`. */
  cancelCommande(restaurantId: string, id: string, motif: string) {
    return this.http.post<Commande>(`${this.root(restaurantId)}/commandes/${id}/annuler`, { motif })
  }

  /** Commande sans machine (articles seuls). */
  markReady(restaurantId: string, id: string) {
    return this.http.post<Commande>(`${this.root(restaurantId)}/commandes/${id}/pret`, {})
  }

  /** `forcer` (management) livre malgré un reste à payer. */
  deliver(restaurantId: string, id: string, forcer = false) {
    return this.http.post<Commande>(`${this.root(restaurantId)}/commandes/${id}/livrer`, {}, { query: { forcer: forcer || undefined } })
  }

  // --- Affectation et cycles -----------------------------------------------------------------

  recommandation(restaurantId: string, id: string, signal?: AbortSignal) {
    return this.http.post<Recommandation>(`${this.root(restaurantId)}/commandes/${id}/recommandation`, {}, { signal })
  }

  affecter(restaurantId: string, id: string, body: AffectationWrite) {
    return this.http.post<Commande>(`${this.root(restaurantId)}/commandes/${id}/affectation`, body)
  }

  startCycle(restaurantId: string, machineId: string, commandeId: string, programme: string) {
    return this.http.post<MachineAction>(`${this.root(restaurantId)}/machines/${machineId}/demarrer`, { commande_id: commandeId, programme })
  }

  finishCycle(restaurantId: string, machineId: string) {
    return this.http.post<MachineAction>(`${this.root(restaurantId)}/machines/${machineId}/terminer`, {})
  }

  /** Deux appels successifs : « cycle terminé » vers « à décharger », puis vers « libre ». */
  unload(restaurantId: string, machineId: string) {
    return this.http.post<MachineAction>(`${this.root(restaurantId)}/machines/${machineId}/decharger`, {})
  }

  /** Panne ou interruption d'un cycle en cours, motif obligatoire (`en_cycle` -> `cycle_termine`). */
  interrompre(restaurantId: string, machineId: string, motif: string) {
    return this.http.post<MachineAction>(`${this.root(restaurantId)}/machines/${machineId}/interrompre`, { motif })
  }

  // --- Paiements, caisse, clients ------------------------------------------------------------

  paiements(restaurantId: string, commandeId: string, signal?: AbortSignal) {
    return this.http.get<Paiement[]>(`${this.root(restaurantId)}/commandes/${commandeId}/paiements`, { signal })
  }

  pay(restaurantId: string, commandeId: string, body: PaiementWrite) {
    return this.http.post<Paiement>(`${this.root(restaurantId)}/commandes/${commandeId}/paiements`, body)
  }

  journal(restaurantId: string, date: string, signal?: AbortSignal) {
    return this.http.get<JournalCaisse>(`${this.root(restaurantId)}/caisse/journal`, { signal, query: { date } })
  }

  /** Réservée à `management` ; une seule clôture par jour. */
  closeCash(restaurantId: string, date: string, montantCompte: number) {
    return this.http.post<Cloture>(`${this.root(restaurantId)}/caisse/clotures`, { date, montant_compte: montantCompte })
  }

  clients(restaurantId: string, q?: string, signal?: AbortSignal) {
    return this.http.get<Client[]>(`${this.root(restaurantId)}/clients`, { signal, query: { q: q || undefined, limit: 500 } })
  }

  /** Une page de clients (du plus récent au plus ancien) ; le serveur ne renvoie pas de total. */
  clientsPage(restaurantId: string, query: ClientQuery = {}, signal?: AbortSignal) {
    return this.http.get<Client[]>(`${this.root(restaurantId)}/clients`, { signal, query: { ...query, q: query.q?.trim() || undefined } })
  }

  /** Journal d'un jour, lu avec les champs que le serveur ajoute (facultatifs). */
  journalDuJour(restaurantId: string, date: string, signal?: AbortSignal) {
    return this.http.get<JournalCaisseVue>(`${this.root(restaurantId)}/caisse/journal`, { signal, query: { date } })
  }
}

export const pressingApi = new PressingApi(container.http)
