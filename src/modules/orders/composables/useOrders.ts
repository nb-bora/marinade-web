import { isActive } from '../labels'
import { ordersApi } from '../api'
import type { Commande, Refund, Table } from '../types'
import { useAsyncData } from '@/composables/useAsyncData'
import { useTenantStore } from '@/stores/tenant.store'

/** Au-delà, on n'interroge plus les remboursements : il faut une requête par commande. */
const LEDGER_LIMIT = 100
const LEDGER_PARALLEL = 6

/** Somme de décimaux arrivés en chaînes. */
const sum = (values: string[]) => values.reduce((total, value) => total + Number(value), 0)

export const refundedOf = (refunds: Refund[] | undefined) =>
  sum((refunds ?? []).filter(refund => refund.statut === 'approved').map(refund => refund.montant))

export const pendingOf = (refunds: Refund[] | undefined) =>
  sum((refunds ?? []).filter(refund => refund.statut === 'requested').map(refund => refund.montant))

/**
 * Les commandes du restaurant courant, leurs tables et leurs remboursements.
 *
 * Le back ne renvoie ni articles ni remboursements dans une commande (les listes sont toujours
 * vides) et n'expose pas le montant déjà remboursé : on interroge donc les remboursements des
 * commandes qui peuvent en avoir (servies ou payées), par petits groupes, et on les garde en
 * mémoire pour le tableau, les indicateurs et le tiroir.
 */
export function useOrders() {
  const tenant = useTenantStore()
  const restaurantId = () => tenant.currentId

  const orders = useAsyncData<Commande[]>(
    signal => restaurantId() ? ordersApi.list(restaurantId()!, signal) : Promise.resolve([]),
    { watch: [restaurantId] },
  )

  const tables = useAsyncData<Table[]>(
    signal => restaurantId() ? ordersApi.tables(restaurantId()!, signal) : Promise.resolve([]),
    { watch: [restaurantId] },
  )

  const tableNames = computed(() => new Map((tables.data.value ?? []).map(table => [table.id, table.numero])))

  /** Remboursements connus, par commande. `undefined` : pas (encore) chargés. */
  const ledger = ref<Record<string, Refund[]>>({})
  const ledgerLoading = ref(false)
  const ledgerPartial = ref(false)

  function setRefunds(commandeId: string, refunds: Refund[]) {
    ledger.value = { ...ledger.value, [commandeId]: refunds }
  }

  async function loadLedger(rows: Commande[]) {
    const candidates = rows.filter(order => order.statut === 'servie' || order.statut === 'payee')
    const wanted = candidates.slice(0, LEDGER_LIMIT)

    ledgerPartial.value = candidates.length > wanted.length
    ledgerLoading.value = true

    try {
      for (let index = 0; index < wanted.length; index += LEDGER_PARALLEL) {
        const group = wanted.slice(index, index + LEDGER_PARALLEL)
        const results = await Promise.allSettled(group.map(order => ordersApi.refunds(order.id)))
        const next = { ...ledger.value }

        results.forEach((result, position) => {
          if (result.status === 'fulfilled')
            next[group[position].id] = result.value
        })
        ledger.value = next
      }
    }
    finally {
      ledgerLoading.value = false
    }
  }

  watch(orders.data, rows => {
    if (rows)
      loadLedger(rows)
  })

  watch(restaurantId, () => {
    ledger.value = {}
  })

  const active = computed(() => (orders.data.value ?? []).filter(order => isActive(order.statut))
    .sort((a, b) => a.created_at.localeCompare(b.created_at)))

  const history = computed(() => (orders.data.value ?? []).filter(order => !isActive(order.statut))
    .sort((a, b) => b.created_at.localeCompare(a.created_at)))

  /** Demandes en attente de décision, avec la commande concernée. */
  const pendingRefunds = computed(() => Object.values(ledger.value)
    .flat()
    .filter(refund => refund.statut === 'requested'))

  const refundedTotal = computed(() => refundedOf(Object.values(ledger.value).flat()))

  async function reload() {
    await orders.refresh()
  }

  return {
    orders,
    tables,
    tableNames,
    ledger,
    ledgerLoading,
    ledgerPartial,
    setRefunds,
    active,
    history,
    pendingRefunds,
    refundedTotal,
    reload,
  }
}
