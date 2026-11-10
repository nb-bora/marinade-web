import { createSharedComposable } from '@vueuse/core'
import { IN_FLIGHT } from '../statuses'
import { container } from '@/container'
import { useLive } from '@/composables/useLive'
import type { PaymentSummary } from '@/lib/api/types'
import { addDays, startOfDay } from '@/lib/format'

export interface DailyCollection {
  date: Date
  collected: number
  transactions: number
}

const DAYS = 7
const REFRESH_MS = 30_000

/**
 * Les chiffres des widgets de paiement du tableau de bord, chargés UNE fois pour tous.
 *
 * Partagé : plusieurs widgets affichent des vues différentes des mêmes données, sans
 * multiplier les requêtes. Chaque jour est un résumé borné côté serveur (une agrégation
 * indexée), et l'ensemble se rafraîchit tant que l'onglet est visible.
 */
export const usePaymentInsights = createSharedComposable(() => {
  const week = ref<PaymentSummary | null>(null)
  const days = ref<DailyCollection[]>([])
  const loading = ref(true)
  const error = ref<unknown>(null)

  const today = computed(() => days.value.at(-1) ?? null)

  /** Devise du restaurant, telle que la déclare le serveur (FCFA par défaut). */
  const currency = computed(() => week.value?.currency ?? 'XAF')

  async function load(): Promise<void> {
    const midnight = startOfDay()

    const ranges = Array.from({ length: DAYS }, (_, index) => ({
      from: addDays(midnight, index - DAYS + 1),
      to: addDays(midnight, index - DAYS + 2),
    }))

    try {
      const [weekly, ...daily] = await Promise.all([
        container.payments.summary({ from: ranges[0].from }),
        ...ranges.map(range => container.payments.summary(range)),
      ])

      week.value = weekly
      days.value = daily.map((summary, index) => ({
        date: ranges[index].from,
        collected: summary.collected_fcfa,
        transactions: summary.transactions,
      }))
      error.value = null
    }
    catch (cause) {
      // Une actualisation qui échoue garde l'affichage précédent.
      if (!week.value)
        error.value = cause
    }
    finally {
      loading.value = false
    }
  }

  useLive(load, REFRESH_MS)

  return { week, days, today, currency, loading, error, reload: load }
})

/**
 * Taux de réussite d'un résumé, en pourcentage entier, calculé sur les paiements TERMINÉS : un
 * paiement encore en route (initié, en attente, en cours) n'est ni une réussite ni un échec, et ne
 * doit pas faire baisser le taux le temps que la confirmation arrive. `null` s'il n'y en a aucun.
 */
export function successRate(summary: PaymentSummary | null): number | null {
  if (!summary)
    return null

  const inFlight = IN_FLIGHT.reduce((sum, status) => sum + (summary.by_status[status]?.count ?? 0), 0)
  const finished = summary.transactions - inFlight

  if (finished <= 0)
    return null

  return Math.min(Math.round(((summary.by_status.success?.count ?? 0) / finished) * 100), 100)
}
