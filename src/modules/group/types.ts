import type { components } from '@/lib/api/schema'

type Schemas = components['schemas']

/** Chiffres consolidés de tous les restaurants dont l'utilisateur est propriétaire. */
export type GroupReporting = Schemas['GroupReportingResponse']

/** Encaissements Mobile Money d'un restaurant (route des paiements, restaurant par restaurant). */
export type RestaurantPayments = Schemas['PaymentSummaryResponse']

export interface RestaurantComparison {
  id: string
  name: string
  city: string | null

  /** `null` quand les paiements de ce restaurant n'ont pas pu être lus. */
  payments: RestaurantPayments | null
}
