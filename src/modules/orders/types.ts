import type { components } from '@/lib/api/schema'

type Schemas = components['schemas']

export type Commande = Schemas['CommandeResponse']
export type CommandeCreate = Schemas['CommandeCreate']
export type CommandeUpdate = Schemas['CommandeUpdate']
export type CommandeItem = Schemas['CommandeItemResponse']
export type CommandeItemCreate = Schemas['CommandeItemCreate']

export type Refund = Schemas['CommandeRefundResponse']
export type RefundCreate = Schemas['CommandeRefundCreate']

export type Table = Schemas['TableResponse']
export type Plat = Schemas['PlatResponse']
export type Boisson = Schemas['BoissonResponse']

/** Statuts d'une commande de l'ancien circuit (le back les type en chaîne libre). */
export const ORDER_STATUSES = [
  'en_cours',
  'servie',
  'paiement_en_attente',
  'paiement_a_verifier',
  'payee',
  'annulee',
] as const

export type OrderStatus = typeof ORDER_STATUSES[number]

/** Statuts d'une demande de remboursement. */
export const REFUND_STATUSES = ['requested', 'approved', 'rejected'] as const

export type RefundStatus = typeof REFUND_STATUSES[number]

/** Les noms que l'écran affiche à la place des identifiants d'articles. */
export interface Catalogue {
  plats: Map<string, string>
  boissons: Map<string, string>
}
