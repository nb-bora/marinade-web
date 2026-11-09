/**
 * Formats internationaux : montants, nombres, poids, pourcentages, dates et heures.
 *
 * - Locale : langue de l'interface + pays de l'établissement (`fr-CM`, `en-CM`, `fr-FR`).
 * - Devise : celle de l'établissement, sauf si l'appelant en précise une.
 * - Dates : dans le FUSEAU DE L'ÉTABLISSEMENT, jamais celui du poste.
 *
 * Chaque fonction accepte des options pour forcer locale / devise / fuseau (tests, exports).
 */
import { formatContext, intlLocale } from './context'

type Amount = number | string | null | undefined
export type DateInput = string | number | Date | null | undefined

/** Ce qui s'affiche quand il n'y a pas de valeur. */
export const EMPTY = '—'

const cache = new Map<string, Intl.NumberFormat | Intl.DateTimeFormat | Intl.RelativeTimeFormat>()

function cached<T extends Intl.NumberFormat | Intl.DateTimeFormat | Intl.RelativeTimeFormat>(key: string, create: () => T): T {
  let formatter = cache.get(key) as T | undefined

  if (!formatter) {
    formatter = create()
    cache.set(key, formatter)
  }

  return formatter
}

const toNumber = (value: Amount): number | null => {
  if (value === null || value === undefined || value === '')
    return null

  const number = typeof value === 'number' ? value : Number(String(value).trim())

  return Number.isFinite(number) ? number : null
}

// ---------------------------------------------------------------------------------------------
// Montants

/** Décimales ISO 4217 d'une devise selon Intl (XAF → 0, EUR → 2, BHD → 3). */
export function currencyExponent(currency: string): number {
  try {
    return cached(`exp|${currency}`, () => new Intl.NumberFormat('en', { style: 'currency', currency }))
      .resolvedOptions().maximumFractionDigits ?? 2
  }
  catch {
    return 2
  }
}

export interface MoneyOptions {

  /** ISO 4217 ; par défaut la devise de l'établissement courant. */
  currency?: string

  /** Décimales de la devise ; par défaut celles de l'établissement (si même devise) ou d'Intl. */
  exponent?: number

  /**
   * `true` : le montant est en UNITÉS MINEURES (entiers du module pressing : 500 = 5,00 € en EUR,
   * 500 FCFA en XAF). `false` (défaut) : unités majeures (décimaux du restaurant, en chaînes).
   */
  minor?: boolean

  /** Locale BCP 47 forcée (sinon langue de l'interface + pays de l'établissement). */
  locale?: string

  /** `always` pour afficher « +1 500 FCFA » ; `exceptZero`... (voir Intl.NumberFormat). */
  signDisplay?: Intl.NumberFormatOptions['signDisplay']
}

function resolveExponent(currency: string, explicit?: number): number {
  if (explicit !== undefined)
    return explicit
  if (currency === formatContext.currency && formatContext.currencyExponent !== null)
    return formatContext.currencyExponent

  return currencyExponent(currency)
}

/** Montant en unités majeures (pour un calcul ou un champ de saisie). */
export function minorToMajor(amount: number, exponent: number): number {
  return amount / 10 ** exponent
}

/** Unités majeures → unités mineures entières (arrondi au plus proche). */
export function majorToMinor(amount: number, exponent: number): number {
  return Math.round(amount * 10 ** exponent)
}

/**
 * `12500` → « 12 500 FCFA » (fr-CM), « FCFA 12,500 » (en-CM) ; `{ minor: true }` pour les entiers
 * en unités mineures : `formatMoney(500, { currency: 'EUR', minor: true })` → « 5,00 € ».
 */
export function formatMoney(amount: Amount, options: MoneyOptions = {}): string {
  const value = toNumber(amount)

  if (value === null)
    return EMPTY

  const currency = (options.currency ?? formatContext.currency).toUpperCase()
  const exponent = resolveExponent(currency, options.exponent)
  const locale = options.locale ?? intlLocale()
  const signDisplay = options.signDisplay ?? 'auto'

  const formatter = cached(`money|${locale}|${currency}|${exponent}|${signDisplay}`, () => new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: exponent,
    maximumFractionDigits: exponent,
    signDisplay,
  }))

  return formatter.format(options.minor ? minorToMajor(value, exponent) : value)
}

/** Symbole de la devise dans la locale courante (« FCFA », « € », « $US »), pour un suffixe de champ. */
export function currencySymbol(currency: string = formatContext.currency, locale: string = intlLocale()): string {
  try {
    const parts = cached(`sym|${locale}|${currency}`, () => new Intl.NumberFormat(locale, { style: 'currency', currency }))
      .formatToParts(0)

    return parts.find(part => part.type === 'currency')?.value ?? currency
  }
  catch {
    return currency
  }
}

// ---------------------------------------------------------------------------------------------
// Nombres

export interface NumberOptions {
  minimumFractionDigits?: number
  maximumFractionDigits?: number
  locale?: string
}

export function formatNumber(value: Amount, options: NumberOptions = {}): string {
  const number = toNumber(value)

  if (number === null)
    return EMPTY

  const locale = options.locale ?? intlLocale()
  const min = options.minimumFractionDigits ?? 0
  const max = Math.max(options.maximumFractionDigits ?? 2, min)

  return cached(`num|${locale}|${min}|${max}`, () => new Intl.NumberFormat(locale, {
    minimumFractionDigits: min,
    maximumFractionDigits: max,
  })).format(number)
}

export interface WeightOptions extends NumberOptions {

  /** `true` : la valeur est en grammes (convertie en kg). */
  grams?: boolean
}

/** Poids en kilogrammes : « 12,5 kg » (fr), « 12.5 kg » (en). */
export function formatWeight(value: Amount, options: WeightOptions = {}): string {
  const number = toNumber(value)

  if (number === null)
    return EMPTY

  const locale = options.locale ?? intlLocale()
  const max = options.maximumFractionDigits ?? 3
  const min = Math.min(options.minimumFractionDigits ?? 0, max)

  return cached(`kg|${locale}|${min}|${max}`, () => new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: 'kilogram',
    unitDisplay: 'short',
    minimumFractionDigits: min,
    maximumFractionDigits: max,
  })).format(options.grams ? number / 1000 : number)
}

export interface PercentOptions extends NumberOptions {

  /** `true` : la valeur est un ratio (0,25 = 25 %) ; par défaut, des points de pourcentage (25 = 25 %). */
  ratio?: boolean
}

/** « 12,5 % » (fr), « 12.5% » (en). */
export function formatPercent(value: Amount, options: PercentOptions = {}): string {
  const number = toNumber(value)

  if (number === null)
    return EMPTY

  const locale = options.locale ?? intlLocale()
  const max = options.maximumFractionDigits ?? 1
  const min = Math.min(options.minimumFractionDigits ?? 0, max)

  return cached(`pct|${locale}|${min}|${max}`, () => new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: min,
    maximumFractionDigits: max,
  })).format(options.ratio ? number : number / 100)
}

/** Séparateurs décimal et de milliers d'une locale (« , » et espace insécable en fr). */
export function numberSeparators(locale: string = intlLocale()): { decimal: string; group: string } {
  const parts = new Intl.NumberFormat(locale).formatToParts(12345.6)

  return {
    decimal: parts.find(part => part.type === 'decimal')?.value ?? '.',
    group: parts.find(part => part.type === 'group')?.value ?? ',',
  }
}

/**
 * Lit un nombre saisi selon la locale : « 12,5 » et « 1 234,5 » en français, « 1,234.5 » en
 * anglais. En français, un point seul est aussi accepté comme virgule (« 12.5 »), habitude
 * courante au clavier. Renvoie `null` si la saisie n'est pas un nombre.
 */
export function parseLocaleNumber(input: string | number | null | undefined, locale: string = intlLocale()): number | null {
  if (typeof input === 'number')
    return Number.isFinite(input) ? input : null
  if (input === null || input === undefined)
    return null

  // Espaces ordinaires, insécables et fines insécables : toujours des séparateurs de milliers.
  let text = input.trim().replace(/[\s']/g, '')

  if (text === '')
    return null

  const { decimal } = numberSeparators(locale)

  if (decimal === ',') {
    // Avec une virgule, les points sont des milliers ; sans virgule, un point unique est la décimale.
    text = text.includes(',') ? text.replace(/\./g, '').replace(',', '.') : text
    if ((text.match(/\./g) ?? []).length > 1)
      text = text.replace(/\./g, '')
  }
  else {
    text = text.replace(/,/g, '')
  }

  if (!/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text))
    return null

  const value = Number(text)

  return Number.isFinite(value) ? value : null
}

// ---------------------------------------------------------------------------------------------
// Dates et heures

/** `2026-10-19` (date sans heure) : un jour civil, à ne pas décaler par le fuseau. */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

function toDate(value: DateInput): { date: Date; dateOnly: boolean } | null {
  if (value === null || value === undefined || value === '')
    return null

  const dateOnly = typeof value === 'string' && DATE_ONLY.test(value)
  const date = value instanceof Date ? value : new Date(dateOnly ? `${value}T00:00:00Z` : value)

  return Number.isNaN(date.getTime()) ? null : { date, dateOnly }
}

export interface DateOptions {

  /** Fuseau IANA forcé (sinon celui de l'établissement). */
  timeZone?: string
  locale?: string
}

/**
 * Formate une date avec des options Intl libres (`{ weekday: 'long', day: 'numeric' }`...), dans
 * le fuseau de l'établissement. Base de toutes les autres fonctions de date.
 */
export function formatDateWith(value: DateInput, format: Intl.DateTimeFormatOptions, options: DateOptions = {}): string {
  const parsed = toDate(value)

  if (!parsed)
    return EMPTY

  const locale = options.locale ?? intlLocale()

  // Un jour civil (« 2026-10-19 ») s'affiche tel quel, quel que soit le fuseau.
  const timeZone = parsed.dateOnly ? 'UTC' : (options.timeZone ?? formatContext.timeZone)
  const key = `dt|${locale}|${timeZone}|${JSON.stringify(format)}`

  return cached(key, () => new Intl.DateTimeFormat(locale, { ...format, timeZone })).format(parsed.date)
}

/** « 19 oct. 2026 » / « Oct 19, 2026 ». */
export const formatDate = (value: DateInput, options?: DateOptions) =>
  formatDateWith(value, { dateStyle: 'medium' }, options)

/** « 19 oct. 2026, 14:05 » / « Oct 19, 2026, 2:05 PM ». */
export const formatDateTime = (value: DateInput, options?: DateOptions) =>
  formatDateWith(value, { dateStyle: 'medium', timeStyle: 'short' }, options)

/** « 14:05 » / « 2:05 PM ». */
export const formatTime = (value: DateInput, options?: DateOptions) =>
  formatDateWith(value, { timeStyle: 'short' }, options)

/** « il y a 5 minutes », « hier », « in 2 hours »... dans la langue de l'interface. */
export function formatRelative(value: DateInput, now: Date = new Date(), options: { locale?: string } = {}): string {
  const parsed = toDate(value)

  if (!parsed)
    return EMPTY

  const locale = options.locale ?? intlLocale()
  const formatter = cached(`rel|${locale}`, () => new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }))
  const seconds = Math.round((parsed.date.getTime() - now.getTime()) / 1000)

  const steps: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
  ]

  for (const [unit, size] of steps) {
    if (Math.abs(seconds) >= size)
      return formatter.format(Math.round(seconds / size), unit)
  }

  return formatter.format(seconds, 'second')
}

/** Jour civil `AAAA-MM-JJ` d'un instant dans le fuseau de l'établissement (filtres « aujourd'hui »). */
export function dayKey(value: DateInput = new Date(), options: { timeZone?: string } = {}): string {
  const parsed = toDate(value)

  if (!parsed)
    return ''

  const timeZone = parsed.dateOnly ? 'UTC' : (options.timeZone ?? formatContext.timeZone)

  // `en-CA` écrit les dates en AAAA-MM-JJ.
  return cached(`day|${timeZone}`, () => new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }))
    .format(parsed.date)
}

/** Décalage d'un fuseau à un instant donné : « UTC+01:00 ». */
export function timeZoneOffset(timeZone: string, at: Date = new Date()): string {
  try {
    const part = new Intl.DateTimeFormat('en', { timeZone, timeZoneName: 'longOffset' })
      .formatToParts(at)
      .find(item => item.type === 'timeZoneName')?.value ?? 'GMT'

    return part === 'GMT' ? 'UTC+00:00' : part.replace('GMT', 'UTC')
  }
  catch {
    return ''
  }
}
