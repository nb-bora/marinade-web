/**
 * Langues de l'interface et choix de la langue (fonctions pures, testées).
 *
 * Ordre de priorité : préférence du profil > choix local (navigateur) > langue de
 * l'établissement > langues du navigateur > français.
 */

export const SUPPORTED_LOCALES = ['fr', 'en'] as const

export type AppLocale = typeof SUPPORTED_LOCALES[number]

/** Langue de repli : toute clé absente d'une langue est cherchée en français. */
export const FALLBACK_LOCALE: AppLocale = 'fr'

/** Nom de chaque langue dans sa propre langue (sélecteur de langue). */
export const LOCALE_NAMES: Record<AppLocale, string> = {
  fr: 'Français',
  en: 'English',
}

export const isAppLocale = (value: unknown): value is AppLocale =>
  typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value)

/** `en-GB` → `en`, `FR` → `fr` ; `null` si la langue n'est pas proposée. */
export function toAppLocale(tag: string | null | undefined): AppLocale | null {
  if (!tag)
    return null

  const language = tag.trim().toLowerCase().split(/[-_]/)[0]

  return isAppLocale(language) ? language : null
}

export interface LocaleSources {

  /** Langue enregistrée dans le profil (GET /v1/users/me → `locale`). */
  user?: string | null

  /** Choix fait sur cet appareil (localStorage). */
  stored?: string | null

  /** Langue par défaut de l'établissement courant. */
  establishment?: string | null

  /** `navigator.languages`. */
  browser?: readonly string[] | null
}

export function resolveLocale(sources: LocaleSources): AppLocale {
  const candidates = [sources.user, sources.stored, sources.establishment, ...(sources.browser ?? [])]

  for (const candidate of candidates) {
    const locale = toAppLocale(candidate)

    if (locale)
      return locale
  }

  return FALLBACK_LOCALE
}

const STORAGE_KEY = 'marinade.locale'

export function readStoredLocale(): AppLocale | null {
  try {
    return toAppLocale(window.localStorage.getItem(STORAGE_KEY))
  }
  catch {
    return null
  }
}

export function storeLocale(locale: AppLocale): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, locale)
  }
  catch {
    // Stockage indisponible : le choix vaut pour cette visite seulement.
  }
}
