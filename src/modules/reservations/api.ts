import type {
  Availability,
  ClientMatch,
  ClientSummary,
  Reservation,
  ReservationCreate,
  ReservationFilters,
  ReservationUpdate,
  Table,
  WaitlistCreate,
  WaitlistEntry,
} from './types'
import { container } from '@/container'
import type { RestaurantResponse } from '@/lib/api/types'
import type { HttpClient } from '@/lib/http/HttpClient'

const BASE = '/v1/reservations'

/** Taille maximale d'une page côté serveur. */
const PAGE = 500

/** `force=true` n'est envoyé que sur une action explicitement forcée par la gestion. */
const forceQuery = (force: boolean | undefined) => (force ? { force: true } : undefined)

/** Réservations, disponibilités, clients, liste d'attente et lecture des tables. */
export class ReservationsApi {
  constructor(private readonly http: HttpClient) {}

  /** Parcourt toutes les pages d'une liste. */
  private async all<T>(path: string, query: Record<string, string | Date | undefined>, signal?: AbortSignal): Promise<T[]> {
    const items: T[] = []

    for (let skip = 0; ; skip += PAGE) {
      const page = await this.http.get<T[]>(path, { signal, query: { ...query, skip, limit: PAGE } })

      items.push(...page)
      if (page.length < PAGE)
        return items
    }
  }

  // Réservations ---------------------------------------------------------------------

  list(restaurantId: string, filters: ReservationFilters = {}, signal?: AbortSignal) {
    return this.all<Reservation>(`${BASE}/restaurants/${restaurantId}/reservations`, {
      date_from: filters.from,
      date_to: filters.to,
      status: filters.status,
      search: filters.search,
    }, signal)
  }

  get(reservationId: string, signal?: AbortSignal) {
    return this.http.get<Reservation>(`${BASE}/${reservationId}`, { signal })
  }

  create(restaurantId: string, body: ReservationCreate, force?: boolean) {
    return this.http.post<Reservation>(`${BASE}/restaurants/${restaurantId}/reservations`, body, { query: forceQuery(force) })
  }

  update(reservationId: string, body: ReservationUpdate, force?: boolean) {
    return this.http.put<Reservation>(`${BASE}/${reservationId}`, body, { query: forceQuery(force) })
  }

  remove(reservationId: string, reason?: string) {
    return this.http.delete<void>(`${BASE}/${reservationId}`, { query: { reason } })
  }

  confirm(reservationId: string, notes?: string) {
    return this.http.post<Reservation>(`${BASE}/${reservationId}/confirm`, { notes })
  }

  checkIn(reservationId: string) {
    return this.http.post<Reservation>(`${BASE}/${reservationId}/check-in`)
  }

  noShow(reservationId: string) {
    return this.http.post<Reservation>(`${BASE}/${reservationId}/no-show`)
  }

  complete(reservationId: string) {
    return this.http.post<Reservation>(`${BASE}/${reservationId}/complete`)
  }

  cancel(reservationId: string, reason: string) {
    return this.http.post<Reservation>(`${BASE}/${reservationId}/cancel`, { reason })
  }

  // Disponibilité et clients ----------------------------------------------------------

  availability(restaurantId: string, date: string, partySize: number, duration: number, signal?: AbortSignal) {
    return this.http.get<Availability>(`${BASE}/restaurants/${restaurantId}/availability`, {
      signal,
      query: { date, party_size: partySize, duration },
    })
  }

  searchCustomers(restaurantId: string, term: string, signal?: AbortSignal) {
    return this.http.get<ClientMatch[]>(`${BASE}/restaurants/${restaurantId}/customers/search`, { signal, query: { q: term } })
  }

  customerSummary(restaurantId: string, customerId: string, signal?: AbortSignal) {
    return this.http.get<ClientSummary>(`${BASE}/restaurants/${restaurantId}/customers/${customerId}/summary`, { signal })
  }

  // Liste d'attente ------------------------------------------------------------------

  waitlist(restaurantId: string, status?: string, signal?: AbortSignal) {
    return this.all<WaitlistEntry>(`${BASE}/restaurants/${restaurantId}/waitlist`, { status }, signal)
  }

  addToWaitlist(restaurantId: string, body: WaitlistCreate) {
    return this.http.post<WaitlistEntry>(`${BASE}/restaurants/${restaurantId}/waitlist`, body)
  }

  seat(waitlistId: string, tableId: string, force?: boolean) {
    return this.http.post<WaitlistEntry>(`${BASE}/waitlist/${waitlistId}/seat`, undefined, {
      query: { table_id: tableId, ...forceQuery(force) },
    })
  }

  notify(waitlistId: string) {
    return this.http.post<{ envoye: boolean; destinataire: string }>(`${BASE}/waitlist/${waitlistId}/notify`)
  }

  removeFromWaitlist(waitlistId: string, reason?: string) {
    return this.http.delete<void>(`${BASE}/waitlist/${waitlistId}`, { query: { reason } })
  }

  /** Le restaurant courant : son fuseau IANA règle l'affichage et la saisie des créneaux. */
  restaurant(restaurantId: string, signal?: AbortSignal) {
    return this.http.get<RestaurantResponse>(`/v1/restaurants/${restaurantId}`, { signal })
  }

  // Tables (lecture seule) -----------------------------------------------------------

  tables(restaurantId: string, signal?: AbortSignal) {
    return this.all<Table>(`/v1/restaurants/${restaurantId}/tables`, {}, signal)
  }
}

export const reservationsApi = new ReservationsApi(container.http)
