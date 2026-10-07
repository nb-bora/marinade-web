import type { RestaurantAccess, RestaurantCreate, RestaurantResponse, UserResponse } from '@/lib/api/types'
import type { HttpClient } from '@/lib/http/HttpClient'

/**
 * Qui suis-je, et où ai-je accès ? Ces routes ne dépendent d'aucun restaurant donné : on
 * n'envoie donc pas `X-Tenant-ID` (un identifiant périmé ferait répondre 404 à tort).
 */
export class AccountApi {
  constructor(private readonly http: HttpClient) {}

  me() {
    return this.http.get<UserResponse>('/v1/users/me', { withoutTenant: true })
  }

  /** Restaurants accessibles, avec les capacités de l'utilisateur dans chacun. */
  access(options: { q?: string; limit?: number } = {}) {
    return this.http.get<RestaurantAccess[]>('/v1/users/me/access', {
      withoutTenant: true,
      query: { q: options.q, limit: options.limit },
    })
  }

  createRestaurant(input: RestaurantCreate) {
    return this.http.post<RestaurantResponse>('/v1/restaurants', input, { withoutTenant: true })
  }
}
