import { addDays, startOfDay } from '@/lib/format'

/** Hauteur d'une heure dans la grille horaire, en pixels. */
export const HOUR_PX = 56

const pad = (value: number) => String(value).padStart(2, '0')

/** `2026-10-08` en heure locale : sert de clé pour regrouper par jour. */
export const dayKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

export const sameDay = (a: Date, b: Date) => dayKey(a) === dayKey(b)

/** Lundi de la semaine de `date`. */
export function startOfWeek(date: Date): Date {
  const day = startOfDay(date)
  const offset = (day.getDay() + 6) % 7

  return addDays(day, -offset)
}

export const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1)

export const addMonths = (date: Date, months: number) => new Date(date.getFullYear(), date.getMonth() + months, 1)

/** Les 42 jours (6 semaines) affichés par un calendrier mensuel commençant le lundi. */
export function monthGrid(month: Date): Date[] {
  const first = startOfWeek(startOfMonth(month))

  return Array.from({ length: 42 }, (_, index) => addDays(first, index))
}

export const weekDays = (date: Date) => Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(date), index))

/** `2026-10-08` pour un champ `<input type="date">`. */
export const toDateInput = (date: Date) => dayKey(date)

/** `19:30` pour un champ `<input type="time">`. */
export const toTimeInput = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`

/** Assemble une date locale à partir des deux champs. */
export function fromInputs(date: string, time: string): Date {
  const [year, month, day] = date.split('-').map(Number)
  const [hours, minutes] = time.split(':').map(Number)

  return new Date(year, month - 1, day, hours, minutes)
}

export const minutesOfDay = (date: Date) => date.getHours() * 60 + date.getMinutes()

const weekday = new Intl.DateTimeFormat('fr-FR', { weekday: 'long' })
const weekdayShort = new Intl.DateTimeFormat('fr-FR', { weekday: 'short' })
const monthYear = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' })
const dayMonth = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' })
const full = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

export const formatWeekday = (date: Date) => capitalize(weekday.format(date))
export const formatWeekdayShort = (date: Date) => capitalize(weekdayShort.format(date).replace('.', ''))
export const formatMonthYear = (date: Date) => capitalize(monthYear.format(date))
export const formatDayMonth = (date: Date) => dayMonth.format(date)
export const formatFullDate = (date: Date) => capitalize(full.format(date))

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
