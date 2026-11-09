import type { Ref } from 'vue'
import { reservationsApi } from '../api'
import type { ClientMatch } from '../types'
import { useAsyncData } from '@/composables/useAsyncData'
import { useTenantStore } from '@/stores/tenant.store'

/** Recherche de client par nom ou téléphone (à partir de deux caractères), dans le restaurant courant. */
export function useClientSearch(term: Ref<string>) {
  const tenant = useTenantStore()

  const debounced = refDebounced(term, 250)

  const { data, loading } = useAsyncData<ClientMatch[]>(async signal => {
    const query = debounced.value.trim()

    if (!tenant.currentId || query.length < 2)
      return []

    return reservationsApi.searchCustomers(tenant.currentId, query, signal)
  }, { watch: [debounced, () => tenant.currentId] })

  return { matches: computed(() => data.value ?? []), loading }
}
