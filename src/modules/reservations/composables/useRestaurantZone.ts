import { reservationsApi } from '../api'
import { FUSEAU_PAR_DEFAUT } from '../calendar'
import { useAsyncData } from '@/composables/useAsyncData'
import { useTenantStore } from '@/stores/tenant.store'

/**
 * Le fuseau du restaurant courant. Tant qu'il n'est pas connu, le fuseau par défaut sert :
 * l'écran ne s'affiche donc jamais avec le fuseau du poste.
 */
export function useRestaurantZone() {
  const tenant = useTenantStore()

  const { data, loading, error, reload } = useAsyncData(
    signal => tenant.currentId ? reservationsApi.restaurant(tenant.currentId, signal) : Promise.resolve(null),
    { watch: [() => tenant.currentId] },
  )

  const zone = computed(() => data.value?.timezone ?? FUSEAU_PAR_DEFAUT)
  const name = computed(() => data.value?.name ?? '')

  return { zone, name, loading, error, reload }
}
