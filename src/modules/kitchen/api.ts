import type { Station, Ticket, TicketStatus } from './types'
import { container } from '@/container'
import type { HttpClient } from '@/lib/http/HttpClient'

const BASE = '/v1/ros/restaurants'

/** Taille maximale d'une page côté serveur. */
const PAGE = 200

/** Les tickets de production d'un restaurant (en-tête `X-Tenant-ID`). */
export class KitchenApi {
  constructor(private readonly http: HttpClient) {}

  /**
   * Tickets d'un poste. Le serveur ne renvoie que ceux « en attente » ou « en préparation »,
   * du plus ancien au plus récent. On parcourt les pages : un service chargé en compte plusieurs.
   */
  async pending(restaurantId: string, station: Station, signal?: AbortSignal): Promise<Ticket[]> {
    const items: Ticket[] = []

    for (let skip = 0; ; skip += PAGE) {
      const page = await this.http.get<Ticket[]>(`${BASE}/${restaurantId}/tickets/${station}`, {
        signal,
        query: { skip, limit: PAGE },
      })

      items.push(...page)
      if (page.length < PAGE)
        return items
    }
  }

  setStatus(restaurantId: string, ticketId: string, status: TicketStatus) {
    return this.http.put<Ticket>(`${BASE}/${restaurantId}/tickets/${ticketId}/status`, { status })
  }
}

export const kitchenApi = new KitchenApi(container.http)
