import { describe, expect, it } from 'vitest'
import { isPayable } from './labels'
import { amountToPay, cashSuggestions, parseAmount, round2, toNumber, wholeDue } from './money'

describe('parseAmount', () => {
  it('garde les chiffres et ignore espaces et symboles', () => {
    expect(parseAmount('12 500 FCFA')).toBe(12_500)
  })

  it('vaut 0 pour une saisie vide ou sans chiffre', () => {
    expect(parseAmount('')).toBe(0)
    expect(parseAmount('abc')).toBe(0)
  })

  it('plafonne les montants démesurés', () => {
    expect(parseAmount('99999999999999')).toBe(999_999_999)
  })
})

describe('arrondi du FCFA', () => {
  it('le reste dû à virgule se règle en francs entiers', () => {
    expect(wholeDue(12_521.25)).toBe(12_521)
    expect(wholeDue(12_521.75)).toBe(12_522)
  })

  it('le versement qui atteint le reste dû en entier solde exactement la facture', () => {
    expect(amountToPay(12_521, 12_521.25)).toBe(12_521.25)
    expect(amountToPay(12_522, 12_521.75)).toBe(12_521.75)
  })

  it('un versement partiel reste tel que saisi', () => {
    expect(amountToPay(5_000, 12_521.25)).toBe(5_000)
  })

  it('round2 évite les dérives de flottants', () => {
    expect(round2(0.1 + 0.2)).toBe(0.3)
  })

  it('toNumber lit les décimaux du back et tolère le vide', () => {
    expect(toNumber('12500.00')).toBe(12_500)
    expect(toNumber(null)).toBe(0)
    expect(toNumber('n/a')).toBe(0)
  })
})

describe('cashSuggestions', () => {
  it('propose le montant exact puis les coupures qui le couvrent', () => {
    expect(cashSuggestions(12_521.25)).toEqual([12_521, 13_000, 14_000, 15_000])
  })

  it('ne propose rien quand il n\'y a rien à payer', () => {
    expect(cashSuggestions(0)).toEqual([])
  })

  it('ne dépasse jamais quatre propositions, triées', () => {
    const list = cashSuggestions(300)

    expect(list.length).toBeLessThanOrEqual(4)
    expect(list).toEqual([...list].sort((a, b) => a - b))
    expect(list[0]).toBe(300)
  })
})

describe('isPayable', () => {
  it('une addition ouverte avec un reste dû se paie', () => {
    expect(isPayable({ status: 'ISSUED', amount_due: '1500.00' })).toBe(true)
    expect(isPayable({ status: 'PARTIALLY_PAID', amount_due: 500 })).toBe(true)
  })

  it('une addition soldée ne se paie plus', () => {
    expect(isPayable({ status: 'PAID', amount_due: '0.00' })).toBe(false)
  })

  it('une facture annulée ou remboursée ne se paie pas, même avec un reste dû', () => {
    expect(isPayable({ status: 'CANCELLED', amount_due: '1500.00' })).toBe(false)
    expect(isPayable({ status: 'REFUNDED', amount_due: '1500.00' })).toBe(false)
  })
})
