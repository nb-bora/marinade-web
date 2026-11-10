import type { Commande, Refund } from './types'

/** Arrondit au centime : les montants arrivent en chaînes et leurs sommes en flottants dérivent. */
export const roundMoney = (value: number) => Math.round(value * 100) / 100

/** Somme de décimaux arrivés en chaînes, arrondie au centime. */
const sum = (values: string[]) => roundMoney(values.reduce((total, value) => total + Number(value), 0))

/** Montant déjà remboursé : les demandes approuvées. */
export const refundedOf = (refunds: Refund[] | undefined) =>
  sum((refunds ?? []).filter(refund => refund.statut === 'approved').map(refund => refund.montant))

/** Montant réservé par des demandes en attente de décision. */
export const pendingOf = (refunds: Refund[] | undefined) =>
  sum((refunds ?? []).filter(refund => refund.statut === 'requested').map(refund => refund.montant))

/** Cette commande a-t-elle au moins une demande de remboursement à traiter ? */
export const hasPendingRefund = (order: Pick<Commande, 'remboursements'>) =>
  order.remboursements.some(refund => refund.statut === 'requested')

/**
 * Ce qu'on peut encore demander à rembourser : le total, moins ce qui est approuvé et ce qui attend
 * une décision (le back applique le même plafond).
 */
export const refundableOf = (total: number, refunds: Refund[] | undefined) =>
  roundMoney(Math.max(0, total - refundedOf(refunds) - pendingOf(refunds)))
