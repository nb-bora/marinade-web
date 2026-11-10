import { ordersApi } from '../api'
import { bucketOf } from '../labels'
import { refundedOf } from '../refunds'
import type { Commande, Table } from '../types'
import { useAsyncData } from '@/composables/useAsyncData'
import { useTenantStore } from '@/stores/tenant.store'

const byCreation = (direction: 1 | -1) => (a: Commande, b: Commande) =>
  direction * (Date.parse(a.created_at) - Date.parse(b.created_at))

/**
 * Les commandes du restaurant courant et leurs tables.
 *
 * Le back joint les lignes et les remboursements à chaque commande : les indicateurs et le
 * tableau se calculent donc sur la liste, sans requête par commande (avant, une requête par
 * commande servie ou payée partait à chaque actualisation).
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

  const all = computed(() => orders.data.value ?? [])

  /** À servir, les plus anciennes d'abord : ce sont celles qui attendent le plus. */
  const active = computed(() => all.value.filter(order => bucketOf(order.statut) === 'active').sort(byCreation(1)))

  /** Paiement lancé, pas encore confirmé : les plus anciennes d'abord, elles sont les plus suspectes. */
  const paying = computed(() => all.value.filter(order => bucketOf(order.statut) === 'paying').sort(byCreation(1)))

  const history = computed(() => all.value.filter(order => bucketOf(order.statut) === 'history').sort(byCreation(-1)))

  const refunds = computed(() => all.value.flatMap(order => order.remboursements))

  /** Demandes en attente de décision d'un manager. */
  const pendingRefunds = computed(() => refunds.value.filter(refund => refund.statut === 'requested'))

  const refundedTotal = computed(() => refundedOf(refunds.value))

  const reload = () => orders.refresh()

  return {
    orders,
    tables,
    tableNames,
    active,
    paying,
    history,
    pendingRefunds,
    refundedTotal,
    reload,
  }
}
