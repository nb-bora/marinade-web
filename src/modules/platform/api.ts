import type {
  DailyBalance,
  DailyBalanceCreate,
  OperatorPrefix,
  OperatorPrefixCreate,
  OperatorPrefixUpdate,
  PlatformRestaurant,
  PlatformUser,
  PlatformUserCreate,
  PlatformUserUpdate,
  Subscription,
  SubscriptionCreate,
  SubscriptionStatus,
  Tier,
  TierCreate,
  TierUpdate,
} from './types'
import { container } from '@/container'
import type { HttpClient } from '@/lib/http/HttpClient'
import type { RestaurantAccess } from '@/lib/api/types'

/** Taille d'une page demandée au serveur (les listes de la plateforme n'ont ni filtre ni total). */
const PAGE = 200

/** Aucune de ces routes ne dépend d'un restaurant : on n'envoie jamais `X-Tenant-ID`. */
const PLATFORM = { withoutTenant: true } as const

/** Administration de la plateforme : utilisateurs, offres, abonnements, préfixes d'opérateurs. */
export class PlatformApi {
  constructor(private readonly http: HttpClient) {}

  // Utilisateurs
  /** Lit toutes les pages (`skip` / `limit`) : le serveur ne sait ni filtrer ni compter. */
  async users(signal?: AbortSignal): Promise<PlatformUser[]> {
    const items: PlatformUser[] = []

    for (let skip = 0; ; skip += PAGE) {
      const page = await this.http.get<PlatformUser[]>('/v1/users', { ...PLATFORM, signal, query: { skip, limit: PAGE } })

      items.push(...page)
      if (page.length < PAGE)
        return items
    }
  }

  createUser(body: PlatformUserCreate) {
    return this.http.post<PlatformUser>('/v1/users', body, PLATFORM)
  }

  user(userId: string, signal?: AbortSignal) {
    return this.http.get<PlatformUser>(`/v1/users/${userId}`, { ...PLATFORM, signal })
  }

  updateUser(userId: string, body: PlatformUserUpdate) {
    return this.http.put<PlatformUser>(`/v1/users/${userId}`, body, PLATFORM)
  }

  deleteUser(userId: string) {
    return this.http.delete<void>(`/v1/users/${userId}`, PLATFORM)
  }

  // Offres
  tiers(signal?: AbortSignal) {
    return this.http.get<Tier[]>('/v1/subscriptions/tiers', { ...PLATFORM, signal })
  }

  createTier(body: TierCreate) {
    return this.http.post<Tier>('/v1/subscriptions/tiers', body, PLATFORM)
  }

  updateTier(tierId: number, body: TierUpdate) {
    return this.http.put<Tier>(`/v1/subscriptions/tiers/${tierId}`, body, PLATFORM)
  }

  // Abonnements
  subscription(subscriptionId: string, signal?: AbortSignal) {
    return this.http.get<Subscription>(`/v1/subscriptions/${subscriptionId}`, { ...PLATFORM, signal })
  }

  createSubscription(body: SubscriptionCreate) {
    return this.http.post<Subscription>('/v1/subscriptions', body, PLATFORM)
  }

  setSubscriptionStatus(subscriptionId: string, status: SubscriptionStatus) {
    return this.http.put<Subscription>(`/v1/subscriptions/${subscriptionId}/status`, undefined, { ...PLATFORM, query: { status } })
  }

  balances(subscriptionId: string, signal?: AbortSignal) {
    return this.http.get<DailyBalance[]>(`/v1/subscriptions/${subscriptionId}/balances`, { ...PLATFORM, signal })
  }

  createBalance(subscriptionId: string, body: DailyBalanceCreate) {
    return this.http.post<DailyBalance>(`/v1/subscriptions/${subscriptionId}/balances`, body, PLATFORM)
  }

  resetBalance(subscriptionId: string) {
    return this.http.post<DailyBalance>(`/v1/subscriptions/${subscriptionId}/reset`, undefined, PLATFORM)
  }

  // Restaurants
  /** Tous les restaurants pour un administrateur de la plateforme, filtrés par nom. */
  restaurants(q: string, signal?: AbortSignal) {
    return this.http.get<RestaurantAccess[]>('/v1/users/me/access', { ...PLATFORM, signal, query: { q: q.trim() || undefined, limit: 50 } })
  }

  /** Fiche d'un restaurant : donne son propriétaire (`user_id`), nécessaire à un abonnement. */
  restaurant(restaurantId: string, signal?: AbortSignal) {
    return this.http.get<PlatformRestaurant>(`/v1/restaurants/${restaurantId}`, { ...PLATFORM, signal })
  }

  // Préfixes des opérateurs mobiles
  prefixes(signal?: AbortSignal) {
    return this.http.get<OperatorPrefix[]>('/v1/admin/mobile-operator-prefixes', { ...PLATFORM, signal })
  }

  createPrefix(body: OperatorPrefixCreate) {
    return this.http.post<OperatorPrefix>('/v1/admin/mobile-operator-prefixes', body, PLATFORM)
  }

  updatePrefix(prefixId: string, body: OperatorPrefixUpdate) {
    return this.http.patch<OperatorPrefix>(`/v1/admin/mobile-operator-prefixes/${prefixId}`, body, PLATFORM)
  }
}

export const platformApi = new PlatformApi(container.http)
