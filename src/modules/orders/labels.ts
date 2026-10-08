import type { OrderStatus, RefundStatus } from './types'
import { ORDER_STATUSES, REFUND_STATUSES } from './types'
import { describeError } from '@/lib/http/errorMessages'
import { isApiError } from '@/lib/http/errors'
import type { StatusTone } from '@/ui/AppStatusChip.vue'

interface Presentation {
  label: string
  tone: StatusTone
  icon: string
}

/** Comment chaque statut de commande se présente à l'écran. */
const ORDER: Record<OrderStatus, Presentation> = {
  en_cours: { label: 'En cours', tone: 'info', icon: 'ri-loader-4-line' },
  servie: { label: 'Servie', tone: 'success', icon: 'ri-restaurant-2-line' },
  paiement_en_attente: { label: 'Paiement en attente', tone: 'warning', icon: 'ri-hourglass-line' },
  paiement_a_verifier: { label: 'Paiement à vérifier', tone: 'warning', icon: 'ri-eye-line' },
  payee: { label: 'Payée', tone: 'success', icon: 'ri-checkbox-circle-line' },
  annulee: { label: 'Annulée', tone: 'neutral', icon: 'ri-close-circle-line' },
}

const REFUND: Record<RefundStatus, Presentation> = {
  requested: { label: 'À traiter', tone: 'warning', icon: 'ri-time-line' },
  approved: { label: 'Approuvé', tone: 'success', icon: 'ri-checkbox-circle-line' },
  rejected: { label: 'Rejeté', tone: 'error', icon: 'ri-close-circle-line' },
}

const UNKNOWN: Presentation = { label: 'Inconnu', tone: 'neutral', icon: 'ri-question-line' }

const isOrderStatus = (value: string): value is OrderStatus =>
  (ORDER_STATUSES as readonly string[]).includes(value)

const isRefundStatus = (value: string): value is RefundStatus =>
  (REFUND_STATUSES as readonly string[]).includes(value)

export const presentOrder = (status: string): Presentation =>
  isOrderStatus(status) ? ORDER[status] : { ...UNKNOWN, label: status }

export const presentRefund = (status: string): Presentation =>
  isRefundStatus(status) ? REFUND[status] : { ...UNKNOWN, label: status }

/** Commandes encore ouvertes : on peut y ajouter des articles. */
export const canAddItems = (status: string) => status === 'en_cours' || status === 'servie'

/** Le back accepte une demande de remboursement sur une commande payée ou servie. */
export const canRefund = (status: string) => status === 'payee' || status === 'servie'

/** Payée ou annulée : plus aucune modification possible. */
export const isClosed = (status: string) => status === 'payee' || status === 'annulee'

/** « Active » au sens du back : en cours ou servie. */
export const isActive = (status: string) => status === 'en_cours' || status === 'servie'

/** Messages du back que l'on sait traduire (le texte brut du serveur n'est jamais montré). */
const KNOWN: [RegExp, string][] = [
  [/^Refund can only be requested on paid or served/, 'Un remboursement ne peut être demandé que sur une commande servie ou payée.'],
  [/^Refund amount .* exceeds refundable balance/, 'Le montant dépasse ce qu\'il reste à rembourser sur cette commande.'],
  [/^Cannot add items to a commande/, 'On ne peut plus ajouter d\'article à cette commande.'],
  [/^A paid or cancelled commande cannot be edited/, 'Une commande payée ou annulée ne peut plus être modifiée.'],
  [/^Payment status can only be changed/, 'Le statut « payée » est posé automatiquement à la confirmation du paiement.'],
  [/^Table is not available/, 'Cette table n\'est pas libre.'],
  [/^Invalid table for this restaurant/, 'Cette table n\'appartient pas à ce restaurant.'],
  [/(Plat|Boisson|Combinaison) is not available/, 'Cet article n\'est plus disponible.'],
  [/unavailable component/, 'Un ingrédient de cet article est épuisé.'],
  [/^Refund is in status/, 'Cette demande a déjà été traitée.'],
  [/^Approving this refund would refund more/, 'Approuver cette demande rembourserait plus que le total de la commande.'],
  [/is already refunded/, 'Un des articles choisis est déjà remboursé.'],
  [/^remettre_en_stock requires item_ids/, 'Pour remettre en stock, choisissez les articles concernés.'],
]

/** Message en français pour une erreur d'API : les cas métier connus, sinon le message général. */
export function explainError(error: unknown): string {
  if (isApiError(error)) {
    const known = KNOWN.find(([pattern]) => pattern.test(error.message))

    if (known)
      return known[1]
  }

  return describeError(error)
}
