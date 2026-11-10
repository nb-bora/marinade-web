import { describe, expect, it } from 'vitest'
import {
  amountRule,
  compatibleUnits,
  convertQty,
  decimalPlaces,
  gaugeShares,
  matchesSearch,
  motifOptions,
  motifRequired,
  movementQuantityRule,
  nonNegativeQty,
  normalizeType,
  normalizeUnit,
  portionsFor,
  positiveQty,
  stockAfterMovement,
  stockState,
  toInput,
} from './labels'
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

describe('jauge', () => {
  it('suit le disponible : un stock entièrement réservé n\'a aucune part disponible', () => {
    const shares = gaugeShares(level(10, 10, 4))

    expect(shares.available).toBe(0)
    expect(shares.reserved).toBeGreaterThan(0)
  })

  it('place le seuil à mi-course tant que la quantité reste sous le double du seuil', () => {
    expect(gaugeShares(level(2, 0, 4)).threshold).toBe(50)
  })

  it('élargit l\'échelle quand la quantité dépasse le double du seuil', () => {
    const shares = gaugeShares(level(40, 0, 4))

    expect(shares.available).toBe(100)
    expect(shares.threshold).toBe(10)
  })

  it('sans seuil : pas de repère, la jauge représente tout le stock', () => {
    const shares = gaugeShares(level(8, 2, 0))

    expect(shares.threshold).toBeNull()
    expect(shares.available + shares.reserved).toBe(100)
  })

  it('un stock vide ne produit ni NaN ni part négative', () => {
    expect(gaugeShares(level(0, 0, 0))).toEqual({ available: 0, reserved: 0, threshold: null })
  })
})

describe('règles de quantité : mêmes bornes que le serveur', () => {
  it('accepte la virgule et refuse le zéro pour une quantité positive', () => {
    expect(positiveQty('0,25')).toBe(true)
    expect(positiveQty('0')).not.toBe(true)
    expect(positiveQty('')).not.toBe(true)
    expect(positiveQty('abc')).not.toBe(true)
  })

  it('refuse plus de trois décimales au lieu de laisser le serveur arrondir', () => {
    expect(positiveQty('0,1234')).not.toBe(true)
    expect(positiveQty('0,123')).toBe(true)
  })

  it('refuse une quantité hors de Numeric(12, 3)', () => {
    expect(positiveQty('1000000000')).not.toBe(true)
  })

  it('accepte zéro quand il est permis (ajustement d\'inventaire)', () => {
    expect(nonNegativeQty('0')).toBe(true)
    expect(nonNegativeQty('-1')).not.toBe(true)
  })

  it('compte les décimales quel que soit le séparateur', () => {
    expect(decimalPlaces('12,50')).toBe(2)
    expect(decimalPlaces('12.5')).toBe(1)
    expect(decimalPlaces('12')).toBe(0)
  })

  it('un montant respecte son nombre de décimales', () => {
    expect(amountRule(4)('0,0001')).toBe(true)
    expect(amountRule(4)('0,00001')).not.toBe(true)
    expect(amountRule(2, { allowZero: false })('0')).not.toBe(true)
  })

  it('ramène un nombre du serveur à une saisie française', () => {
    expect(toInput('12.500')).toBe('12,5')
  })
})

describe('contrôle d\'un mouvement', () => {
  const stock = level(10, 4, 2) // disponible 6, réservé 4

  it('une sortie ne dépasse pas le disponible', () => {
    expect(movementQuantityRule('sortie', stock)('6')).toBe(true)
    expect(movementQuantityRule('sortie', stock)('7')).not.toBe(true)
  })

  it('un ajustement peut valoir zéro mais pas descendre sous le réservé', () => {
    expect(movementQuantityRule('ajustement', level(10, 0, 2))('0')).toBe(true)
    expect(movementQuantityRule('ajustement', stock)('3')).not.toBe(true)
    expect(movementQuantityRule('ajustement', stock)('4')).toBe(true)
  })

  it('une entrée n\'est limitée que par la précision', () => {
    expect(movementQuantityRule('entree', stock)('500')).toBe(true)
    expect(movementQuantityRule('entree', stock)('0')).not.toBe(true)
  })

  it('calcule le stock après le mouvement', () => {
    expect(stockAfterMovement(stock, 'entree', 5)).toBe(15)
    expect(stockAfterMovement(stock, 'sortie', 5)).toBe(5)
    expect(stockAfterMovement(stock, 'ajustement', 3)).toBe(3)
    expect(stockAfterMovement(stock, 'entree', Number.NaN)).toBeNull()
  })
})

describe('unités', () => {
  it('normalise comme le serveur', () => {
    expect(normalizeUnit('Litres')).toBe('l')
    expect(normalizeUnit('pièce')).toBe('piece')
    expect(normalizeUnit(' KG ')).toBe('kg')
  })

  it('convertit dans une même grandeur', () => {
    expect(convertQty(200, 'g', 'kg')).toBeCloseTo(0.2)
    expect(convertQty(1.5, 'L', 'cl')).toBeCloseTo(150)
    expect(convertQty(3, 'portion', 'portion')).toBe(3)
  })

  it('refuse de convertir d\'une grandeur à l\'autre', () => {
    expect(convertQty(1, 'kg', 'L')).toBeNull()
    expect(convertQty(1, 'kg', 'portion')).toBeNull()
  })

  it('propose les unités de la même grandeur que le stock', () => {
    expect(compatibleUnits('kg')).toEqual(['kg', 'g', 'mg'])
    expect(compatibleUnits('L')).toEqual(['L', 'dl', 'cl', 'ml'])
    expect(compatibleUnits('portion')).toEqual(['portion'])
  })

  it('calcule les portions possibles en convertissant l\'unité de la fiche', () => {
    // 2 kg disponibles, 150 g par portion : 13 portions.
    expect(portionsFor({ quantite: '150', unite: 'g' }, level(2, 0, 0), 'kg')).toBe(13)
  })

  it('ne devine pas une conversion impossible', () => {
    expect(portionsFor({ quantite: '1', unite: 'portion' }, level(2, 0, 0), 'kg')).toBeNull()
  })

  it('ne dépasse jamais le disponible : le réservé est décompté', () => {
    expect(portionsFor({ quantite: '1', unite: 'portion' }, level(10, 7, 0), 'portion')).toBe(3)
  })
})

describe('recherche et catégories', () => {
  it('ignore les accents et la casse', () => {
    expect(matchesSearch('PROTÉINE', 'Poulet', 'proteine')).toBe(true)
    expect(matchesSearch('legume', 'Carotte', 'Légume')).toBe(true)
    expect(matchesSearch('zzz', 'Poulet', 'proteine')).toBe(false)
  })

  it('une recherche vide laisse tout passer', () => {
    expect(matchesSearch('  ', 'Poulet')).toBe(true)
  })

  it('« Protéine » redevient le code `proteine`, une catégorie libre reste telle quelle', () => {
    expect(normalizeType('Protéine')).toBe('proteine')
    expect(normalizeType('  Épice ')).toBe('epice')
    expect(normalizeType('Dessert')).toBe('dessert')
  })
})
