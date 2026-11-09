import { describe, expect, it } from 'vitest'
import { zonedLayout } from './useFloorPlan'

const ids = (zone: string, n: number) => Array.from({ length: n }, (_, i) => ({ id: `${zone}${i + 1}`, zone }))

describe('disposition automatique par zones', () => {
  it('place chaque zone dans ses propres rangées', () => {
    const { layout, rows } = zonedLayout([...ids('A', 4), ...ids('B', 3)])
    const yOf = (zone: string, n: number) => new Set(Array.from({ length: n }, (_, i) => layout[`${zone}${i + 1}`].y))

    const zoneA = [...yOf('A', 4)]
    const zoneB = [...yOf('B', 3)]

    expect(rows).toBeCloseTo(2.7)
    expect(zoneA.every(y => !zoneB.includes(y))).toBe(true)
    expect(Math.max(...zoneA)).toBeLessThan(Math.min(...zoneB))
  })

  it('positionne toutes les tables, dans les marges du plan', () => {
    const list = [...ids('Salle', 9), ...ids('Terrasse', 5)]
    const { layout } = zonedLayout(list)

    expect(Object.keys(layout)).toHaveLength(14)

    for (const point of Object.values(layout)) {
      expect(point.x).toBeGreaterThan(0)
      expect(point.x).toBeLessThan(100)
      expect(point.y).toBeGreaterThan(0)
      expect(point.y).toBeLessThan(100)
    }
  })

  it('ne superpose jamais deux tables', () => {
    const { layout } = zonedLayout([...ids('A', 7), ...ids('B', 6), ...ids('C', 2)])
    const keys = Object.values(layout).map(p => `${p.x}:${p.y}`)

    expect(new Set(keys).size).toBe(keys.length)
  })

  it('reste valide sans table ni zone unique', () => {
    expect(zonedLayout([]).layout).toEqual({})
    expect(zonedLayout(ids('Salle', 3)).rows).toBeGreaterThanOrEqual(1)
  })
})
