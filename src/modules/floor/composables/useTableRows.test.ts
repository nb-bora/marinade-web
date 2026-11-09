import { describe, expect, it } from 'vitest'
import type { SalleConfig } from '../layout'
import type { ServiceSession, Table, TableView } from '../types'
import { buildRows, filterRows, sortRows, stateCounts, tableTotals } from './useTableRows'

const NOW = new Date('2026-11-06T14:00:00Z')
const ago = (minutes: number) => new Date(NOW.getTime() - minutes * 60000).toISOString()

const salle: SalleConfig = {
  version: 1,
  niveaux: [{ id: 'rdc', nom: 'Rez-de-chaussée' }, { id: 'e1', nom: 'Étage 1' }],
  zones: [{ nom: 'Salon VIP', type: 'vip', niveau: 'e1' }, { nom: 'Jardin', type: 'terrasse', niveau: 'rdc' }],
}

function view(numero: string, opts: { cap?: number; zone?: string; level?: string; status?: string; session?: { minutes: number; state?: string }; covers?: number | null } = {}): TableView {
  const table = {
    id: `t-${numero}`,
    numero,
    capacite: opts.cap ?? 4,
    statut: opts.status ?? 'libre',
    emplacement: opts.zone ?? null,
    attributs_jsonb: opts.level ? { plan: { niveau: opts.level, x: 10, y: 10 } } : null,
  } as unknown as Table

  const session = opts.session ? { id: `s-${numero}`, status: opts.session.state ?? 'ACTIVE', opened_at: ago(opts.session.minutes) } as unknown as ServiceSession : null

  return { table, session, covers: opts.covers ?? null, total: null, amountDue: null }
}

const views = [
  view('T10', { zone: 'Salle' }),
  view('T2', { zone: 'Salle', status: 'occupee', session: { minutes: 30 }, covers: 3 }),
  view('T1', { zone: 'Salle', status: 'occupee', session: { minutes: 130, state: 'PAYMENT_PENDING' }, covers: 4 }),
  view('J1', { zone: 'Jardin', cap: 6 }),
  view('V1', { zone: 'Salon VIP', cap: 8, status: 'occupee' }),
  view('M1', { zone: 'Salle', status: 'maintenance' }),
  view('R1', { zone: 'Salle', status: 'reservee' }),
]

const rows = buildRows(views, salle, NOW)
const byNumero = (list: typeof rows) => list.map(row => row.numero)

describe('lignes de la liste', () => {
  it('reprend l\'état du plan, la zone, le niveau et la durée de chaque table', () => {
    const t2 = rows.find(row => row.numero === 'T2')!

    expect(t2).toMatchObject({ state: 'busy', zone: 'Salle', levelId: 'rdc', levelName: 'Rez-de-chaussée', covers: 3, free: 1, minutes: 30, tone: 'ok' })
    expect(rows.find(row => row.numero === 'T1')).toMatchObject({ state: 'paying', minutes: 130, tone: 'late' })
    expect(rows.find(row => row.numero === 'M1')).toMatchObject({ state: 'maintenance', minutes: null, tone: null })
    expect(rows.find(row => row.numero === 'V1')).toMatchObject({ state: 'settled' })
  })

  it('range une table sur le niveau de sa zone quand elle n\'a pas d\'emplacement enregistré', () => {
    expect(rows.find(row => row.numero === 'V1')).toMatchObject({ levelId: 'e1', levelName: 'Étage 1', zoneType: 'vip' })
    expect(rows.find(row => row.numero === 'J1')).toMatchObject({ levelId: 'rdc', zoneType: 'terrasse' })
  })

  it('compte les places libres d\'une table servie, jamais en dessous de zéro', () => {
    expect(rows.find(row => row.numero === 'T1')!.free).toBe(0)
    expect(buildRows([view('X', { cap: 2, status: 'occupee', session: { minutes: 5 }, covers: 9 })], salle, NOW)[0].free).toBe(0)
  })
})

describe('filtres', () => {
  const none = { query: '', state: null, zone: null, level: null }

  it('cherche dans le numéro, la zone et le niveau sans tenir compte des accents ni de la casse', () => {
    expect(byNumero(filterRows(rows, { ...none, query: 'etage' }))).toEqual(['V1'])
    expect(byNumero(filterRows(rows, { ...none, query: 'JARDIN' }))).toEqual(['J1'])
    expect(byNumero(filterRows(rows, { ...none, query: 't1' }))).toEqual(['T10', 'T1'])
  })

  it('filtre par état, par zone et par niveau, et cumule les filtres', () => {
    expect(byNumero(filterRows(rows, { ...none, state: 'busy' }))).toEqual(['T2'])
    expect(byNumero(filterRows(rows, { ...none, zone: 'salle' })).sort()).toEqual(['M1', 'R1', 'T1', 'T10', 'T2'])
    expect(byNumero(filterRows(rows, { ...none, level: 'e1' }))).toEqual(['V1'])
    expect(filterRows(rows, { ...none, zone: 'Salle', state: 'free' }).map(row => row.numero)).toEqual(['T10'])
  })

  it('compte les états sans le filtre d\'état, pour que les pastilles restent lisibles', () => {
    const scoped = filterRows(rows, { ...none, zone: 'Salle', state: 'busy' }, 'state')

    expect(stateCounts(scoped)).toEqual({ free: 1, busy: 1, paying: 1, reserved: 1, settled: 0, maintenance: 1 })
  })
})

describe('tri', () => {
  it('trie les numéros dans l\'ordre naturel (T2 avant T10)', () => {
    expect(byNumero(sortRows(rows, 'numero', 'asc')).slice(0, 4)).toEqual(['J1', 'M1', 'R1', 'T1'])
    expect(byNumero(sortRows(rows, 'numero', 'asc')).indexOf('T2')).toBeLessThan(byNumero(sortRows(rows, 'numero', 'asc')).indexOf('T10'))
  })

  it('trie par niveau puis zone puis numéro', () => {
    expect(byNumero(sortRows(rows, 'zone', 'asc'))).toEqual(['J1', 'M1', 'R1', 'T1', 'T2', 'T10', 'V1'])
  })

  it('met d\'abord ce qui demande un geste quand on trie par état', () => {
    expect(byNumero(sortRows(rows, 'etat', 'asc')).slice(0, 3)).toEqual(['T1', 'T2', 'V1'])
  })

  it('trie par places et par durée, dans les deux sens', () => {
    expect(byNumero(sortRows(rows, 'places', 'desc'))[0]).toBe('V1')
    expect(byNumero(sortRows(rows, 'duree', 'desc')).slice(0, 2)).toEqual(['T1', 'T2'])
    expect(byNumero(sortRows(rows, 'duree', 'asc')).slice(-2)).toEqual(['T2', 'T1'])
  })

  it('ne modifie jamais la liste d\'origine', () => {
    const before = byNumero(rows)

    sortRows(rows, 'numero', 'desc')
    expect(byNumero(rows)).toEqual(before)
  })
})

describe('totaux', () => {
  it('calcule tables, places, places disponibles, zones et niveaux', () => {
    expect(tableTotals(rows, salle)).toEqual({
      tables: 7,
      seats: 4 + 4 + 4 + 6 + 8 + 4 + 4,

      // T10 libre (4) + T2 (4 - 3) + T1 en paiement (0 libre) ; les autres ne reçoivent personne
      available: 4 + 1 + 0 + 6,
      zones: 3,
      levels: 2,
      serving: 2,
      occupancy: 29,
      attention: 2,
    })
  })

  it('reste valide sans aucune table', () => {
    expect(tableTotals([], salle)).toMatchObject({ tables: 0, seats: 0, available: 0, occupancy: 0, attention: 0, levels: 2 })
  })
})
