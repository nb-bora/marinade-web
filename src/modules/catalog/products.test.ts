import { describe, expect, it } from 'vitest'
import { matchesSearch, normalize, plural, priceStats, sortProducts } from './products'

const item = (nom: string, prix: string, extra: Record<string, unknown> = {}) =>
  ({ nom, prix, created_at: '2026-01-01T10:00:00Z', ...extra }) as { nom: string; prix: string; created_at: string; temps_preparation?: number | null }

describe('recherche', () => {
  it('ignore la casse et les accents', () => {
    expect(normalize('Crème BRÛLÉE')).toBe('creme brulee')
    expect(matchesSearch(normalize('creme'), 'Crème brûlée', null)).toBe(true)
  })

  it('cherche aussi dans la description', () => {
    expect(matchesSearch('gingembre', 'Jus maison', 'Au gingembre frais')).toBe(true)
    expect(matchesSearch('mangue', 'Jus maison', 'Au gingembre frais')).toBe(false)
  })

  it('un terme vide laisse tout passer', () => {
    expect(matchesSearch('', 'Poulet DG')).toBe(true)
  })
})

describe('pluriel', () => {
  it('accorde selon le nombre', () => {
    expect(plural(0, 'plat')).toBe('0 plat')
    expect(plural(1, 'plat')).toBe('1 plat')
    expect(plural(2, 'plat')).toBe('2 plats')
    expect(plural(2, 'menu', 'menus')).toBe('2 menus')
  })
})

describe('tri', () => {
  const list = [item('Beignets', '1500'), item('Ndolé', '3500'), item('Alloco', '2500')]

  it('par nom, sans accents gênants', () => {
    expect(sortProducts(list, 'name').map(p => p.nom)).toEqual(['Alloco', 'Beignets', 'Ndolé'])
  })

  it('par prix croissant puis décroissant, en comparant des nombres et non des textes', () => {
    expect(sortProducts([item('A', '900'), item('B', '10000')], 'price-asc').map(p => p.nom)).toEqual(['A', 'B'])
    expect(sortProducts(list, 'price-desc').map(p => p.nom)).toEqual(['Ndolé', 'Alloco', 'Beignets'])
  })

  it('un temps non renseigné passe en dernier', () => {
    const timed = [item('Sans temps', '1'), item('Long', '1', { temps_preparation: 30 }), item('Court', '1', { temps_preparation: 5 })]

    expect(sortProducts(timed, 'time').map(p => p.nom)).toEqual(['Court', 'Long', 'Sans temps'])
  })

  it('les plus récents d\'abord', () => {
    const dated = [item('Ancien', '1', { created_at: '2025-01-01T00:00:00Z' }), item('Neuf', '1', { created_at: '2026-06-01T00:00:00Z' })]

    expect(sortProducts(dated, 'recent').map(p => p.nom)).toEqual(['Neuf', 'Ancien'])
  })

  it('ne modifie pas la liste d\'origine', () => {
    const copy = [...list]

    sortProducts(list, 'price-desc')
    expect(list).toEqual(copy)
  })
})

describe('statistiques de prix', () => {
  it('moyenne, minimum et maximum', () => {
    expect(priceStats([{ prix: '1000', devise: 'XAF' }, { prix: '3000' }])).toEqual({ average: 2000, min: 1000, max: 3000, currency: 'XAF' })
  })

  it('aucun produit : pas de statistique', () => {
    expect(priceStats([])).toBeNull()
  })

  it('ignore un prix illisible', () => {
    expect(priceStats([{ prix: 'abc' }, { prix: '500' }])?.average).toBe(500)
  })
})
