import type { PaymentConfiguration, PaymentConfigurationInput, Restaurant, RestaurantUpdate } from './types'
import { container } from '@/container'
import type { HttpClient } from '@/lib/http/HttpClient'
import { isApiError } from '@/lib/http/errors'

/** Paramètres du restaurant courant et configuration Easy Transact. */
export class SettingsApi {
  constructor(private readonly http: HttpClient) {}

  restaurant(restaurantId: string, signal?: AbortSignal) {
    return this.http.get<Restaurant>(`/v1/restaurants/${restaurantId}`, { signal })
  }

  /** Mise à jour partielle : seuls les champs fournis sont modifiés. */
  updateRestaurant(restaurantId: string, body: RestaurantUpdate) {
    return this.http.put<Restaurant>(`/v1/restaurants/${restaurantId}`, body)
  }

  /** Configuration Easy Transact du restaurant (sans aucun secret), ou `null` si elle n'existe pas encore. */
  async paymentConfiguration(restaurantId: string, signal?: AbortSignal): Promise<PaymentConfiguration | null> {
    try {
      return await this.http.get<PaymentConfiguration>('/v1/payments/easytransact/configuration', {
        query: { restaurant_id: restaurantId },
        signal,
      })
    }
    catch (cause) {
      if (isApiError(cause) && cause.kind === 'not_found')
        return null

      throw cause
    }
  }

  /** Crée ou remplace la configuration Easy Transact (elle est remplacée en entier). */
  savePaymentConfiguration(body: PaymentConfigurationInput) {
    return this.http.put<PaymentConfiguration>('/v1/payments/easytransact/configuration', body)
  }
}

export const settingsApi = new SettingsApi(container.http)
