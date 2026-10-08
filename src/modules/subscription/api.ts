import type {
  DailyBalance,
  Subscription,
  SubscriptionTransaction,
  SubscriptionTransactionCreate,
  Tier,
} from './types'
import { container } from '@/container'
import { isApiError } from '@/lib/http/errors'
import type { HttpClient } from '@/lib/http/HttpClient'

/** Taille des pages demandées pour les transactions (le back ne les borne pas). */
const PAGE = 500

/** On ne lit jamais plus de transactions que cela pour un écran : au-delà, l'historique est tronqué. */
export const TRANSACTION_CAP = 5000

/** Une réponse « introuvable » est ici un résultat normal, pas une erreur. */
async function orNull<T>(request: Promise<T>): Promise<T | null> {
  try {
    return await request
  }
  catch (cause) {
    if (isApiError(cause) && cause.kind === 'not_found')
      return null

    throw cause
  }
}

/** Abonnement du restaurant : offres, soldes quotidiens et transactions qui les consomment. */
export class SubscriptionApi {
  constructor(private readonly http: HttpClient) {}

  // Abonnement et offres ------------------------------------------------------------------

  /**
   * Abonnement actif du compte connecté. `null` s'il n'en a aucun.
   * Le back ne filtre pas par restaurant : le restaurant de la réponse est à vérifier.
   */
  me(signal?: AbortSignal) {
    return orNull(this.http.get<Subscription>('/v1/subscriptions/me', { signal }))
  }

  /** Réservé aux administrateurs de la plateforme (403 pour un restaurant) : non utilisé à l'écran. */
  byId(subscriptionId: string, signal?: AbortSignal) {
    return this.http.get<Subscription>(`/v1/subscriptions/${subscriptionId}`, { signal })
  }

  /** Offres actives. Route publique. */
  tiers(signal?: AbortSignal) {
    return this.http.get<Tier[]>('/v1/subscriptions/tiers', { signal, withoutTenant: true })
  }

  // Soldes quotidiens ---------------------------------------------------------------------

  /** Le back ne trie pas et plafonne à 100 lignes : le tri se fait ici. */
  balances(subscriptionId: string, signal?: AbortSignal) {
    return this.http.get<DailyBalance[]>(`/v1/subscriptions/${subscriptionId}/balances`, { signal })
  }

  /** Solde d'aujourd'hui ; `null` si aucun n'est encore ouvert pour la journée. */
  currentBalance(subscriptionId: string, signal?: AbortSignal) {
    return orNull(this.http.get<DailyBalance>(`/v1/subscriptions/${subscriptionId}/balances/current`, { signal }))
  }

  // Transactions --------------------------------------------------------------------------

  /** Transactions du compte connecté sur le restaurant courant. */
  mine(skip = 0, limit = PAGE, signal?: AbortSignal) {
    return this.http.get<SubscriptionTransaction[]>('/v1/transactions/my', { signal, query: { skip, limit } })
  }

  transaction(transactionId: string, signal?: AbortSignal) {
    return this.http.get<SubscriptionTransaction>(`/v1/transactions/${transactionId}`, { signal })
  }

  /**
   * Toutes les transactions de l'abonnement, les plus récentes d'abord.
   * Le back les renvoie sans ordre garanti, d'où la lecture complète puis le tri.
   */
  async ofSubscription(subscriptionId: string, signal?: AbortSignal): Promise<SubscriptionTransaction[]> {
    const rows: SubscriptionTransaction[] = []

    for (let skip = 0; skip < TRANSACTION_CAP; skip += PAGE) {
      const page = await this.http.get<SubscriptionTransaction[]>(
        `/v1/transactions/subscription/${subscriptionId}`,
        { signal, query: { skip, limit: PAGE } },
      )

      rows.push(...page)
      if (page.length < PAGE)
        break
    }

    return rows.sort((a, b) => b.created_at.localeCompare(a.created_at))
  }

  /** Recherche par identifiant du terminal de paiement, dans le restaurant courant. `null` si inconnu. */
  byPosId(posTransactionId: string, signal?: AbortSignal) {
    return orNull(this.http.get<SubscriptionTransaction>(
      `/v1/transactions/pos/${encodeURIComponent(posTransactionId)}`,
      { signal },
    ))
  }

  /** Imputer un achat sur le plafond du jour. Rejouer la même clé d'idempotence ne débite jamais deux fois. */
  record(body: SubscriptionTransactionCreate) {
    return this.http.post<SubscriptionTransaction>('/v1/transactions', body)
  }
}

export const subscriptionApi = new SubscriptionApi(container.http)
