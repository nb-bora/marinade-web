import { cashDeskApi } from '../api'
import type { CashSession, Invoice } from '../types'
import { useAsyncData } from '@/composables/useAsyncData'
import { useTenantStore } from '@/stores/tenant.store'

/** Factures relues en parallèle, pour ne pas ouvrir cinquante connexions d'un coup. */
const CONCURRENCY = 6

/**
 * Le back répond 404 à « facture de la session » tant qu'aucune commande n'a été passée.
 * La caisse se rafraîchit toute seule : une session sans commande n'est relue que toutes les 20 secondes.
 */
const RECHECK_MS = 20_000

const emptySince = new Map<string, number>()

async function invoiceOf(restaurantId: string, sessionId: string, signal: AbortSignal): Promise<Invoice | null> {
  const checkedAt = emptySince.get(sessionId)

  if (checkedAt !== undefined && Date.now() - checkedAt < RECHECK_MS)
    return null

  const invoice = await cashDeskApi.sessionInvoice(restaurantId, sessionId, signal)

  if (invoice)
    emptySince.delete(sessionId)
  else
    emptySince.set(sessionId, Date.now())

  return invoice
}

async function mapLimited<T, R>(items: T[], worker: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = Array.from({ length: items.length })
  let next = 0

  async function run() {
    while (next < items.length) {
      const index = next++

      results[index] = await worker(items[index])
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, run))

  return results
}

/** Les sessions ouvertes du restaurant, chacune avec sa table et son addition. */
export function useCashSessions() {
  const tenant = useTenantStore()

  const { data, loading, error, reload, refresh } = useAsyncData<CashSession[]>(async signal => {
    const restaurantId = tenant.currentId

    if (!restaurantId)
      return []

    const [sessions, tables] = await Promise.all([
      cashDeskApi.activeSessions(restaurantId, signal),

      // Les noms de table sont un confort : sans eux, la session reste encaissable.
      cashDeskApi.tables(restaurantId, signal).catch(() => []),
    ])

    const tableById = new Map(tables.map(table => [table.id, table]))

    return mapLimited(sessions, async session => ({
      session,
      table: session.table_id ? tableById.get(session.table_id) ?? null : null,
      invoice: await invoiceOf(restaurantId, session.id, signal),
    }))
  }, { watch: [() => tenant.currentId] })

  /** Sessions avec une addition non soldée, les plus anciennes d'abord. */
  const toCollect = computed(() => (data.value ?? [])
    .filter(row => row.invoice !== null && Number(row.invoice.amount_due) > 0)
    .sort((a, b) => a.session.opened_at.localeCompare(b.session.opened_at)))

  const withoutOrder = computed(() => (data.value ?? []).filter(row => row.invoice === null).length)
  const totalDue = computed(() => toCollect.value.reduce((sum, row) => sum + Number(row.invoice?.amount_due ?? 0), 0))

  return { rows: data, toCollect, withoutOrder, totalDue, loading, error, reload, refresh }
}
