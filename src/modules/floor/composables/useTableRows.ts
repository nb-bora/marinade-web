import type { PlanState } from '../labels'
import type { SalleConfig, ZoneType } from '../layout'
import { freeSeats, levelIdOf, zoneOf, zoneTypeOf } from '../layout'
import type { TableView } from '../types'
import { planStateOf } from './useFloorPlan'
import { elapsedTone, minutesSince } from './useFloorMetrics'
import type { ElapsedTone } from './useFloorMetrics'

/** Une ligne de la liste des tables : tout ce que la page affiche, calculé une fois. */
export interface TableRow {
  id: string
  view: TableView
  numero: string

  /** Même état que sur le plan (libre, occupée, en paiement…) : mêmes mots, mêmes couleurs. */
  state: PlanState
  zone: string
  zoneType: ZoneType
  levelId: string
  levelName: string
  levelIndex: number
  capacity: number

  /** Couverts assis ; `null` sans service ou quand le serveur ne les connaît pas. */
  covers: number | null

  /** Places libres maintenant : la capacité moins les couverts. */
  free: number

  /** Durée de la session en minutes, et son niveau d'attention. */
  minutes: number | null
  tone: ElapsedTone | null
  sessionId: string | null
}

export function buildRows(views: readonly TableView[], salle: SalleConfig, now: Date): TableRow[] {
  return views.map(view => {
    const levelId = levelIdOf(view.table, salle)
    const levelIndex = Math.max(0, salle.niveaux.findIndex(level => level.id === levelId))
    const zone = zoneOf(view.table)
    const minutes = view.session ? minutesSince(view.session.opened_at, now) : null

    return {
      id: view.table.id,
      view,
      numero: view.table.numero,
      state: planStateOf(view),
      zone,
      zoneType: zoneTypeOf(zone, salle),
      levelId,
      levelName: salle.niveaux[levelIndex]?.nom ?? salle.niveaux[0].nom,
      levelIndex,
      capacity: view.table.capacite,
      covers: view.session ? view.covers : null,
      free: freeSeats(view),
      minutes,
      tone: minutes === null ? null : elapsedTone(minutes),
      sessionId: view.session?.id ?? null,
    }
  })
}

// Filtres --------------------------------------------------------------------------------------

export interface RowFilters {
  query: string
  state: PlanState | null
  zone: string | null
  level: string | null
}

const plain = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

/**
 * Applique les filtres. `ignore` écarte un filtre : les effectifs des pastilles d'état se calculent sans
 * le filtre d'état lui-même, pour montrer combien de tables il y a dans chaque état.
 */
export function filterRows(rows: readonly TableRow[], filters: RowFilters, ignore?: 'state'): TableRow[] {
  const query = plain(filters.query.trim())

  return rows.filter(row =>
    (!query || plain(`${row.numero} ${row.zone} ${row.levelName}`).includes(query))
    && (ignore === 'state' || !filters.state || row.state === filters.state)
    && (!filters.zone || row.zone.toLowerCase() === filters.zone.toLowerCase())
    && (!filters.level || row.levelId === filters.level),
  )
}

export function stateCounts(rows: readonly TableRow[]): Record<PlanState, number> {
  const counts: Record<PlanState, number> = { free: 0, busy: 0, paying: 0, reserved: 0, settled: 0, maintenance: 0 }

  for (const row of rows)
    counts[row.state]++

  return counts
}

// Tri ----------------------------------------------------------------------------------------

export type SortKey = 'zone' | 'numero' | 'etat' | 'places' | 'duree'
export type SortDirection = 'asc' | 'desc'

/** Ordre d'urgence des états : ce qui demande un geste d'abord. */
export const STATE_ORDER: readonly PlanState[] = ['paying', 'busy', 'settled', 'reserved', 'free', 'maintenance']

/** Sens par défaut d'une colonne : la durée se lit « plus longue d'abord », le reste de A à Z. */
export const DEFAULT_DIRECTION: Record<SortKey, SortDirection> = { zone: 'asc', numero: 'asc', etat: 'asc', places: 'asc', duree: 'desc' }

const natural = (a: string, b: string) => a.localeCompare(b, 'fr', { numeric: true, sensitivity: 'base' })

const COMPARATORS: Record<SortKey, (a: TableRow, b: TableRow) => number> = {
  numero: (a, b) => natural(a.numero, b.numero),
  zone: (a, b) => a.levelIndex - b.levelIndex || natural(a.zone, b.zone) || natural(a.numero, b.numero),
  etat: (a, b) => STATE_ORDER.indexOf(a.state) - STATE_ORDER.indexOf(b.state) || natural(a.numero, b.numero),
  places: (a, b) => a.capacity - b.capacity || natural(a.numero, b.numero),
  duree: (a, b) => (a.minutes ?? -1) - (b.minutes ?? -1) || natural(a.numero, b.numero),
}

export function sortRows(rows: readonly TableRow[], key: SortKey, direction: SortDirection): TableRow[] {
  const compare = COMPARATORS[key]

  return [...rows].sort((a, b) => direction === 'asc' ? compare(a, b) : compare(b, a))
}

// Totaux -------------------------------------------------------------------------------------

export interface TableTotals {
  tables: number

  /** Capacité totale. */
  seats: number

  /** Places où quelqu'un peut s'asseoir maintenant : tables libres + places restantes des tables servies. */
  available: number
  zones: number
  levels: number

  /** Tables servies (occupées ou en paiement), et part qu'elles représentent. */
  serving: number
  occupancy: number

  /** Tables qui demandent un geste : à libérer ou hors service. */
  attention: number
}

export function tableTotals(rows: readonly TableRow[], salle: SalleConfig): TableTotals {
  let seats = 0
  let available = 0
  let serving = 0
  let attention = 0
  const zones = new Set(salle.zones.map(zone => zone.nom.toLowerCase()))

  for (const row of rows) {
    zones.add(row.zone.toLowerCase())
    seats += row.capacity

    if (row.state === 'free')
      available += row.capacity
    else if ((row.state === 'busy' || row.state === 'paying') && row.covers !== null)
      available += row.free

    if (row.state === 'busy' || row.state === 'paying')
      serving++
    else if (row.state === 'settled' || row.state === 'maintenance')
      attention++
  }

  return {
    tables: rows.length,
    seats,
    available,
    zones: zones.size,
    levels: salle.niveaux.length,
    serving,
    occupancy: rows.length ? Math.round(100 * serving / rows.length) : 0,
    attention,
  }
}
