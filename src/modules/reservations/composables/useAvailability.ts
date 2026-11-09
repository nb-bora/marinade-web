import type { Ref } from 'vue'
import { reservationsApi } from '../api'
import type { Availability } from '../types'
import { useAsyncData } from '@/composables/useAsyncData'
import { useTenantStore } from '@/stores/tenant.store'

/**
 * Créneaux disponibles pour une date, un nombre de couverts et une durée. Recharge dès que l'un
 * des trois change ; sans date ni couverts, rien n'est demandé.
 */
export function useAvailability(date: Ref<string>, partySize: Ref<number>, duration: Ref<number>) {
  const tenant = useTenantStore()

  const key = computed(() => `${tenant.currentId}|${date.value}|${partySize.value}|${duration.value}`)

  const { data, loading, error, reload } = useAsyncData<Availability | null>(async signal => {
    if (!tenant.currentId || !date.value || partySize.value < 1)
      return null

    return reservationsApi.availability(tenant.currentId, date.value, partySize.value, duration.value, signal)
  }, { watch: [key] })

  return { availability: computed(() => data.value), loading, error, reload }
}
