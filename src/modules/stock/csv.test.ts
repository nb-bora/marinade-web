import { describe, expect, it } from 'vitest'
import { toCsv } from './csv'

describe('toCsv', () => {
  it('sépare par « ; » et entoure de guillemets ce qui en contient', () => {
    expect(toCsv(['A', 'B'], [['riz; long', 'dit "bon"']])).toBe('A;B\r\n"riz; long";"dit ""bon"""')
  })

  it('garde les nombres français intacts, négatifs compris', () => {
    expect(toCsv(['Q'], [['2,5'], ['-3'], [4]])).toBe('Q\r\n2,5\r\n-3\r\n4')
  })

  it('neutralise une cellule qui commencerait une formule Excel', () => {
    const [, ...rows] = toCsv(['Nom'], [['=SOMME(A1)'], ['+33 6 00'], ['@cmd'], ['-cmd']]).split('\r\n')

    expect(rows).toEqual(['\'=SOMME(A1)', '\'+33 6 00', '\'@cmd', '\'-cmd'])
  })
})
