/**
 * Calendrier des réservations, dans le fuseau du RESTAURANT (et non celui du poste).
 *
 * Une date est un instant absolu (`Date`). Toutes les lectures de jour, d'heure et de semaine
 * passent par `zonedParts`, qui lit l'instant dans le fuseau demandé via Intl. La saisie fait
 * l'inverse : `fromInputs` convertit une date et une heure « murales » du fuseau en instant.
 */

/** Hauteur d'une heure dans la grille horaire, en pixels. */
export const HOUR_PX = 56

export const FUSEAU_PAR_DEFAUT = 'Africa/Douala'

const pad = (value: number) => String(value).padStart(2, '0')

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

export interface ZonedParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number

  /** 0 = lundi … 6 = dimanche. */
  weekdayFromMonday: number
}

const partsFormatters = new Map<string, Intl.DateTimeFormat>()

function partsFormatter(zone: string): Intl.DateTimeFormat {
  let formatter = partsFormatters.get(zone)

  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      weekday: 'short',
    })
    partsFormatters.set(zone, formatter)
  }

  return formatter
}

/** Date, heure et jour de la semaine de l'instant, lus dans le fuseau `zone`. */
export function zonedParts(instant: Date, zone: string): ZonedParts {
  const values = Object.fromEntries(partsFormatter(zone).formatToParts(instant).map(part => [part.type, part.value]))
  const weekday = WEEKDAYS.indexOf(values.weekday as typeof WEEKDAYS[number])

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour) % 24,
    minute: Number(values.minute),
    weekdayFromMonday: (weekday + 6) % 7,
  }
}

/** Décalage (en ms) de `zone` par rapport à UTC, à cet instant. */
function offsetMs(instant: Date, zone: string): number {
  const parts = zonedParts(instant, zone)
  const wall = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute)

  return wall - Math.floor(instant.getTime() / 60_000) * 60_000
}

/** L'instant qui affiche `year-month-day hour:minute` dans le fuseau `zone`. */
export function zonedToInstant(year: number, month: number, day: number, hour: number, minute: number, zone: string): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute)
  const first = offsetMs(new Date(guess), zone)
  let instant = guess - first

  // Un second passage corrige le cas où le décalage change autour de cet instant.
  const second = offsetMs(new Date(instant), zone)

  if (second !== first)
    instant = guess - second

  return new Date(instant)
}

/** `2026-11-14` et `19:00` lus dans le fuseau du restaurant : l'instant correspondant. */
export function fromInputs(date: string, time: string, zone: string): Date {
  const [year, month, day] = date.split('-').map(Number)
  const [hours, minutes] = time.split(':').map(Number)

  return zonedToInstant(year, month, day, hours, minutes, zone)
}

/** `2026-11-14` : le jour civil de l'instant dans le fuseau. Sert de clé de regroupement. */
export function dayKey(instant: Date, zone: string): string {
  const parts = zonedParts(instant, zone)

  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`
}

export const sameDay = (a: Date, b: Date, zone: string) => dayKey(a, zone) === dayKey(b, zone)

/** Minuit (heure du restaurant) du jour de `instant`. */
export function startOfDayIn(instant: Date, zone: string): Date {
  const parts = zonedParts(instant, zone)

  return zonedToInstant(parts.year, parts.month, parts.day, 0, 0, zone)
}

/** Le même jour de l'heure, décalé de `days` jours civils. */
export function addDaysIn(instant: Date, days: number, zone: string): Date {
  const parts = zonedParts(instant, zone)

  return zonedToInstant(parts.year, parts.month, parts.day + days, 0, 0, zone)
}

/** Lundi (minuit) de la semaine de `instant`. */
export function startOfWeekIn(instant: Date, zone: string): Date {
  const parts = zonedParts(instant, zone)

  return addDaysIn(instant, -parts.weekdayFromMonday, zone)
}

/** Premier jour du mois de `instant` (minuit). */
export function startOfMonthIn(instant: Date, zone: string): Date {
  const parts = zonedParts(instant, zone)

  return zonedToInstant(parts.year, parts.month, 1, 0, 0, zone)
}

export const addMonthsIn = (instant: Date, months: number, zone: string): Date => {
  const parts = zonedParts(instant, zone)

  return zonedToInstant(parts.year, parts.month + months, 1, 0, 0, zone)
}

/** Les 42 jours (6 semaines, lundi en premier) du mois de `instant`. */
export function monthGridIn(instant: Date, zone: string): Date[] {
  const first = startOfWeekIn(startOfMonthIn(instant, zone), zone)

  return Array.from({ length: 42 }, (_, index) => addDaysIn(first, index, zone))
}

export const weekDaysIn = (instant: Date, zone: string): Date[] => {
  const monday = startOfWeekIn(instant, zone)

  return Array.from({ length: 7 }, (_, index) => addDaysIn(monday, index, zone))
}

/** `2026-11-14` pour un champ `<input type="date">`, dans le fuseau du restaurant. */
export const toDateInput = (instant: Date, zone: string) => dayKey(instant, zone)

/** `19:30` pour un champ `<input type="time">`, dans le fuseau du restaurant. */
export function toTimeInput(instant: Date, zone: string): string {
  const parts = zonedParts(instant, zone)

  return `${pad(parts.hour)}:${pad(parts.minute)}`
}

/** Minutes écoulées depuis minuit, dans le fuseau du restaurant. */
export function minutesOfDay(instant: Date, zone: string): number {
  const parts = zonedParts(instant, zone)

  return parts.hour * 60 + parts.minute
}

// Mise en forme ------------------------------------------------------------------------------

const formatters = new Map<string, Intl.DateTimeFormat>()

function formatterFor(options: Intl.DateTimeFormatOptions, zone: string): Intl.DateTimeFormat {
  const key = `${zone}|${JSON.stringify(options)}`
  let formatter = formatters.get(key)

  if (!formatter) {
    formatter = new Intl.DateTimeFormat('fr-FR', { ...options, timeZone: zone })
    formatters.set(key, formatter)
  }

  return formatter
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

export const formatWeekday = (instant: Date, zone: string) =>
  capitalize(formatterFor({ weekday: 'long' }, zone).format(instant))

export const formatWeekdayShort = (instant: Date, zone: string) =>
  capitalize(formatterFor({ weekday: 'short' }, zone).format(instant).replace('.', ''))

export const formatMonthYear = (instant: Date, zone: string) =>
  capitalize(formatterFor({ month: 'long', year: 'numeric' }, zone).format(instant))

export const formatDayMonth = (instant: Date, zone: string) =>
  formatterFor({ day: 'numeric', month: 'long' }, zone).format(instant)

export const formatFullDate = (instant: Date, zone: string) =>
  capitalize(formatterFor({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }, zone).format(instant))

/** « 19:30 » dans le fuseau du restaurant. */
export const formatClock = (instant: Date, zone: string) =>
  formatterFor({ hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }, zone).format(instant)

/** « 14 nov. 19:30 » pour les listes et les e-mails affichés à l'écran. */
export const formatShortDateTime = (instant: Date, zone: string) =>
  formatterFor({ day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }, zone).format(instant)

/** Un bloc positionné dans une colonne de la grille horaire. */
export interface Placed<T> {
  item: T
  start: number
  end: number

  /** Colonne occupée parmi celles du groupe de chevauchement. */
  lane: number
  lanes: number
}

/**
 * Place des événements d'une journée dans la grille : ceux qui se chevauchent se partagent
 * la largeur en colonnes côte à côte. `start` et `end` sont des minutes depuis minuit.
 */
export function layoutDay<T>(items: { item: T; start: number; end: number }[]): Placed<T>[] {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end)
  const placed: Placed<T>[] = []
  let group: Placed<T>[] = []
  let groupEnd = -1

  const closeGroup = () => {
    const lanes = Math.max(1, ...group.map(entry => entry.lane + 1))

    group.forEach(entry => {
      entry.lanes = lanes
    })
    placed.push(...group)
    group = []
  }

  for (const entry of sorted) {
    if (group.length && entry.start >= groupEnd)
      closeGroup()

    const taken = new Set(group.filter(other => other.end > entry.start).map(other => other.lane))
    let lane = 0

    while (taken.has(lane))
      lane++

    group.push({ ...entry, lane, lanes: 1 })
    groupEnd = Math.max(groupEnd, entry.end)
  }

  closeGroup()

  return placed
}
