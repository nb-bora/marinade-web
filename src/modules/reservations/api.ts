import type {
  Reservation,
  ReservationCreate,
  ReservationFilters,
  ReservationUpdate,
  Table,
  WaitlistCreate,
  WaitlistEntry,
} from './types'
import { container } from '@/container'
import type { HttpClient } from '@/lib/http/HttpClient'

const BASE = '/v1/reservations'

/** Taille maximale d'une page côté serveur. */
const PAGE = 500

/** Réservations, liste d'attente et lecture des tables (en-tête `X-Tenant-ID`). */
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

  create(restaurantId: string, body: ReservationCreate) {
    return this.http.post<Reservation>(`${BASE}/restaurants/${restaurantId}/reservations`, body)
  }

  update(reservationId: string, body: ReservationUpdate) {
    return this.http.put<Reservation>(`${BASE}/${reservationId}`, body)
  }

  remove(reservationId: string) {
    return this.http.delete<void>(`${BASE}/${reservationId}`)
  }

  confirm(reservationId: string) {
    return this.http.post<Reservation>(`${BASE}/${reservationId}/confirm`)
  }

  checkIn(reservationId: string) {
    return this.http.post<Reservation>(`${BASE}/${reservationId}/check-in`)
  }

  cancel(reservationId: string, reason: string) {
    return this.http.post<Reservation>(`${BASE}/${reservationId}/cancel`, { reason })
  }

  // Liste d'attente ------------------------------------------------------------------

  waitlist(restaurantId: string, signal?: AbortSignal) {
    return this.all<WaitlistEntry>(`${BASE}/restaurants/${restaurantId}/waitlist`, {}, signal)
  }

  addToWaitlist(restaurantId: string, body: WaitlistCreate) {
    return this.http.post<WaitlistEntry>(`${BASE}/restaurants/${restaurantId}/waitlist`, body)
  }

  seat(waitlistId: string, tableId?: string) {
    return this.http.post<WaitlistEntry>(`${BASE}/waitlist/${waitlistId}/seat`, undefined, { query: { table_id: tableId } })
  }

  removeFromWaitlist(waitlistId: string, reason?: string) {
    return this.http.delete<void>(`${BASE}/waitlist/${waitlistId}`, { query: { reason } })
  }

  // Tables (lecture seule) -----------------------------------------------------------

  tables(restaurantId: string, signal?: AbortSignal) {
    return this.all<Table>(`/v1/restaurants/${restaurantId}/tables`, {}, signal)
  }

  freeTables(restaurantId: string, signal?: AbortSignal) {
    return this.all<Table>(`/v1/restaurants/${restaurantId}/tables/free`, {}, signal)
  }
}

export const reservationsApi = new ReservationsApi(container.http)
