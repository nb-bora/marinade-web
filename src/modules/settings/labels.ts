/** Devises proposées (le serveur accepte tout code de 3 lettres). */
export const CURRENCIES = [
  { value: 'XAF', title: 'FCFA, Afrique centrale (XAF)' },
  { value: 'XOF', title: 'FCFA, Afrique de l’Ouest (XOF)' },
  { value: 'EUR', title: 'Euro (EUR)' },
  { value: 'USD', title: 'Dollar américain (USD)' },
]

/** Pays proposés ; le pays déjà enregistré est toujours ajouté à la liste. */
export const COUNTRIES = ['Cameroun', 'Gabon', 'Congo', 'Tchad', 'République centrafricaine', 'Guinée équatoriale', 'Côte d’Ivoire', 'Sénégal', 'France']

export const DEFAULT_COUNTRY = 'Cameroun'

/** TVA appliquée par le serveur quand le restaurant n'en a pas défini (Cameroun). */
export const DEFAULT_VAT_RATE = 19.25

/** Suggestions de taux de service. */
export const SERVICE_RATE_PRESETS = [0, 5, 10, 15]

export const emptyToNull = (value: string | null | undefined): string | null => {
  const trimmed = (value ?? '').trim()

  return trimmed === '' ? null : trimmed
}

/** Nombre saisi (virgule ou point) ou `null` s'il est illisible. */
export function parseDecimal(value: string | number | null | undefined): number | null {
  const text = String(value ?? '').trim().replace(',', '.')

  if (text === '')
    return null

  const parsed = Number(text)

  return Number.isFinite(parsed) ? parsed : null
}

// Règles de saisie : messages constructifs (ce qui ne va pas et comment le corriger).

const length = (value: unknown) => String(value ?? '').trim().length

export const nameRules = [
  (value: unknown) => length(value) > 0 || 'Donnez un nom à votre restaurant.',
  (value: unknown) => length(value) >= 3 || 'Le nom est trop court : 3 caractères au minimum.',
  (value: unknown) => length(value) <= 100 || 'Le nom est trop long : 100 caractères au maximum.',
]

export const descriptionRule = (value: unknown) =>
  length(value) <= 500 || `La description dépasse 500 caractères (${length(value)}). Raccourcissez-la.`

export const logoUrlRule = (value: unknown) => {
  const text = String(value ?? '').trim()

  if (text === '')
    return true

  if (text.length > 500)
    return 'L’adresse est trop longue (500 caractères au maximum).'

  return /^https?:\/\/[^\s/][^\s./]*\.[^\s/]\S*$/i.test(text) || 'Collez une adresse complète qui commence par https://.'
}

export const MAX_RATE = 30

/** Pourcentage 0 à 30, virgule ou point acceptés. */
export const ratePercent = (label: string) => (value: unknown) => {
  const parsed = parseDecimal(value as string)

  if (parsed === null)
    return `${label} : saisissez un nombre, par exemple 10 ou 19,25.`

  return (parsed >= 0 && parsed <= MAX_RATE) || `${label} : entre 0 et ${MAX_RATE} %.`
}

/** Libellé relatif court : « il y a 2 min ». */
export function sinceLabel(from: number, now: number): string {
  const seconds = Math.max(0, Math.round((now - from) / 1000))

  if (seconds < 10)
    return 'à l’instant'

  if (seconds < 60)
    return `il y a ${seconds} s`

  return `il y a ${Math.round(seconds / 60)} min`
}
