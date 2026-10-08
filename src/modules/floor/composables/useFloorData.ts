import { byNumber, coversOf } from '../service'
import { floorApi } from '../api'
import type { Invoice, ServiceSession, TableView } from '../types'
import { sessionInvoice } from './invoices'
import { useAsyncData } from '@/composables/useAsyncData'
import { useTenantStore } from '@/stores/tenant.store'

export interface FloorSnapshot {
  views: TableView[]

  /** Sessions ouvertes sans table (comptoir, terrasse libre...). */
  looseSessions: { session: ServiceSession; total: number | null; amountDue: number | null }[]
}

const amount = (invoice: Invoice | null, field: 'total_amount' | 'amount_due') =>
  invoice ? Number(invoice[field]) : null

/** Lit les factures par petits groupes : une salle pleine ne doit pas ouvrir 30 connexions d'un coup. */
async function invoicesOf(restaurantId: string, sessions: ServiceSession[], signal: AbortSignal) {
  const result = new Map<string, Invoice | null>()
  const queue = [...sessions]

  async function worker() {
    for (let session = queue.shift(); session; session = queue.shift()) {
      try {
        result.set(session.id, await sessionInvoice(restaurantId, session.id, signal))
      }
      catch {
        // Une addition illisible ne doit pas masquer tout le plan : la tuile n'affichera pas de montant.
        result.set(session.id, null)
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(6, sessions.length) }, worker))

  return result
}

/**
 * Tables + sessions ouvertes (+ addition de chaque session si `withAmounts`) du restaurant courant.
 * Une seule lecture pour le plan de salle, son bandeau et le widget du tableau de bord.
 */
export function useFloorData(withAmounts = true) {
  const tenant = useTenantStore()

  return useAsyncData<FloorSnapshot>(async signal => {
    const restaurantId = tenant.currentId

    if (!restaurantId)
      return { views: [], looseSessions: [] }

    const [tables, sessions] = await Promise.all([
      floorApi.tables(restaurantId, signal),
      floorApi.activeSessions(restaurantId, signal),
    ])

    const invoices = withAmounts ? await invoicesOf(restaurantId, sessions, signal) : new Map<string, Invoice | null>()

    // Plusieurs sessions sur une même table : la plus récente fait foi.
    const byTable = new Map<string, ServiceSession>()

    for (const session of [...sessions].sort((a, b) => a.opened_at.localeCompare(b.opened_at))) {
      if (session.table_id)
        byTable.set(session.table_id, session)
    }

    const views = [...tables].sort(byNumber).map<TableView>(table => {
      const session = byTable.get(table.id) ?? null
      const invoice = session ? invoices.get(session.id) ?? null : null

      return {
        table,
        session,
        total: amount(invoice, 'total_amount'),
        amountDue: amount(invoice, 'amount_due'),
        covers: coversOf(session, table),
      }
    })

    const looseSessions = sessions
      .filter(session => !session.table_id || !tables.some(table => table.id === session.table_id))
      .map(session => ({
        session,
        total: amount(invoices.get(session.id) ?? null, 'total_amount'),
        amountDue: amount(invoices.get(session.id) ?? null, 'amount_due'),
      }))

    return { views, looseSessions }
  }, { watch: [() => tenant.currentId] })
}
