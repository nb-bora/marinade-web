import { stockApi } from '../api'
import { buildRows } from '../labels'
import type { StockRow } from '../types'
import { useAsyncData } from '@/composables/useAsyncData'
import { useTenantStore } from '@/stores/tenant.store'

/**
 * Le stock du restaurant courant, associé aux composants (nom, unité, type).
 * Recharge tout seul quand l'utilisateur change de restaurant.
 */
export function useStockOverview() {
  const tenant = useTenantStore()

  const { data, loading, error, reload, refresh } = useAsyncData(async signal => {
    const id = tenant.currentId

    if (!id)
      return [] as StockRow[]

    const [composants, levels] = await Promise.all([stockApi.composants(id, signal), stockApi.stock(id, signal)])

    return buildRows(composants, levels)
  }, { watch: [() => tenant.currentId] })

  const rows = computed(() => data.value ?? [])
  const loadedOnce = computed(() => data.value !== null)

  const counts = computed(() => ({
    total: rows.value.length,
    alerte: rows.value.filter(row => row.state === 'alerte').length,
    rupture: rows.value.filter(row => row.state === 'rupture').length,
    reserved: rows.value.filter(row => Number(row.stock.reservee) > 0).length,
  }))

  return { rows, counts, loading, loadedOnce, error, reload, refresh }
}
