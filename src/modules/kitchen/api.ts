import type { Station, Ticket, TicketStatus } from './types'
import { container } from '@/container'
import type { HttpClient } from '@/lib/http/HttpClient'

const BASE = '/v1/ros/restaurants'

/** Les tickets de production d'un restaurant (en-tête `X-Tenant-ID`). */
export class KitchenApi {
  constructor(private readonly http: HttpClient) {}

  /**
   * Tickets affichés sur l'écran d'un poste : à faire, en préparation, prêts depuis peu, servis
   * encore rappelables. C'est la seule source de l'écran : chaque lecture le réconcilie.
   */
  board(restaurantId: string, station: Station, signal?: AbortSignal): Promise<Ticket[]> {
    return this.http.get<Ticket[]>(`${BASE}/${restaurantId}/tickets/${station}`, { signal })
  }

  setStatus(restaurantId: string, ticketId: string, status: TicketStatus): Promise<Ticket> {
    return this.http.put<Ticket>(`${BASE}/${restaurantId}/tickets/${ticketId}/status`, { status })
  }

  recall(restaurantId: string, ticketId: string): Promise<Ticket> {
    return this.http.post<Ticket>(`${BASE}/${restaurantId}/tickets/${ticketId}/recall`)
  }

  setPriority(restaurantId: string, ticketId: string, priority: 0 | 1): Promise<Ticket> {
    return this.http.put<Ticket>(`${BASE}/${restaurantId}/tickets/${ticketId}/priority`, { priority })
  }

  /** Annule les tickets encore à faire plus anciens que la fenêtre (gestion). */
  async expireStale(restaurantId: string): Promise<number> {
    const result = await this.http.post<{ cancelled: number }>(`${BASE}/${restaurantId}/tickets/expire`)

    return result.cancelled
  }
}

export const kitchenApi = new KitchenApi(container.http)
