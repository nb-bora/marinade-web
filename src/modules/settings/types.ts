import type { components } from '@/lib/api/schema'

type Schemas = components['schemas']

export type Restaurant = Schemas['RestaurantResponse']
export type RestaurantUpdate = Schemas['RestaurantUpdate']

/** Configuration Easy Transact envoyée au serveur (remplace la précédente en entier). */
export type PaymentConfigurationInput = Schemas['PaymentConfigurationUpsert']
export type PaymentConfiguration = Schemas['PaymentConfigurationResponse']
