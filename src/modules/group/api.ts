import type { GroupReporting, RestaurantPayments } from './types'
import { container } from '@/container'
import type { HttpClient } from '@/lib/http/HttpClient'

/** Reporting du propriétaire de plusieurs restaurants. */
export class GroupApi {
  constructor(private readonly http: HttpClient) {}

  /** Chiffres cumulés de tous ses restaurants : la route ne dépend d'aucun restaurant courant. */
  reporting(signal?: AbortSignal) {
    return this.http.get<GroupReporting>('/v1/ros/group/reporting', { signal, withoutTenant: true })
  }

  /** Encaissements Mobile Money d'UN restaurant donné, indépendamment du restaurant courant. */
  payments(restaurantId: string, signal?: AbortSignal) {
    return this.http.get<RestaurantPayments>('/v1/payments/easytransact/transactions/summary', {
      signal,
      headers: { 'X-Tenant-ID': restaurantId },
    })
  }
}

export const groupApi = new GroupApi(container.http)
