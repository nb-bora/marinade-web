/** Mise en forme pour l'affichage : français, FCFA, fuseau de l'utilisateur. */

const LOCALE = 'fr-FR'

const currencyFormatters = new Map<string, Intl.NumberFormat>()

function currencyFormatter(currency: string): Intl.NumberFormat {
  let formatter = currencyFormatters.get(currency)

  if (!formatter) {
    // Le FCFA n'a pas de centimes : on n'affiche jamais de décimales pour XAF / XOF.
    const noMinorUnit = currency === 'XAF' || currency === 'XOF'

    formatter = new Intl.NumberFormat(LOCALE, {
      style: 'currency',
      currency,
      maximumFractionDigits: noMinorUnit ? 0 : 2,
      minimumFractionDigits: noMinorUnit ? 0 : 2,
    })
    currencyFormatters.set(currency, formatter)
  }

  return formatter
}

/** `12500` → « 12 500 FCFA ». Accepte les décimaux du back, qui arrivent en chaînes. */
export function formatMoney(amount: number | string | null | undefined, currency = 'XAF'): string {
  if (amount === null || amount === undefined || amount === '')
    return '—'

  const value = Number(amount)

  return Number.isFinite(value) ? currencyFormatter(currency).format(value) : '—'
}

const dateTime = new Intl.DateTimeFormat(LOCALE, { dateStyle: 'medium', timeStyle: 'short' })
const dateOnly = new Intl.DateTimeFormat(LOCALE, { dateStyle: 'medium' })
const timeOnly = new Intl.DateTimeFormat(LOCALE, { timeStyle: 'short' })

export const formatDateTime = (value: string | Date | null | undefined) =>
  value ? dateTime.format(new Date(value)) : '—'

export const formatDate = (value: string | Date | null | undefined) =>
  value ? dateOnly.format(new Date(value)) : '—'

export const formatTime = (value: string | Date | null | undefined) =>
  value ? timeOnly.format(new Date(value)) : '—'

const relative = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' })

/** « il y a 5 minutes », « hier »... */
export function formatRelative(value: string | Date, now: Date = new Date()): string {
  const seconds = Math.round((new Date(value).getTime() - now.getTime()) / 1000)

  const steps: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
  ]

  for (const [unit, size] of steps) {
    if (Math.abs(seconds) >= size)
      return relative.format(Math.round(seconds / size), unit)
  }

  return relative.format(seconds, 'second')
}

/** Début de journée locale d'une date (pour les filtres « aujourd'hui »). */
export function startOfDay(date: Date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function addDays(date: Date, days: number): Date {
  const copy = new Date(date)

  copy.setDate(copy.getDate() + days)

  return copy
}
