import { TRANSACTION_CAP, subscriptionApi } from '../api'
import type { SubscriptionOverview, SubscriptionTransaction } from '../types'
import { useAsyncData } from '@/composables/useAsyncData'
import { useClientPagination } from '@/composables/useClientPagination'
import { useTenantStore } from '@/stores/tenant.store'

/**
 * Abonnement du restaurant courant : offres, solde du jour et historique des soldes.
 *
 * `/subscriptions/me` rend l'abonnement ACTIF du restaurant courant (en-tête X-Tenant-ID), quel que
 * soit le compte qui l'a souscrit. Par prudence, on vérifie quand même qu'il appartient bien au
 * restaurant courant avant de l'afficher.
 */
export function useSubscription() {
  const tenant = useTenantStore()

  const overview = useAsyncData<SubscriptionOverview>(async signal => {
    const [tiers, mine] = await Promise.all([subscriptionApi.tiers(signal), subscriptionApi.me(signal)])
    const subscription = mine && mine.restaurant_id === tenant.currentId ? mine : null

    if (!subscription)
      return { tiers, subscription: null, balances: [], today: null }

    const [balances, today] = await Promise.all([
      subscriptionApi.balances(subscription.id, signal),
      subscriptionApi.currentBalance(subscription.id, signal),
    ])

    return {
      tiers,
      subscription,
      balances: [...balances].sort((a, b) => a.balance_date.localeCompare(b.balance_date)),
      today,
    }
  }, { watch: [() => tenant.currentId] })

  const subscription = computed(() => overview.data.value?.subscription ?? null)

  const tier = computed(() => overview.data.value?.tiers.find(item => item.id === subscription.value?.tier_id) ?? null)

  /** Plafond du jour : celui du solde ouvert, à défaut celui de l'offre. */
  const dailyLimit = computed(() => overview.data.value?.today?.initial_balance_fcfa ?? tier.value?.daily_limit_fcfa ?? null)

  const used = computed(() => overview.data.value?.today?.used_balance_fcfa ?? 0)
  const remaining = computed(() => (dailyLimit.value === null ? null : Math.max(0, dailyLimit.value - used.value)))
  const usedPercent = computed(() => (dailyLimit.value ? Math.min(100, Math.round((used.value / dailyLimit.value) * 100)) : 0))

  // Transactions ------------------------------------------------------------------------

  const transactions = useAsyncData<SubscriptionTransaction[]>(
    signal => subscription.value ? subscriptionApi.ofSubscription(subscription.value.id, signal) : Promise.resolve([]),
    { watch: [() => subscription.value?.id] },
  )

  const rows = computed(() => transactions.data.value ?? [])
  const pager = useClientPagination(rows, 10)

  /** Les lectures sont plafonnées : au-delà, les achats les plus anciens manquent à la liste. */
  const truncated = computed(() => rows.value.length >= TRANSACTION_CAP)

  /** Relecture complète sans clignotement : après un achat imputé. L'abonnement d'abord, ses transactions ensuite. */
  async function reload() {
    await overview.refresh()
    await transactions.refresh()
  }

  /** Bouton « Actualiser » : relit tout et montre l'état de chargement. */
  async function reloadAll() {
    await overview.reload()
    await transactions.reload()
  }

  /**
   * Actualisation automatique : le solde du jour se relit à chaque tour, mais l'historique complet
   * (jusqu'à plusieurs milliers de lignes, donc plusieurs requêtes) seulement si la consommation a bougé.
   */
  async function refreshLive() {
    const before = used.value

    await overview.refresh()
    if (used.value !== before)
      await transactions.refresh()
  }

  return { overview, subscription, tier, dailyLimit, used, remaining, usedPercent, transactions, rows, pager, truncated, reload, reloadAll, refreshLive }
}
