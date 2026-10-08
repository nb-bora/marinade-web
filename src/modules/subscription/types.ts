import type { components } from '@/lib/api/schema'

type Schemas = components['schemas']

export type Subscription = Schemas['SubscriptionResponse']
export type SubscriptionStatus = Schemas['SubscriptionStatus']
export type Tier = Schemas['SubscriptionTierResponse']
export type DailyBalance = Schemas['DailyBalanceResponse']

export type SubscriptionTransaction = Schemas['TransactionResponse']
export type SubscriptionTransactionCreate = Schemas['TransactionCreate']

/** Tout ce que l'écran « Mon abonnement » affiche, chargé d'un seul tenant. */
export interface SubscriptionOverview {

  /** Offres actives, pour le comparatif. */
  tiers: Tier[]

  /** Abonnement actif du restaurant courant ; `null` si le compte n'en a pas pour ce restaurant. */
  subscription: Subscription | null

  /** Soldes quotidiens, du plus ancien au plus récent. */
  balances: DailyBalance[]

  /** Solde d'aujourd'hui ; `null` tant qu'aucun solde n'est ouvert pour la journée. */
  today: DailyBalance | null
}
