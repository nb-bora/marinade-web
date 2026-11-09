import { describe, expect, it } from 'vitest'
import { resolveCategory, uniqueInSheet } from './imports'
import type { MenuCategory } from './types'
import type { SheetRecord } from '@/lib/spreadsheet'
import { numberField } from '@/lib/sheetImport'

const record = (values: Record<string, string>, row = 2): SheetRecord => ({ row, values } as unknown as SheetRecord)
const category = (id: string): MenuCategory => ({ id, name: 'Entrées', ordre: 0 } as unknown as MenuCategory)

describe('résolution de la catégorie d\'un plat', () => {
  const byName = new Map([
    ['entrees', [{ category: category('midi'), menu: 'Carte du midi' }, { category: category('soir'), menu: 'Carte du soir' }]],
    ['plats', [{ category: category('plats'), menu: 'Carte du midi' }]],
  ])

  it('sans catégorie, pas de rattachement', () => {
    expect(resolveCategory(record({}), byName)).toBeUndefined()
  })

  it('une catégorie unique se résout seule', () => {
    expect(resolveCategory(record({ categorie: 'Plats' }), byName)?.id).toBe('plats')
  })

  it('une catégorie dans plusieurs menus exige le menu', () => {
    expect(() => resolveCategory(record({ categorie: 'Entrées' }), byName)).toThrow(/Plusieurs menus/)
  })

  it('le menu désigne la bonne catégorie', () => {
    expect(resolveCategory(record({ categorie: 'Entrées', menu: 'carte du SOIR' }), byName)?.id).toBe('soir')
  })

  it('une catégorie absente du menu indiqué est refusée', () => {
    expect(() => resolveCategory(record({ categorie: 'Plats', menu: 'Carte du soir' }), byName)).toThrow(/dans ce menu/)
  })

  it('un menu sans catégorie est refusé', () => {
    expect(() => resolveCategory(record({ menu: 'Carte du midi' }), byName)).toThrow(/Renseignez la catégorie/)
  })
})

describe('doublons dans une feuille', () => {
  it('un nom repris est refusé en citant la première ligne, quelle que soit la casse et les accents', () => {
    const once = uniqueInSheet()

    once('Poulet DG', 2)
    expect(() => once('poulet dg', 5)).toThrow(/ligne 2/)
  })

  it('des noms différents passent', () => {
    const once = uniqueInSheet()

    once('Poulet DG', 2)
    expect(() => once('Riz', 3)).not.toThrow()
  })
})

describe('borne haute des montants', () => {
  it('refuse un prix au-delà du maximum serveur', () => {
    expect(() => numberField(record({ prix: '100000000' }), 'prix', 'Prix', { max: 99_999_999.99 })).toThrow(/ne peut pas dépasser/)
  })

  it('accepte le maximum lui-même', () => {
    expect(numberField(record({ prix: '99999999.99' }), 'prix', 'Prix', { max: 99_999_999.99 })).toBe(99_999_999.99)
  })
})
