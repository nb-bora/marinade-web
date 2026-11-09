import { describe, expect, it } from 'vitest'
import type { Ticket } from './types'
import {
  RECALL_WINDOW_MS,
  aggregateByArticle,
  formatElapsed,
  isOpen,
  linesOf,
  longestWaitMs,
  nextAction,
  placeOf,
  recallRemainingMs,
  urgencyOf,
} from './labels'

function ticket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: 't1',
    restaurant_id: 'r1',
    order_id: '0f8e2a10-0000-0000-0000-000000000000',
    station: 'KITCHEN',
    status: 'QUEUED',
    items_jsonb: [],
    created_at: '2026-11-09T10:00:00Z',
    started_at: null,
    ready_at: null,
    served_at: null,
    cancelled_at: null,
    priority: 0,
    course: null,
    table_label: null,
    zone: null,
    ...overrides,
  } as Ticket
}

describe('transitions proposées par état', () => {
  it.each([
    ['QUEUED', 'Commencer', 'IN_PREPARATION'],
    ['IN_PREPARATION', 'Prêt', 'READY'],
    ['READY', 'Servi', 'SERVED'],
  ])('%s propose « %s » vers %s', (status, label, next) => {
    expect(nextAction(ticket({ status: status as Ticket['status'] }))).toMatchObject({ label, next })
  })

  it('ne propose rien pour un ticket servi ou annulé', () => {
    expect(nextAction(ticket({ status: 'SERVED' }))).toBeNull()
    expect(nextAction(ticket({ status: 'CANCELLED' }))).toBeNull()
  })

  it('compte comme « à faire » seulement à préparer et en préparation', () => {
    expect(isOpen(ticket({ status: 'QUEUED' }))).toBe(true)
    expect(isOpen(ticket({ status: 'IN_PREPARATION' }))).toBe(true)
    expect(isOpen(ticket({ status: 'READY' }))).toBe(false)
    expect(isOpen(ticket({ status: 'SERVED' }))).toBe(false)
  })
})

describe('urgence des minuteurs', () => {
  const minutes = (value: number) => value * 60_000

  it('reste neutre avant 10 minutes, passe orange à 10, rouge à 20', () => {
    expect(urgencyOf(0)).toBe('normal')
    expect(urgencyOf(minutes(9) + 59_000)).toBe('normal')
    expect(urgencyOf(minutes(10))).toBe('warning')
    expect(urgencyOf(minutes(19) + 59_000)).toBe('warning')
    expect(urgencyOf(minutes(20))).toBe('alert')
  })

  it('formate la durée écoulée', () => {
    expect(formatElapsed(754_000)).toBe('12:34')
    expect(formatElapsed(3_723_000)).toBe('1:02:03')
    expect(formatElapsed(-5_000)).toBe('00:00')
  })

  it('mesure la plus longue attente parmi les tickets donnés', () => {
    const now = Date.parse('2026-11-09T10:05:00Z')

    expect(longestWaitMs([], now)).toBe(0)
    expect(longestWaitMs([
      ticket({ created_at: '2026-11-09T10:03:00Z' }),
      ticket({ id: 't2', created_at: '2026-11-09T09:55:00Z' }),
    ], now)).toBe(10 * 60_000)
  })
})

describe('rappel', () => {
  it('reste possible pendant 2 minutes après « Servi »', () => {
    const now = Date.parse('2026-11-09T10:00:30Z')

    expect(recallRemainingMs(ticket({ served_at: '2026-11-09T10:00:00Z' }), now)).toBe(RECALL_WINDOW_MS - 30_000)
    expect(recallRemainingMs(ticket({ served_at: '2026-11-09T09:57:00Z' }), now)).toBe(0)
    expect(recallRemainingMs(ticket({ served_at: null }), now)).toBe(0)
  })
})

describe('agrégation par article (tout le service)', () => {
  it('additionne les quantités par nom, les plus demandés d\'abord', () => {
    const tickets = [
      ticket({ items_jsonb: [{ product_name: 'Poulet braisé', quantity: 2, notes: null }, { product_name: 'Frites', quantity: 1, notes: null }] } as Partial<Ticket>),
      ticket({ id: 't2', items_jsonb: [{ product_name: 'Poulet braisé', quantity: 1, notes: 'bien cuit' }] } as Partial<Ticket>),
    ]

    expect(aggregateByArticle(tickets)).toEqual([
      { name: 'Poulet braisé', quantity: 3 },
      { name: 'Frites', quantity: 1 },
    ])
  })

  it('départage les ex æquo par ordre alphabétique', () => {
    const tickets = [ticket({
      items_jsonb: [
        { product_name: 'Riz', quantity: 2, notes: null },
        { product_name: 'Attiéké', quantity: 2, notes: null },
      ],
    } as Partial<Ticket>)]

    expect(aggregateByArticle(tickets).map(item => item.name)).toEqual(['Attiéké', 'Riz'])
  })
})

describe('lignes et lieu d\'un ticket', () => {
  it('tolère les champs absents de items_jsonb et nettoie les notes', () => {
    const lines = linesOf(ticket({
      items_jsonb: [
        { quantity: 2, notes: '  sans sel  ' },
        { product_name: 'Jus', quantity: 'n/a', notes: '' },
      ],
    } as Partial<Ticket>))

    expect(lines).toEqual([
      { name: 'Article', quantity: 2, notes: 'sans sel' },
      { name: 'Jus', quantity: 1, notes: null },
    ])
  })

  it('indique la table et la zone, ou « Sans table »', () => {
    expect(placeOf({ table_label: 'Table 4', zone: 'Terrasse' })).toBe('Table 4 · Terrasse')
    expect(placeOf({ table_label: 'Table 4', zone: null })).toBe('Table 4')
    expect(placeOf({ table_label: null, zone: null })).toBe('Sans table')
  })
})
