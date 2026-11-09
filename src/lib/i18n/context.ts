import { reactive } from 'vue'
import type { AppLocale } from './locales'
import { FALLBACK_LOCALE } from './locales'

/**
 * Contexte régional des formats : langue de l'interface + pays, devise et fuseau de
 * l'établissement courant. Il est réactif : un gabarit qui affiche `formatMoney(...)` se met
 * à jour seul quand on change de langue ou d'établissement.
 *
 * Il est alimenté par `useLocaleSync` (App.vue) ; les tests le fixent avec `setFormatContext`.
 */
export interface FormatContext {
  language: AppLocale

  /** Pays de l'établissement (ISO 3166-1 alpha-2), ex. `CM`. */
  country: string | null

  /** Devise de l'établissement (ISO 4217), ex. `XAF`. */
  currency: string

  /** Décimales de la devise (ISO 4217) si le serveur les donne ; sinon celles d'Intl. */
  currencyExponent: number | null

  /** Fuseau de l'établissement (IANA), ex. `Africa/Douala`. */
  timeZone: string
}

/** Fuseau du poste, utilisé seulement tant qu'aucun établissement n'est connu. */
export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  }
  catch {
    return 'UTC'
  }
}

/**
 * Valeurs par défaut de la plateforme (celles que le serveur applique à un établissement
 * créé sans précision). C'est le SEUL endroit où elles sont écrites.
 */
export const PLATFORM_DEFAULTS = {
  country: 'CM',
  currency: 'XAF',
} as const

export const formatContext = reactive<FormatContext>({
  language: FALLBACK_LOCALE,
  country: null,
  currency: PLATFORM_DEFAULTS.currency,
  currencyExponent: null,
  timeZone: browserTimeZone(),
})

export function setFormatContext(patch: Partial<FormatContext>): void {
  Object.assign(formatContext, patch)
}

/**
 * Locale BCP 47 des formats : langue de l'interface + pays de l'établissement
 * (`fr-CM`, `en-CM`, `fr-FR`). Sans pays connu : la langue seule.
 */
export function intlLocale(context: Pick<FormatContext, 'language' | 'country'> = formatContext): string {
  if (!context.country)
    return context.language

  const tag = `${context.language}-${context.country.toUpperCase()}`

  try {
    return Intl.getCanonicalLocales(tag)[0] ?? context.language
  }
  catch {
    return context.language
  }
}
