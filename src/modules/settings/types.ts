import type { components } from '@/lib/api/schema'

type Schemas = components['schemas']

export type Restaurant = Schemas['RestaurantResponse']
export type RestaurantUpdate = Schemas['RestaurantUpdate']

/** Configuration Easy Transact envoyée au serveur (remplace la précédente en entier). */
export type PaymentConfigurationInput = Schemas['PaymentConfigurationUpsert']
export type PaymentConfiguration = Schemas['PaymentConfigurationResponse']

/** Ce que chaque onglet expose à la page pour le bouton « Enregistrer » de l'en-tête. */
export interface SettingsPanel {
  dirty: boolean
  pending: boolean
  invalid: boolean
  submit: () => Promise<void>
  cancel: () => void
}
