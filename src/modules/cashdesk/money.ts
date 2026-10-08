/** Arithmétique de caisse : le FCFA n'a pas de centimes, tout est calculé en entiers. */

/** Montant saisi (chiffres, espaces tolérés) → entier, 0 si vide ou invalide. */
export function parseAmount(text: string): number {
  const digits = text.replace(/\D/g, '')

  return digits ? Math.min(Number(digits), 999_999_999) : 0
}

/** Un décimal du back (`"12500.00"`) → nombre. */
export const toNumber = (value: string | number | null | undefined) => Number(value ?? 0) || 0

/** Billets à proposer pour un montant remis : le montant exact, puis les coupures qui le couvrent. */
export function cashSuggestions(due: number): number[] {
  if (due <= 0)
    return []

  const notes = [500, 1000, 2000, 5000, 10_000, 20_000, 50_000, 100_000]
  const suggestions = new Set<number>([due])

  for (const note of notes) {
    const rounded = Math.ceil(due / note) * note

    if (rounded > due && suggestions.size < 4)
      suggestions.add(rounded)
  }

  return [...suggestions].sort((a, b) => a - b).slice(0, 4)
}
