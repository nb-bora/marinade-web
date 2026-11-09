import { describe, expect, it } from 'vitest'
import { motifOptions, motifRequired, stockState } from './labels'
import type { StockLevel } from './types'

const level = (quantite: number, reservee: number, seuil: number): StockLevel => ({
  composant_id: 'c',
  quantite,
  reservee,
  disponible: quantite - reservee,
  seuil_alerte: seuil,
} as unknown as StockLevel)

describe('stockState : même règle que le serveur', () => {
  it('rupture quand le disponible est nul, réservations comprises', () => {
    expect(stockState(level(5, 5, 2))).toBe('rupture')
  })

  it('alerte sur le disponible, pas sur la quantité brute', () => {
    // 6 en stock, 5 réservés : disponible 1, seuil 2 -> alerte alors que la quantité brute dépasse le seuil.
    expect(stockState(level(6, 5, 2))).toBe('alerte')
  })

  it('un seuil à 0 ne déclenche jamais d\'alerte', () => {
    expect(stockState(level(1, 0, 0))).toBe('ok')
  })
})

describe('motifs de mouvement', () => {
  it('une sortie et un ajustement exigent un motif, une entrée non', () => {
    expect(motifRequired('sortie')).toBe(true)
    expect(motifRequired('ajustement')).toBe(true)
    expect(motifRequired('entree')).toBe(false)
  })

  it('une sortie propose ses motifs et n\'accepte pas « inventaire »', () => {
    const codes = motifOptions('sortie').map(option => option.value)

    expect(codes).toContain('casse')
    expect(codes).not.toContain('inventaire')
  })

  it('un ajustement propose les motifs d\'inventaire', () => {
    expect(motifOptions('ajustement').map(option => option.value)).toEqual(['inventaire', 'erreur_saisie', 'autre'])
  })
})
