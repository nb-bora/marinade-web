import type {
  Boisson,
  Customer,
  CustomerCreate,
  Invoice,
  Menu,
  MenuCategory,
  Order,
  OrderCreate,
  Plat,
  ServiceSession,
  SessionCreate,
  Table,
  TableCreate,
  TableUpdate,
} from './types'
import { container } from '@/container'
import { isApiError } from '@/lib/http/errors'
import type { HttpClient } from '@/lib/http/HttpClient'

/** Le back borne chaque page à 500 lignes. */
const PAGE = 500

/** Plan de salle, sessions de service et prise de commande (restaurant courant). */
export class FloorApi {
  constructor(private readonly http: HttpClient) {}

  /** Lit toutes les pages d'une liste : les tables et la carte tiennent en peu de requêtes. */
  private async all<T>(path: string, signal?: AbortSignal): Promise<T[]> {
    const rows: T[] = []

    for (let skip = 0; ; skip += PAGE) {
      const page = await this.http.get<T[]>(path, { signal, query: { skip, limit: PAGE } })

      rows.push(...page)
      if (page.length < PAGE)
        return rows
    }
  }

  // Tables --------------------------------------------------------------------------

  tables(restaurantId: string, signal?: AbortSignal) {
    return this.all<Table>(`/v1/restaurants/${restaurantId}/tables`, signal)
  }

  freeTables(restaurantId: string, signal?: AbortSignal) {
    return this.all<Table>(`/v1/restaurants/${restaurantId}/tables/free`, signal)
  }

  table(tableId: string, signal?: AbortSignal) {
    return this.http.get<Table>(`/v1/restaurants/tables/${tableId}`, { signal })
  }

  createTable(restaurantId: string, body: TableCreate) {
    return this.http.post<Table>(`/v1/restaurants/${restaurantId}/tables`, body)
  }

  updateTable(tableId: string, body: TableUpdate) {
    return this.http.put<Table>(`/v1/restaurants/tables/${tableId}`, body)
  }

  // Clients et sessions ------------------------------------------------------------------

  createCustomer(restaurantId: string, body: CustomerCreate) {
    return this.http.post<Customer>(`/v1/ros/restaurants/${restaurantId}/customers`, body)
  }

  openSession(restaurantId: string, body: SessionCreate) {
    return this.http.post<ServiceSession>(`/v1/ros/restaurants/${restaurantId}/sessions`, body)
  }

  /** Sessions encore ouvertes (ni soldées ni clôturées). */
  activeSessions(restaurantId: string, signal?: AbortSignal) {
    return this.all<ServiceSession>(`/v1/ros/restaurants/${restaurantId}/sessions`, signal)
  }

  closeSession(restaurantId: string, sessionId: string) {
    return this.http.post<ServiceSession>(`/v1/ros/restaurants/${restaurantId}/sessions/${sessionId}/close`)
  }

  /** Addition de la session ; `null` tant qu'aucune commande n'a créé de facture. */
  async sessionInvoice(restaurantId: string, sessionId: string, signal?: AbortSignal): Promise<Invoice | null> {
    try {
      return await this.http.get<Invoice>(`/v1/ros/restaurants/${restaurantId}/sessions/${sessionId}/invoice`, { signal })
    }
    catch (cause) {
      if (isApiError(cause) && cause.kind === 'not_found')
        return null

      throw cause
    }
  }

  // Commandes ------------------------------------------------------------------------

  createOrder(restaurantId: string, body: OrderCreate) {
    return this.http.post<Order>(`/v1/ros/restaurants/${restaurantId}/orders`, body)
  }

  // Carte ----------------------------------------------------------------------------

  plats(restaurantId: string, signal?: AbortSignal) {
    return this.all<Plat>(`/v1/restaurants/${restaurantId}/plats`, signal)
  }

  boissons(restaurantId: string, signal?: AbortSignal) {
    return this.all<Boisson>(`/v1/restaurants/${restaurantId}/boissons`, signal)
  }

  menus(restaurantId: string, signal?: AbortSignal) {
    return this.all<Menu>(`/v1/restaurants/${restaurantId}/menus`, signal)
  }

  menuCategories(menuId: string, signal?: AbortSignal) {
    return this.all<MenuCategory>(`/v1/restaurants/menus/${menuId}/categories`, signal)
  }
}

export const floorApi = new FloorApi(container.http)
