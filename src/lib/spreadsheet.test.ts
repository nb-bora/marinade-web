import { expect, it } from 'vitest'
import { mapSheet, normalizeKey, parseBoolean, parseCsv, parseDecimal } from './spreadsheet'

it('lit un CSV français entre guillemets, avec BOM', () => {
  const rows = parseCsv('﻿Nom;Prix\r\n"Poulet; braisé";"2 500,5"\r\n\r\nSoda;500\r\n')

  expect(rows).toEqual([['Nom', 'Prix'], ['Poulet; braisé', '2 500,5'], ['Soda', '500']])
})

it('compare des en-têtes sans accents ni casse', () => {
  expect(normalizeKey('  Unité de Mesure ')).toBe('unite_de_mesure')
})

it('lit les nombres et booléens saisis à la française', () => {
  expect(parseDecimal('1 200,5')).toBe(1200.5)
  expect(parseDecimal('abc')).toBeNull()
  expect(parseBoolean('Oui')).toBe(true)
  expect(parseBoolean('non')).toBe(false)
  expect(parseBoolean('peut-être')).toBeNull()
})

it('rattache les colonnes attendues et signale celles qui manquent', () => {
  const sheet = { name: 'Plats', rows: [['PRIX', 'Nom'], ['1500', 'Ndolé'], ['', '']] }
  const columns = [{ key: 'nom', label: 'Nom', required: true }, { key: 'prix', label: 'Prix', required: true }, { key: 'tag', label: 'Tag', required: true }]
  const mapped = mapSheet(sheet, columns)

  expect(mapped.records).toEqual([{ row: 2, values: { nom: 'Ndolé', prix: '1500', tag: '' } }])
  expect(mapped.missingColumns.map(column => column.key)).toEqual(['tag'])
})
