import { describe, expect, it } from 'vitest'
import type { SalleConfig } from '../layout'
import type { ServiceSession, Table, TableView } from '../types'
import { buildScene3D } from './scene3d'

const salle: SalleConfig = {
  version: 1,
  niveaux: [{ id: 'rdc', nom: 'Rez-de-chaussée' }, { id: 'e1', nom: 'Étage 1' }],
  zones: [{ nom: 'Terrasse', type: 'terrasse', niveau: 'rdc' }, { nom: 'Salon VIP', type: 'vip', niveau: 'e1' }],
}

function view(numero: string, over: { cap?: number; zone?: string; plan?: Record<string, unknown>; covers?: number | null; session?: boolean; statut?: string } = {}): TableView {
  const table = { id: `t-${numero}`, numero, capacite: over.cap ?? 4, statut: over.statut ?? 'libre', emplacement: over.zone ?? null, attributs_jsonb: over.plan ? { plan: over.plan } : null } as unknown as Table

  return { table, session: over.session ? { id: `s-${numero}`, status: 'ACTIVE' } as unknown as ServiceSession : null, covers: over.covers ?? null, total: null, amountDue: null }
}

describe('scène 3D', () => {
  const views = [
    view('T1', { zone: 'Terrasse', plan: { niveau: 'rdc', x: 20, y: 30 }, session: true, covers: 3, statut: 'occupee' }),
    view('T2', { zone: 'Terrasse', plan: { niveau: 'rdc', x: 40, y: 30, forme: 'round', rot: 45 } }),
    view('V1', { cap: 8, zone: 'Salon VIP', plan: { niveau: 'e1', x: 50, y: 50 } }),
  ]

  it('range chaque table sur son niveau, avec une scène par niveau', () => {
    const levels = buildScene3D(views, salle)

    expect(levels.map(level => [level.id, level.tables.map(table => table.numero)])).toEqual([['rdc', ['T1', 'T2']], ['e1', ['V1']]])
  })

  it('reprend l\'état, les couverts, la forme et la rotation de la table', () => {
    const [rdc] = buildScene3D(views, salle)
    const [t1, t2] = rdc.tables

    expect(t1).toMatchObject({ state: 'busy', taken: 3, capacity: 4, shape: 'square', x: 20, y: 30 })
    expect(t2).toMatchObject({ state: 'free', taken: 0, shape: 'round', rot: 45 })
  })

  it('ne compte jamais plus de couverts que de places', () => {
    const scene = buildScene3D([view('T9', { cap: 2, session: true, covers: 7, statut: 'occupee', plan: { niveau: 'rdc', x: 10, y: 10 } })], salle)

    expect(scene[0].tables[0].taken).toBe(2)
  })

  it('enveloppe les tables d\'une zone dans un rectangle typé', () => {
    const [rdc, e1] = buildScene3D(views, salle)
    const [zone] = rdc.zones

    expect(zone).toMatchObject({ name: 'Terrasse', type: 'terrasse' })
    expect(zone.x).toBeLessThanOrEqual(20)
    expect(zone.x + zone.w).toBeGreaterThanOrEqual(40)
    expect(e1.zones[0]).toMatchObject({ name: 'Salon VIP', type: 'vip' })
    expect(e1.zones[0].w).toBeGreaterThanOrEqual(8)
  })

  it('range automatiquement les tables qui n\'ont pas d\'emplacement, sans les superposer', () => {
    const scene = buildScene3D([view('A'), view('B'), view('C'), view('D')], salle)
    const points = scene[0].tables.map(table => `${table.x}:${table.y}`)

    expect(new Set(points).size).toBe(4)
  })

  it('reste valide sans aucune table', () => {
    expect(buildScene3D([], salle).map(level => level.tables.length)).toEqual([0, 0])
  })
})
