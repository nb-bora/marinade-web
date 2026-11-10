import { describe, expect, it } from 'vitest'
import { bucketOf, canRefund, explainError, isActive } from './labels'
import { hasPendingRefund, pendingOf, refundableOf, refundedOf, roundMoney } from './refunds'
import type { Refund } from './types'

const refund = (montant: string, statut: string): Refund => ({ montant, statut } as unknown as Refund)

describe('remboursements : mêmes sommes que le serveur', () => {
  it('ne compte comme remboursé que ce qui est approuvé', () => {
    const refunds = [refund('1000', 'approved'), refund('500', 'requested'), refund('300', 'rejected')]

    expect(refundedOf(refunds)).toBe(1000)
    expect(pendingOf(refunds)).toBe(500)
  })

  it('plafonne la demande suivante : total - approuvé - en attente', () => {
    const refunds = [refund('1000', 'approved'), refund('500', 'requested')]

    expect(refundableOf(3000, refunds)).toBe(1500)
    expect(refundableOf(1200, refunds)).toBe(0)
  })

  it('ne laisse pas dériver les décimaux en flottants (0,1 + 0,2)', () => {
    const refunds = [refund('0.1', 'approved'), refund('0.2', 'approved')]

    expect(refundedOf(refunds)).toBe(0.3)
    expect(roundMoney(1650.0000000000002)).toBe(1650)
  })

  it('repère une commande avec une demande à traiter', () => {
    expect(hasPendingRefund({ remboursements: [refund('1', 'requested')] })).toBe(true)
    expect(hasPendingRefund({ remboursements: [refund('1', 'approved')] })).toBe(false)
    expect(hasPendingRefund({ remboursements: [] })).toBe(false)
  })
})

describe('statuts de commande', () => {
  it('range chaque statut dans un seul onglet', () => {
    expect(bucketOf('en_cours')).toBe('active')
    expect(bucketOf('servie')).toBe('active')
    expect(bucketOf('paiement_en_attente')).toBe('paying')
    expect(bucketOf('paiement_a_verifier')).toBe('paying')
    expect(bucketOf('payee')).toBe('history')
    expect(bucketOf('annulee')).toBe('history')
  })

  it('une commande en cours de paiement n\'est pas « active » au sens du back', () => {
    expect(isActive('paiement_en_attente')).toBe(false)
  })

  it('autorise la demande de remboursement comme le back : servie ou payée', () => {
    expect(canRefund('servie')).toBe(true)
    expect(canRefund('payee')).toBe(true)
    expect(canRefund('en_cours')).toBe(false)
    expect(canRefund('annulee')).toBe(false)
  })

  it('traduit les refus connus du back sans montrer le texte brut', () => {
    expect(explainError(new Error('Refund amount 500 exceeds refundable balance 100'))).not.toContain('Refund amount')
  })
})
