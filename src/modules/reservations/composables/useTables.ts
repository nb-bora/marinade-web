import { reservationsApi } from '../api'
import { tableLabel } from '../labels'
import { useAsyncData } from '@/composables/useAsyncData'
import { useTenantStore } from '@/stores/tenant.store'

/** Les tables du restaurant courant (lecture seule) et leur libellé à partir d'un identifiant. */
export function useTables() {
  const tenant = useTenantStore()

  const { data, loading, reload, refresh } = useAsyncData(
    signal => tenant.currentId ? reservationsApi.tables(tenant.currentId, signal) : Promise.resolve([]),
    { watch: [() => tenant.currentId] },
  )

  const tables = computed(() => [...(data.value ?? [])].sort((a, b) => a.numero.localeCompare(b.numero, 'fr', { numeric: true })))

  function labelOf(id: string | null | undefined): string {
    const table = tables.value.find(item => item.id === id)

    return table ? tableLabel(table.numero) : 'Sans table'
  }

  return { tables, loading, reload, refresh, labelOf }
}
