import type { ServiceSession, TableView } from '../types'
import { planStateOf } from './useFloorPlan'

/** Une session ouverte depuis plus longtemps est « oubliée » : elle ne compte pas dans les durées moyennes. */
export const STALE_MINUTES = 12 * 60

/** Seuils d'attention d'une table occupée : au-delà de 75 min on surveille, au-delà de 2 h c'est long. */
export const LONG_MINUTES = 75
export const VERY_LONG_MINUTES = 120

export const minutesSince = (iso: string, now: Date) => Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 60000))

/** 12 → « 12 min », 65 → « 1 h 05 », 3000 → « 2 j ». */
export function formatElapsed(minutes: number): string {
  if (minutes < 60)
    return `${minutes} min`

  if (minutes < 48 * 60)
    return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`

  return `${Math.floor(minutes / 1440)} j`
}

export type ElapsedTone = 'ok' | 'warn' | 'late'

export const elapsedTone = (minutes: number): ElapsedTone =>
  minutes >= VERY_LONG_MINUTES ? 'late' : minutes >= LONG_MINUTES ? 'warn' : 'ok'

/** 11925 → « 11,9 k », 950 → « 950 », 2 400 000 → « 2,4 M » : tient dans une table du plan. */
export function compactMoney(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount))
    return ''

  const nf = (value: number, digits: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: digits }).format(value)

  if (amount >= 1_000_000)
    return `${nf(amount / 1_000_000, 1)} M`

  if (amount >= 1000)
    return `${nf(amount / 1000, amount >= 100_000 ? 0 : 1)} k`

  return String(Math.round(amount))
}

export type WatchKind = 'paying' | 'settled' | 'long'

export interface WatchItem {
  view: TableView
  kind: WatchKind
  minutes: number | null
}

/**
 * Les tables qui demandent un geste, par ordre d'urgence : celles en cours de paiement (à encaisser),
 * celles à libérer (addition soldée) puis celles occupées depuis longtemps.
 */
export function watchlist(views: readonly TableView[], now: Date, limit = 8): WatchItem[] {
  const items: WatchItem[] = []

  for (const view of views) {
    const state = planStateOf(view)
    const minutes = view.session ? minutesSince(view.session.opened_at, now) : null

    if (state === 'paying')
      items.push({ view, kind: 'paying', minutes })
    else if (state === 'settled')
      items.push({ view, kind: 'settled', minutes })
    else if (state === 'busy' && minutes !== null && minutes >= LONG_MINUTES)
      items.push({ view, kind: 'long', minutes })
  }

  const rank: Record<WatchKind, number> = { paying: 0, settled: 1, long: 2 }

  return items
    .sort((a, b) => rank[a.kind] - rank[b.kind] || (b.minutes ?? 0) - (a.minutes ?? 0))
    .slice(0, limit)
}

export interface FloorStats {
  total: number
  free: number
  busy: number
  paying: number
  reserved: number
  covers: number
  due: number

  /** Taux d'occupation en % : tables occupées ou en paiement sur le total. */
  occupancy: number

  /** Durée moyenne des sessions du jour (hors sessions oubliées), en minutes ; `null` si aucune. */
  averageMinutes: number | null
}

export function floorStats(
  views: readonly TableView[],
  loose: readonly { amountDue: number | null; session: ServiceSession }[],
  now: Date,
): FloorStats {
  let free = 0
  let busy = 0
  let paying = 0
  let reserved = 0
  let covers = 0
  const durations: number[] = []

  for (const view of views) {
    const state = planStateOf(view)

    if (state === 'free')
      free++
    else if (state === 'busy')
      busy++
    else if (state === 'paying')
      paying++
    else if (state === 'reserved')
      reserved++

    if (view.session) {
      covers += view.covers ?? 0

      const minutes = minutesSince(view.session.opened_at, now)

      if (minutes < STALE_MINUTES)
        durations.push(minutes)
    }
  }

  const due = [...views.map(view => view.amountDue), ...loose.map(item => item.amountDue)]
    .reduce<number>((sum, value) => sum + (value ?? 0), 0)

  return {
    total: views.length,
    free,
    busy,
    paying,
    reserved,
    covers,
    due,
    occupancy: views.length ? Math.round(100 * (busy + paying) / views.length) : 0,
    averageMinutes: durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null,
  }
}
