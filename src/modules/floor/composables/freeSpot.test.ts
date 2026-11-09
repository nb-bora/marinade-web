import { describe, expect, it } from 'vitest'
import type { ServiceSession, Table, TableView } from '../types'
import { freeSpot, positionsOf } from './useFloorPlan'

function view(numero: string, x?: number, y?: number): TableView {
  const table = { id: `t-${numero}`, numero, capacite: 4, statut: 'libre', emplacement: 'Salle', attributs_jsonb: x === undefined ? null : { plan: { niveau: 'rdc', x, y } } } as unknown as Table

  return { table, session: null as ServiceSession | null, covers: null, total: null, amountDue: null }
}

describe('premier emplacement libre d\'un niveau', () => {
  it('trouve de la place sans jamais poser la table sur une autre', () => {
    const placed = [view('T1', 20, 30), view('T2', 40, 30), view('T3', 60, 30), view('T4', 80, 30)]
    const spot = freeSpot(placed)

    for (const other of [[20, 30], [40, 30], [60, 30], [80, 30]])
      expect(Math.hypot(spot.x - other[0], (spot.y - other[1]) * 1.4)).toBeGreaterThan(8)
  })

  it('ne déplace aucune table existante', () => {
    const before = positionsOf([view('T1', 20, 30), view('T2', 40, 30)])

    freeSpot([view('T1', 20, 30), view('T2', 40, 30)])
    expect(positionsOf([view('T1', 20, 30), view('T2', 40, 30)])).toEqual(before)
  })

  it('donne un emplacement dans le plan pour un niveau vide', () => {
    const spot = freeSpot([])

    expect(spot.x).toBeGreaterThan(0)
    expect(spot.x).toBeLessThan(100)
    expect(spot.y).toBeGreaterThan(0)
    expect(spot.y).toBeLessThan(100)
  })

  it('tient compte des tables qui n\'ont pas encore d\'emplacement enregistré', () => {
    const loose = [view('A'), view('B'), view('C')]
    const shown = Object.values(positionsOf(loose))
    const spot = freeSpot(loose)

    for (const point of shown)
      expect(point.x !== spot.x || point.y !== spot.y).toBe(true)
  })
})
