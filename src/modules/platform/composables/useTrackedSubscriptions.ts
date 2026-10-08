import { platformApi } from '../api'
import type { Subscription } from '../types'
import { useAsyncData } from '@/composables/useAsyncData'

const STORAGE_KEY = 'marinade.platform.subscriptions'

export interface TrackedSubscription {
  subscription: Subscription
  restaurantName: string
}

function readIds(): string[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]')

    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
  }
  catch {
    return []
  }
}

function writeIds(ids: string[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
  }
  catch {
    // Stockage indisponible : la liste ne sera simplement pas retenue.
  }
}

/**
 * Le serveur n'a aucune route qui liste les abonnements : l'écran suit ceux que
 * l'administrateur a créés ou ouverts depuis ce navigateur, retenus localement.
 */
export function useTrackedSubscriptions() {
  const ids = ref<string[]>(readIds())

  const { data, loading, error, reload, refresh } = useAsyncData(async signal => {
    const results = await Promise.allSettled(ids.value.map(async id => {
      const subscription = await platformApi.subscription(id, signal)
      const restaurant = await platformApi.restaurant(subscription.restaurant_id, signal).catch(() => null)

      return { subscription, restaurantName: restaurant?.name ?? 'Restaurant inconnu' } satisfies TrackedSubscription
    }))

    return results.flatMap(result => result.status === 'fulfilled' ? [result.value] : [])
  })

  function track(id: string) {
    ids.value = [id, ...ids.value.filter(known => known !== id)].slice(0, 100)
    writeIds(ids.value)
  }

  function forget(id: string) {
    ids.value = ids.value.filter(known => known !== id)
    writeIds(ids.value)
  }

  const items = computed(() => data.value ?? [])

  return { items, loaded: computed(() => data.value !== null), ids, loading, error, reload, refresh, track, forget }
}
