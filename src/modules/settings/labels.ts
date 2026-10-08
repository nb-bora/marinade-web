/** Devises proposées (le serveur accepte tout code de 3 lettres). */
export const CURRENCIES = [
  { value: 'XAF', title: 'Franc CFA, Afrique centrale (XAF)' },
  { value: 'XOF', title: 'Franc CFA, Afrique de l\'Ouest (XOF)' },
  { value: 'EUR', title: 'Euro (EUR)' },
  { value: 'USD', title: 'Dollar américain (USD)' },
]

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
