import type { PaymentConfiguration, PaymentConfigurationInput, Restaurant, RestaurantUpdate } from './types'
import { container } from '@/container'
import type { HttpClient } from '@/lib/http/HttpClient'

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

  /**
   * Crée ou remplace la configuration Easy Transact. Le serveur ne propose aucune lecture de
   * la configuration existante : l'écran repart donc des valeurs par défaut.
   */
  savePaymentConfiguration(body: PaymentConfigurationInput) {
    return this.http.put<PaymentConfiguration>('/v1/payments/easytransact/configuration', body)
  }
}

export const settingsApi = new SettingsApi(container.http)
