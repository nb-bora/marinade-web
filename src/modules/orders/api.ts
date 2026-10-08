import type {
  Boisson,
  Commande,
  CommandeCreate,
  CommandeItem,
  CommandeItemCreate,
  CommandeUpdate,
  Plat,
  Refund,
  RefundCreate,
  Table,
} from './types'
import { container } from '@/container'
import type { HttpClient } from '@/lib/http/HttpClient'

/** Le back borne chaque page à 500 lignes. */
const PAGE = 500

/**
 * Commandes de l'ancien circuit (routes marquées DÉPRÉCIÉES côté serveur) et leurs
 * remboursements. Les nouvelles commandes passent par le moteur de salle.
 */
export class OrdersApi {
  constructor(private readonly http: HttpClient) {}

  private async all<T>(path: string, signal?: AbortSignal): Promise<T[]> {
    const rows: T[] = []

    for (let skip = 0; ; skip += PAGE) {
      const page = await this.http.get<T[]>(path, { signal, query: { skip, limit: PAGE } })

      rows.push(...page)
      if (page.length < PAGE)
        return rows
    }
  }

  private restaurant(restaurantId: string) {
    return `/v1/restaurants/${restaurantId}`
  }

  // Commandes -----------------------------------------------------------------------------

  /** Toutes les commandes du restaurant, les plus récentes d'abord. */
  list(restaurantId: string, signal?: AbortSignal) {
    return this.all<Commande>(`${this.restaurant(restaurantId)}/commandes`, signal)
  }

  /** Commandes en cours ou servies, les plus anciennes d'abord. */
  active(restaurantId: string, signal?: AbortSignal) {
    return this.all<Commande>(`${this.restaurant(restaurantId)}/commandes/active`, signal)
  }

  get(commandeId: string, signal?: AbortSignal) {
    return this.http.get<Commande>(`/v1/restaurants/commandes/${commandeId}`, { signal })
  }

  create(restaurantId: string, body: CommandeCreate) {
    return this.http.post<Commande>(`${this.restaurant(restaurantId)}/commandes`, body)
  }

  /** Le statut « payée » est refusé : seule la confirmation du prestataire de paiement le pose. */
  update(commandeId: string, body: CommandeUpdate) {
    return this.http.put<Commande>(`/v1/restaurants/commandes/${commandeId}`, body)
  }

  // Articles ------------------------------------------------------------------------------

  /** Les articles ne sont jamais dans la réponse d'une commande : il faut les demander. */
  items(commandeId: string, signal?: AbortSignal) {
    return this.http.get<CommandeItem[]>(`/v1/restaurants/commandes/${commandeId}/items`, { signal })
  }

  addItem(commandeId: string, body: CommandeItemCreate) {
    return this.http.post<CommandeItem>(`/v1/restaurants/commandes/${commandeId}/items`, body)
  }

  // Remboursements ------------------------------------------------------------------------

  refunds(commandeId: string, signal?: AbortSignal) {
    return this.http.get<Refund[]>(`/v1/restaurants/commandes/${commandeId}/refunds`, { signal })
  }

  requestRefund(commandeId: string, body: RefundCreate) {
    return this.http.post<Refund>(`/v1/restaurants/commandes/${commandeId}/refunds`, body)
  }

  approveRefund(commandeId: string, refundId: string) {
    return this.http.post<Refund>(`/v1/restaurants/commandes/${commandeId}/refunds/${refundId}/approve`)
  }

  /** Le motif du rejet voyage dans l'URL (paramètre de requête), pas dans le corps. */
  rejectRefund(commandeId: string, refundId: string, reason: string) {
    return this.http.post<Refund>(
      `/v1/restaurants/commandes/${commandeId}/refunds/${refundId}/reject`,
      undefined,
      { query: { reason } },
    )
  }

  // Références pour l'affichage -----------------------------------------------------------

  tables(restaurantId: string, signal?: AbortSignal) {
    return this.all<Table>(`${this.restaurant(restaurantId)}/tables`, signal)
  }

  freeTables(restaurantId: string, signal?: AbortSignal) {
    return this.all<Table>(`${this.restaurant(restaurantId)}/tables/free`, signal)
  }

  plats(restaurantId: string, signal?: AbortSignal) {
    return this.all<Plat>(`${this.restaurant(restaurantId)}/plats`, signal)
  }

  boissons(restaurantId: string, signal?: AbortSignal) {
    return this.all<Boisson>(`${this.restaurant(restaurantId)}/boissons`, signal)
  }
}

export const ordersApi = new OrdersApi(container.http)
