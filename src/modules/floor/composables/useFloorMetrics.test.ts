import { describe, expect, it } from 'vitest'
import type { ServiceSession, Table, TableView } from '../types'
import { compactMoney, elapsedTone, floorStats, formatElapsed, minutesSince, watchlist } from './useFloorMetrics'

const NOW = new Date('2026-11-06T14:00:00Z')
const ago = (minutes: number) => new Date(NOW.getTime() - minutes * 60000).toISOString()

function view(numero: string, opts: { status?: string; session?: { minutes: number; state?: string } | null; covers?: number; due?: number; total?: number } = {}): TableView {
  const session = opts.session
    ? { id: `s-${numero}`, status: opts.session.state ?? 'ACTIVE', opened_at: ago(opts.session.minutes) } as unknown as ServiceSession
    : null

  return {
    table: { id: `t-${numero}`, numero, capacite: 4, statut: opts.status ?? 'libre' } as unknown as Table,
    session,
    covers: opts.covers ?? null,
    total: opts.total ?? null,
    amountDue: opts.due ?? null,
  }
}

describe('durées', () => {
  it('formate les durées', () => {
    expect(formatElapsed(0)).toBe('0 min')
    expect(formatElapsed(59)).toBe('59 min')
    expect(formatElapsed(65)).toBe('1 h 05')
    expect(formatElapsed(600)).toBe('10 h 00')
    expect(formatElapsed(3000)).toBe('2 j')
  })

  it('mesure le temps écoulé sans jamais être négatif', () => {
    expect(minutesSince(ago(42), NOW)).toBe(42)
    expect(minutesSince(new Date(NOW.getTime() + 60000).toISOString(), NOW)).toBe(0)
  })

  it('classe l\'attente', () => {
    expect(elapsedTone(30)).toBe('ok')
    expect(elapsedTone(75)).toBe('warn')
    expect(elapsedTone(120)).toBe('late')
  })
})

describe('montants compacts', () => {
  it('abrège pour tenir dans une table', () => {
    expect(compactMoney(950)).toBe('950')
    expect(compactMoney(11925)).toBe('11,9 k')
    expect(compactMoney(250000)).toBe('250 k')
    expect(compactMoney(2_400_000)).toBe('2,4 M')
    expect(compactMoney(null)).toBe('')
  })
})

describe('à surveiller', () => {
  const views = [
    view('T1'),
    view('T2', { status: 'occupee', session: { minutes: 30 }, covers: 2 }),
    view('T3', { status: 'occupee', session: { minutes: 130 }, covers: 4 }),
    view('T4', { status: 'occupee', session: { minutes: 20, state: 'PAYMENT_PENDING' }, due: 8000 }),
    view('T5', { status: 'occupee', session: null }),
    view('T6', { status: 'maintenance' }),
  ]

  it('range les tables par urgence : paiement, à libérer, longues', () => {
    expect(watchlist(views, NOW).map(item => [item.view.table.numero, item.kind])).toEqual([
      ['T4', 'paying'],
      ['T5', 'settled'],
      ['T3', 'long'],
    ])
  })

  it('ignore les tables tranquilles et respecte la limite', () => {
    expect(watchlist(views, NOW, 1)).toHaveLength(1)
    expect(watchlist([view('A'), view('B', { status: 'occupee', session: { minutes: 10 } })], NOW)).toEqual([])
  })
})

describe('indicateurs de la salle', () => {
  it('calcule occupation, couverts, addition et durée moyenne', () => {
    const stats = floorStats([
      view('T1'),
      view('T2', { status: 'occupee', session: { minutes: 30 }, covers: 2, due: 5000 }),
      view('T3', { status: 'occupee', session: { minutes: 90, state: 'PARTIALLY_PAID' }, covers: 4, due: 3000 }),
      view('T4', { status: 'occupee', session: { minutes: 3000 }, covers: 6, due: 1000 }),
      view('T5', { status: 'reservee' }),
    ], [{ amountDue: 2000, session: {} as ServiceSession }], NOW)

    expect(stats).toMatchObject({ total: 5, free: 1, busy: 2, paying: 1, reserved: 1, covers: 12, due: 11000, occupancy: 60 })

    // La session de 3000 min est oubliée : (30 + 90) / 2.
    expect(stats.averageMinutes).toBe(60)
  })

  it('reste cohérent sans table ni session', () => {
    expect(floorStats([], [], NOW)).toMatchObject({ total: 0, occupancy: 0, averageMinutes: null, due: 0 })
  })
})
