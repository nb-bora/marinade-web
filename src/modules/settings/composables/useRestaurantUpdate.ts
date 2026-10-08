import { settingsApi } from '../api'
import type { Restaurant, RestaurantUpdate } from '../types'
import { useSubmit } from '@/composables/useSubmit'
import { useToast } from '@/stores/toast.store'

/**
 * Enregistre une partie des réglages du restaurant (mise à jour partielle) et avertit le parent
 * avec le restaurant à jour. Le serveur ne laisse modifier un restaurant qu'à son propriétaire
 * (ou à un administrateur de la plateforme) : ce refus a son propre message.
 */
export function useRestaurantUpdate(restaurantId: () => string, onSaved: (restaurant: Restaurant) => void) {
  const toast = useToast()

  const { submit, pending, apiError, message, reset } = useSubmit(async (patch: RestaurantUpdate, success: string) => {
    const saved = await settingsApi.updateRestaurant(restaurantId(), patch)

    onSaved(saved)
    toast.success(success)

    return saved
  })

  const errorMessage = computed(() =>
    apiError.value?.kind === 'forbidden'
      ? 'Seul le propriétaire du restaurant peut modifier ces paramètres.'
      : message.value,
  )

  return { save: submit, pending, errorMessage, apiError, reset }
}
