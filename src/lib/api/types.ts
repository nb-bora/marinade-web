/**
 * Noms stables pour les types du contrat OpenAPI.
 *
 * `schema.d.ts` est GÉNÉRÉ (`yarn gen:api`, à partir de `api/openapi.json` exporté par le
 * back) : on n'y touche jamais. Le reste de l'application importe d'ici, si bien qu'un
 * renommage côté back ne casse qu'un seul fichier.
 */
import type { components } from './schema'

type Schemas = components['schemas']

// Authentification et compte
export type TokenResponse = Schemas['TokenResponse']
export type UserResponse = Schemas['UserResponse']
export type UserCreate = Schemas['UserCreate']
export type TwoFactorSetup = Schemas['TwoFactorSetupResponse']
export type TwoFactorRecoveryCodes = Schemas['TwoFactorRecoveryCodesResponse']

// Accès aux restaurants
export type RestaurantAccess = Schemas['RestaurantAccess']
export type Capability = RestaurantAccess['capabilities'][number]
export type RestaurantResponse = Schemas['RestaurantResponse']

/** Seul le nom est obligatoire : le serveur fixe devise, taux de service et activation. */
export type RestaurantCreate = Pick<Schemas['RestaurantCreate'], 'name'> & Partial<Omit<Schemas['RestaurantCreate'], 'name'>>

// Paiements
export type PaymentTransaction = Schemas['PaymentTransactionResponse']
export type PaymentTransactionPage = Schemas['PaymentTransactionPage']
export type PaymentTransactionDetail = Schemas['PaymentTransactionDetail']
export type PaymentEvent = Schemas['PaymentEventResponse']
export type PaymentSummary = Schemas['PaymentSummaryResponse']

/** Statuts qu'une transaction peut avoir côté passerelle, plus la revue manuelle. */
export const PAYMENT_STATUSES = [
  'initiated',
  'pending',
  'processing',
  'success',
  'failed',
  'timeout',
  'reversed',
  'refunded',
  'expired',
  'manual_review',
] as const

export type PaymentStatus = typeof PAYMENT_STATUSES[number]
