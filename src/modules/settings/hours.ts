/**
 * Horaires d'ouverture : conversion entre l'objet `horaires_ouverture` du restaurant (JSON libre
 * côté serveur) et la semaine que l'éditeur manipule.
 *
 * Forme écrite, compatible avec le guide du back (`ouverture`, `fermeture`, `actif`) :
 *
 *   {
 *     "lundi":  { "actif": true,  "ouverture": "11:00", "fermeture": "22:30",
 *                 "plages": [ { "ouverture": "11:00", "fermeture": "15:00" },
 *                             { "ouverture": "18:00", "fermeture": "22:30" } ] },
 *     "mardi":  { "actif": false, "ouverture": "08:00", "fermeture": "22:00", "plages": [] },
 *     ...
 *   }
 *
 * - `plages` liste toutes les plages du jour (service du midi, service du soir...), triées.
 * - `ouverture` / `fermeture` reprennent le début de la première plage et la fin de la dernière,
 *   pour les lecteurs qui ne connaissent que la forme simple.
 * - Une `fermeture` antérieure à l'`ouverture` signifie « après minuit » (ex. 18:00 → 02:00).
 * - Un jour absent ou `actif: false` est fermé. Les clés inconnues de l'objet sont conservées.
 */

export const DAYS = [
  { key: 'lundi', label: 'Lundi' },
  { key: 'mardi', label: 'Mardi' },
  { key: 'mercredi', label: 'Mercredi' },
  { key: 'jeudi', label: 'Jeudi' },
  { key: 'vendredi', label: 'Vendredi' },
  { key: 'samedi', label: 'Samedi' },
  { key: 'dimanche', label: 'Dimanche' },
] as const

export type DayKey = typeof DAYS[number]['key']

export interface TimeRange {
  ouverture: string
  fermeture: string
}

export interface DaySchedule {
  actif: boolean
  plages: TimeRange[]
}

export type WeekSchedule = Record<DayKey, DaySchedule>

export const DEFAULT_RANGE: TimeRange = { ouverture: '08:00', fermeture: '22:00' }

const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isTime = (value: unknown): value is string => typeof value === 'string' && TIME.test(value)

const copyRanges = (ranges: TimeRange[]) => ranges.map(range => ({ ...range }))

function rangesOf(day: Record<string, unknown>): TimeRange[] {
  if (Array.isArray(day.plages)) {
    return day.plages.flatMap(range =>
      isRecord(range) && isTime(range.ouverture) && isTime(range.fermeture)
        ? [{ ouverture: range.ouverture, fermeture: range.fermeture }]
        : [])
  }

  if (isTime(day.ouverture) && isTime(day.fermeture))
    return [{ ouverture: day.ouverture, fermeture: day.fermeture }]

  return []
}

export function parseWeek(raw: unknown): WeekSchedule {
  const source = isRecord(raw) ? raw : {}
  const week = {} as WeekSchedule

  for (const { key } of DAYS) {
    const day = isRecord(source[key]) ? source[key] : null
    const plages = day ? rangesOf(day) : []

    week[key] = {
      actif: day !== null && day.actif !== false && plages.length > 0,
      plages: plages.length ? plages : [{ ...DEFAULT_RANGE }],
    }
  }

  return week
}

const byOpening = (a: TimeRange, b: TimeRange) => a.ouverture.localeCompare(b.ouverture)

/** Objet à envoyer au serveur ; `previous` fournit les clés étrangères à conserver. */
export function serializeWeek(week: WeekSchedule, previous: unknown): Record<string, unknown> {
  const result: Record<string, unknown> = isRecord(previous) ? { ...previous } : {}

  for (const { key } of DAYS) {
    const day = week[key]
    const plages = copyRanges(day.plages).sort(byOpening)
    const first = plages[0] ?? DEFAULT_RANGE
    const last = plages.at(-1) ?? DEFAULT_RANGE

    result[key] = {
      actif: day.actif,
      ouverture: first.ouverture,
      fermeture: last.fermeture,
      plages: day.actif ? plages : [],
    }
  }

  return result
}

const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3))

/** Message d'erreur pour un jour ouvert dont les plages sont incomplètes ou se chevauchent. */
export function dayError(day: DaySchedule): string {
  if (!day.actif)
    return ''

  if (day.plages.length === 0)
    return 'Ajoutez au moins une plage horaire.'

  for (const range of day.plages) {
    if (!isTime(range.ouverture) || !isTime(range.fermeture))
      return 'Renseignez l\'heure d\'ouverture et de fermeture.'

    if (range.ouverture === range.fermeture)
      return 'L\'ouverture et la fermeture doivent être différentes.'
  }

  return ''
}

/**
 * Avertissement (non bloquant) pour un jour dont les plages se chevauchent. Une plage qui
 * passe minuit (fermeture avant ouverture) suivie d'une autre plage est aussi signalée.
 */
export function dayWarning(day: DaySchedule): string {
  if (!day.actif || dayError(day))
    return ''

  const sorted = copyRanges(day.plages).sort(byOpening)

  for (let index = 1; index < sorted.length; index++) {
    const previous = sorted[index - 1]
    const overnight = toMinutes(previous.fermeture) <= toMinutes(previous.ouverture)

    if (overnight || toMinutes(previous.fermeture) > toMinutes(sorted[index].ouverture))
      return 'Ces plages se chevauchent : vérifiez les heures avant d’enregistrer.'
  }

  return ''
}

/** Vrai si la plage se termine le lendemain (fermeture avant l'ouverture). */
export const crossesMidnight = (range: TimeRange) =>
  isTime(range.ouverture) && isTime(range.fermeture) && toMinutes(range.fermeture) < toMinutes(range.ouverture)

/** Horaires proposés par « Réinitialiser » : midi et soir, tous les jours. */
export function defaultWeek(): WeekSchedule {
  const week = {} as WeekSchedule

  for (const { key } of DAYS) {
    week[key] = {
      actif: true,
      plages: [{ ouverture: '09:00', fermeture: '12:00' }, { ouverture: '14:00', fermeture: '20:00' }],
    }
  }

  return week
}

/** « 11:00 – 15:00 + 18:00 – 22:30 » ou « Fermé ». */
export function summarizeDay(day: DaySchedule): string {
  if (!day.actif)
    return 'Fermé'

  return copyRanges(day.plages)
    .sort(byOpening)
    .map(range => `${range.ouverture} – ${range.fermeture}`)
    .join(' + ')
}
