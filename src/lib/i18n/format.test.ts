import { afterEach, describe, expect, it } from 'vitest'
import { intlLocale, setFormatContext } from './context'
import {
  currencyExponent,
  dayKey,
  formatDate,
  formatDateTime,
  formatMoney,
  formatNumber,
  formatPercent,
  formatRelative,
  formatTime,
  formatWeight,
  majorToMinor,
  minorToMajor,
  parseLocaleNumber,
  timeZoneOffset,
} from './format'

// Intl sépare les milliers et la devise par des espaces insécables (U+00A0 / U+202F) :
// on les ramène à des espaces ordinaires pour écrire les attentes lisiblement.
const plain = (text: string) => text.replace(/[\xA0\u202F]/g, ' ')

const CAMEROON = { country: 'CM', currency: 'XAF', currencyExponent: 0, timeZone: 'Africa/Douala' }
const FRANCE = { country: 'FR', currency: 'EUR', currencyExponent: 2, timeZone: 'Europe/Paris' }
const USA = { country: 'US', currency: 'USD', currencyExponent: 2, timeZone: 'America/New_York' }

afterEach(() => setFormatContext({ language: 'fr', ...CAMEROON }))

describe('intlLocale', () => {
  it('combine la langue de l\'interface et le pays de l\'établissement', () => {
    expect(intlLocale({ language: 'fr', country: 'CM' })).toBe('fr-CM')
    expect(intlLocale({ language: 'en', country: 'cm' })).toBe('en-CM')
    expect(intlLocale({ language: 'en', country: null })).toBe('en')
  })
})

describe('formatMoney', () => {
  it('fr-CM / XAF : sans décimales, devise de l\'établissement par défaut', () => {
    setFormatContext({ language: 'fr', ...CAMEROON })
    expect(plain(formatMoney(12500))).toBe('12 500 FCFA')
    expect(plain(formatMoney('12521.25'))).toBe('12 521 FCFA')
  })

  it('en-CM / XAF', () => {
    setFormatContext({ language: 'en', ...CAMEROON })
    expect(plain(formatMoney(12500))).toBe('FCFA 12,500')
  })

  it('fr-FR / EUR : unités mineures du pressing', () => {
    setFormatContext({ language: 'fr', ...FRANCE })
    expect(plain(formatMoney(500, { minor: true }))).toBe('5,00 €')
    expect(plain(formatMoney('12.5'))).toBe('12,50 €')
  })

  it('en-US / USD', () => {
    setFormatContext({ language: 'en', ...USA })
    expect(formatMoney(1234.5)).toBe('$1,234.50')
    expect(formatMoney(123450, { minor: true })).toBe('$1,234.50')
  })

  it('XAF en unités mineures : 500 = 500 FCFA', () => {
    setFormatContext({ language: 'fr', ...CAMEROON })
    expect(plain(formatMoney(500, { minor: true }))).toBe('500 FCFA')
  })

  it('accepte une devise explicite et ignore les valeurs vides', () => {
    setFormatContext({ language: 'fr', ...CAMEROON })
    expect(plain(formatMoney(5, { currency: 'EUR' }))).toBe('5,00 €')
    expect(formatMoney(null)).toBe('—')
    expect(formatMoney('abc')).toBe('—')
  })

  it('connaît les décimales ISO 4217 et convertit les unités', () => {
    expect(currencyExponent('XAF')).toBe(0)
    expect(currencyExponent('EUR')).toBe(2)
    expect(currencyExponent('BHD')).toBe(3)
    expect(minorToMajor(1250, 2)).toBe(12.5)
    expect(majorToMinor(12.5, 2)).toBe(1250)
    expect(majorToMinor(500, 0)).toBe(500)
  })
})

describe('nombres, poids et pourcentages', () => {
  it('suivent les séparateurs de la langue', () => {
    setFormatContext({ language: 'fr', ...CAMEROON })
    expect(plain(formatNumber(1234.5))).toBe('1 234,5')
    expect(plain(formatWeight(12.5))).toBe('12,5 kg')
    expect(plain(formatWeight(2500, { grams: true }))).toBe('2,5 kg')
    expect(plain(formatPercent(12.5))).toBe('12,5 %')

    setFormatContext({ language: 'en', ...CAMEROON })
    expect(formatNumber(1234.5)).toBe('1,234.5')
    expect(plain(formatWeight(1234.5))).toBe('1,234.5 kg')
    expect(formatPercent(0.125, { ratio: true })).toBe('12.5%')
  })
})

describe('parseLocaleNumber', () => {
  it('lit la virgule décimale en français', () => {
    expect(parseLocaleNumber('12,5', 'fr-CM')).toBe(12.5)
    expect(parseLocaleNumber('1 234,5', 'fr-FR')).toBe(1234.5)
    expect(parseLocaleNumber('1 234,5', 'fr-FR')).toBe(1234.5)
    expect(parseLocaleNumber('12.5', 'fr-CM')).toBe(12.5)
    expect(parseLocaleNumber('1.234.567', 'fr-CM')).toBe(1234567)
  })

  it('lit le point décimal en anglais', () => {
    expect(parseLocaleNumber('1,234.5', 'en-US')).toBe(1234.5)
    expect(parseLocaleNumber('12.5', 'en-CM')).toBe(12.5)
    expect(parseLocaleNumber('-3', 'en')).toBe(-3)
  })

  it('refuse ce qui n\'est pas un nombre', () => {
    expect(parseLocaleNumber('', 'fr')).toBeNull()
    expect(parseLocaleNumber('12a', 'fr')).toBeNull()
    expect(parseLocaleNumber('1,2,3', 'fr')).toBeNull()
    expect(parseLocaleNumber(null)).toBeNull()
  })
})

describe('dates dans le fuseau de l\'établissement', () => {
  const instant = '2026-10-19T13:05:00Z'

  it('Douala (UTC+1) en français', () => {
    setFormatContext({ language: 'fr', ...CAMEROON })
    expect(formatTime(instant)).toBe('14:05')
    expect(plain(formatDateTime(instant))).toBe('19 oct. 2026, 14:05')
  })

  it('New York (UTC-4) en anglais : même instant, autre heure locale', () => {
    setFormatContext({ language: 'en', ...USA })
    expect(plain(formatTime(instant))).toBe('9:05 AM')
    expect(plain(formatDateTime(instant))).toBe('Oct 19, 2026, 9:05 AM')
  })

  it('un instant proche de minuit change de jour selon le fuseau', () => {
    setFormatContext({ language: 'fr', ...FRANCE })
    expect(dayKey('2026-10-19T23:30:00Z')).toBe('2026-10-20')
    expect(dayKey('2026-10-19T23:30:00Z', { timeZone: 'America/New_York' })).toBe('2026-10-19')
  })

  it('un jour civil (AAAA-MM-JJ) ne se décale jamais', () => {
    setFormatContext({ language: 'en', ...USA })
    expect(formatDate('2026-10-19')).toBe('Oct 19, 2026')
    expect(dayKey('2026-10-19')).toBe('2026-10-19')
  })

  it('formatRelative suit la langue', () => {
    const now = new Date('2026-10-19T12:00:00Z')

    setFormatContext({ language: 'fr', ...CAMEROON })
    expect(formatRelative('2026-10-18T12:00:00Z', now)).toBe('hier')

    setFormatContext({ language: 'en', ...CAMEROON })
    expect(formatRelative('2026-10-19T11:55:00Z', now)).toBe('5 minutes ago')
  })

  it('décrit le décalage d\'un fuseau', () => {
    expect(timeZoneOffset('Europe/Paris', new Date('2026-07-01T00:00:00Z'))).toBe('UTC+02:00')
    expect(timeZoneOffset('UTC')).toBe('UTC+00:00')
  })
})
