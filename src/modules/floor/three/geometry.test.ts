import { describe, expect, it } from 'vitest'
import { LEVEL_D, LEVEL_GAP, LEVEL_W, chairPlacements, fitDistance, framing, isPortrait, levelElevation, pctToMeters, seatsNote, stateKey, structureKey, tableSize, visibleLevels, zoneRect } from './geometry'
import type { Scene3DLevel } from './sceneTypes'

const level = (id: string, state: 'free' | 'busy' = 'free', taken = 0): Scene3DLevel => ({
  id,
  name: id,
  zones: [{ name: 'Salle', type: 'salle', x: 0, y: 0, w: 50, h: 100 }],
  tables: [{ id: `${id}-t1`, numero: 'T1', state, shape: 'round', x: 50, y: 50, capacity: 4, taken }],
})

describe('plan → mètres', () => {
  it('centre la dalle', () => {
    expect(pctToMeters(50, 50)).toEqual({ x: 0, z: 0 })
    expect(pctToMeters(0, 0)).toEqual({ x: -LEVEL_W / 2, z: -LEVEL_D / 2 })
    expect(pctToMeters(100, 100)).toEqual({ x: LEVEL_W / 2, z: LEVEL_D / 2 })
  })

  it('borne les pourcentages hors plan', () => {
    expect(pctToMeters(-20, 140)).toEqual({ x: -LEVEL_W / 2, z: LEVEL_D / 2 })
  })

  it('convertit un rectangle de zone', () => {
    const r = zoneRect({ x: 0, y: 0, w: 50, h: 100 })

    expect(r.w).toBeCloseTo(LEVEL_W / 2)
    expect(r.d).toBeCloseTo(LEVEL_D)
    expect(r.cx).toBeCloseTo(-LEVEL_W / 4)
    expect(r.cz).toBeCloseTo(0)
  })

  it('ne dépasse jamais le plan', () => {
    const r = zoneRect({ x: 80, y: 80, w: 60, h: 60 })

    expect(r.cx + r.w / 2).toBeCloseTo(LEVEL_W / 2)
    expect(r.cz + r.d / 2).toBeCloseTo(LEVEL_D / 2)
  })
})

describe('dimensions des tables', () => {
  it('rond : 0,9 à 1,5 m selon la capacité', () => {
    expect(tableSize('round', 1).w).toBeCloseTo(0.9)
    expect(tableSize('round', 4).w).toBeCloseTo(1.2)
    expect(tableSize('round', 12).w).toBe(1.5)
  })

  it('carré 1,1 m, rectangle 1,8 à 2,8 m sur 0,9 m', () => {
    expect(tableSize('square', 4)).toEqual({ w: 1.1, d: 1.1 })
    expect(tableSize('rect', 4)).toEqual({ w: 1.8, d: 0.9 })
    expect(tableSize('rect', 12).w).toBe(2.8)
    expect(tableSize('rect', 2).w).toBe(1.8)
  })
})

describe('chaises', () => {
  it.each(['round', 'square', 'rect'] as const)('une chaise par place (%s)', shape => {
    for (const capacity of [1, 2, 4, 6, 8, 12])
      expect(chairPlacements(shape, capacity)).toHaveLength(capacity)
  })

  it('plafonne à 12 chaises', () => {
    expect(chairPlacements('rect', 30)).toHaveLength(12)
  })

  it('les chaises sont hors de la table et regardent son centre', () => {
    for (const shape of ['round', 'square', 'rect'] as const) {
      const { w, d } = tableSize(shape, 6)

      for (const chair of chairPlacements(shape, 6)) {
        const outside = Math.abs(chair.x) > w / 2 - 0.01 || Math.abs(chair.z) > d / 2 - 0.01

        expect(outside).toBe(true)

        // L'avant (+z local après rotation y) pointe vers l'origine.
        const front = { x: Math.sin(chair.ry), z: Math.cos(chair.ry) }
        const toCenter = { x: -chair.x, z: -chair.z }
        const len = Math.hypot(toCenter.x, toCenter.z)

        expect((front.x * toCenter.x + front.z * toCenter.z) / len).toBeCloseTo(1, 5)
      }
    }
  })

  it('remplit les côtés en alternance', () => {
    const [first, second] = chairPlacements('rect', 4)

    expect(Math.sign(first.z)).toBe(-1)
    expect(Math.sign(second.z)).toBe(1)
  })
})

describe('étages', () => {
  it('empile les niveaux', () => {
    expect(levelElevation(0)).toBe(0)
    expect(levelElevation(2)).toBe(2 * LEVEL_GAP)
  })

  it('écarte les niveaux au-dessus du niveau mis en avant', () => {
    expect(levelElevation(0, 1)).toBe(0)
    expect(levelElevation(1, 1)).toBe(LEVEL_GAP)
    expect(levelElevation(2, 1)).toBeGreaterThan(2 * LEVEL_GAP)
  })

  it('choisit les niveaux à dessiner', () => {
    const levels = [level('a'), level('b'), level('c')]

    expect(visibleLevels(levels, 'building', null).map(l => l.id)).toEqual(['a', 'b', 'c'])
    expect(visibleLevels(levels, 'level', 'b').map(l => l.id)).toEqual(['b'])
    expect(visibleLevels(levels, 'level', 'zzz').map(l => l.id)).toEqual(['a'])
    expect(visibleLevels([], 'level', null)).toEqual([])
  })
})

describe('cadrage', () => {
  it('s\'éloigne quand l\'écran est étroit', () => {
    expect(fitDistance(16, 9, 40, 0.5)).toBeGreaterThan(fitDistance(16, 9, 40, 2))
  })

  it('cadre l\'immeuble plus loin et plus haut qu\'un niveau', () => {
    const one = framing(3, 'level', 40, 1.6, true)
    const all = framing(3, 'building', 40, 1.6, true)

    expect(all.distance).toBeGreaterThan(one.distance)
    expect(all.target.y).toBeGreaterThan(one.target.y)
  })
})

describe('écran en portrait', () => {
  it('détecte un écran plus haut que large', () => {
    expect(isPortrait(0.5)).toBe(true)
    expect(isPortrait(1.6)).toBe(false)
  })

  it('cadre la salle par son petit côté : plus près qu\'en paysage sur le même écran', () => {
    const asLandscape = fitDistance(LEVEL_W / 2, LEVEL_D / 2, 40, 0.5)
    const portrait = framing(1, 'level', 40, 0.5, false)

    expect(portrait.distance).toBeLessThan(asLandscape)
  })
})

describe('clés de comparaison', () => {
  it('un changement d\'état ne reconstruit pas la scène', () => {
    const before = [level('a', 'free', 0)]
    const after = [level('a', 'busy', 2)]

    expect(structureKey(before, 'level', 'a')).toBe(structureKey(after, 'level', 'a'))
    expect(stateKey(before)).not.toBe(stateKey(after))
  })

  it('déplacer une table reconstruit', () => {
    const moved = [level('a')]

    moved[0].tables[0].x = 60

    expect(structureKey([level('a')], 'level', 'a')).not.toBe(structureKey(moved, 'level', 'a'))
  })

  it('changer de mode ou de niveau reconstruit', () => {
    expect(structureKey([level('a')], 'level', 'a')).not.toBe(structureKey([level('a')], 'building', 'a'))
    expect(structureKey([level('a'), level('b')], 'level', 'a')).not.toBe(structureKey([level('a'), level('b')], 'level', 'b'))
  })
})

describe('étiquette des places', () => {
  it('annonce les places libres d\'une table occupée', () => {
    expect(seatsNote({ capacity: 4, taken: 2, state: 'busy' })).toBe('2 libres')
    expect(seatsNote({ capacity: 4, taken: 3, state: 'busy' })).toBe('1 libre')
    expect(seatsNote({ capacity: 4, taken: 4, state: 'paying' })).toBe('complète')
  })

  it('reste muette pour une table libre ou sans couverts connus', () => {
    expect(seatsNote({ capacity: 4, taken: 0, state: 'free' })).toBe('')
    expect(seatsNote({ capacity: 4, taken: 0, state: 'busy' })).toBe('')
  })
})
