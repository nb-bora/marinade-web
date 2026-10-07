import { addDays, startOfDay } from '@/lib/format'

export type RangeId = 'today' | '7d' | '30d' | 'all'

export interface DateRange {
  from?: Date
  to?: Date
}

export const RANGES: { id: RangeId; title: string }[] = [
  { id: 'today', title: 'Aujourd\'hui' },
  { id: '7d', title: '7 jours' },
  { id: '30d', title: '30 jours' },
  { id: 'all', title: 'Tout' },
]

/** Jours à remonter depuis aujourd'hui (inclus) ; « tout » n'a pas de borne. */
const DAYS_BEFORE_TODAY: Partial<Record<RangeId, number>> = { 'today': 0, '7d': -6, '30d': -29 }

/** Bornes d'une période, en heure locale de l'utilisateur (le jour commence à minuit chez lui). */
export function rangeFor(id: RangeId, now: Date = new Date()): DateRange {
  const offset = DAYS_BEFORE_TODAY[id]

  return offset === undefined ? {} : { from: addDays(startOfDay(now), offset) }
}
