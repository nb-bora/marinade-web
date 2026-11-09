import { describe, expect, it } from 'vitest'
import { buildAttributes, formeOf, placementOf } from './layout'
import type { Table } from './types'

const table = (attributs: Record<string, unknown> | null = null) => ({ id: 't1', numero: 'T1', capacite: 4, statut: 'libre', emplacement: null, attributs_jsonb: attributs }) as unknown as Table

describe('forme d\'une table', () => {
  it('lit la forme du plan, même sans emplacement enregistré', () => {
    expect(formeOf(table({ plan: { forme: 'round' } }))).toBe('round')
    expect(placementOf(table({ plan: { forme: 'round' } }))).toBeNull()
  })

  it('comprend l\'ancienne clé « forme » écrite par les imports Excel', () => {
    expect(formeOf(table({ forme: 'rond' }))).toBe('round')
    expect(formeOf(table({ forme: 'Rectangle' }))).toBe('rect')
    expect(formeOf(table({ forme: 'carré' }))).toBe('square')
  })

  it('préfère le plan à l\'ancienne clé, et ignore ce qu\'elle ne connaît pas', () => {
    expect(formeOf(table({ forme: 'rond', plan: { forme: 'square' } }))).toBe('square')
    expect(formeOf(table({ forme: 'hexagone' }))).toBeUndefined()
    expect(formeOf(table())).toBeUndefined()
  })

  it('transmet la forme avec l\'emplacement', () => {
    expect(placementOf(table({ plan: { niveau: 'rdc', x: 10, y: 20, forme: 'rect' } }))?.forme).toBe('rect')
    expect(placementOf(table({ forme: 'rond', plan: { niveau: 'rdc', x: 10, y: 20 } }))?.forme).toBe('round')
  })
})

describe('attributs d\'une table', () => {
  it('change le niveau et la position sans toucher au service en cours', () => {
    const next = buildAttributes({ service: { session_id: 's1', covers: 2 }, plan: { niveau: 'rdc', x: 1, y: 2, rot: 30 } }, { niveau: 'e1', spot: { x: 33.33, y: 44.44 } })

    expect(next).toEqual({ service: { session_id: 's1', covers: 2 }, plan: { niveau: 'e1', x: 33.3, y: 44.4, rot: 30 } })
  })

  it('écrit une forme sans emplacement et retire l\'ancienne clé', () => {
    expect(buildAttributes({ forme: 'rond' }, { forme: 'square' })).toEqual({ plan: { forme: 'square' } })
    expect(buildAttributes(null, { forme: 'round' })).toEqual({ plan: { forme: 'round' } })
  })

  it('efface la forme quand on passe null, et le plan s\'il ne reste rien', () => {
    expect(buildAttributes({ plan: { forme: 'round' }, autre: 1 }, { forme: null })).toEqual({ autre: 1 })
    expect(buildAttributes({ plan: { niveau: 'rdc', x: 1, y: 2, forme: 'round' } }, { forme: null })).toEqual({ plan: { niveau: 'rdc', x: 1, y: 2 } })
  })

  it('ne modifie pas l\'objet reçu et tolère l\'absence d\'attributs', () => {
    const current = { plan: { niveau: 'rdc', x: 1, y: 2 } }

    buildAttributes(current, { niveau: 'e1' })
    expect(current.plan.niveau).toBe('rdc')
    expect(buildAttributes(undefined, {})).toEqual({})
  })
})
