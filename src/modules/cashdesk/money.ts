/** Arithmétique de caisse : le FCFA n'a pas de centimes, tout est calculé en entiers. */

/** Montant saisi (chiffres, espaces tolérés) → entier, 0 si vide ou invalide. */
export function parseAmount(text: string): number {
  const digits = text.replace(/\D/g, '')

  return digits ? Math.min(Number(digits), 999_999_999) : 0
}

/**
 * Les additions portent des décimales (TVA : 12 521,25) alors que le FCFA se paie en entier et
 * s'affiche arrondi. Le caissier saisit des francs entiers ; ce que le client doit « en entier »
 * est donc l'arrondi du reste dû, et le versement qui l'atteint solde exactement la facture
 * (la fraction de franc est absorbée), sans quoi elle ne serait jamais soldée.
 */
export const wholeDue = (due: number) => Math.round(due)

/** Montant à envoyer pour un versement de `entered` francs : exact si celui-ci solde l'addition. */
export const amountToPay = (entered: number, due: number) => entered >= wholeDue(due) ? due : entered

export const round2 = (value: number) => Math.round(value * 100) / 100

/** Un décimal du back (`"12500.00"`) → nombre. */
export const toNumber = (value: string | number | null | undefined) => Number(value ?? 0) || 0

/** Billets à proposer pour un montant remis : le montant exact, puis les coupures qui le couvrent. */
export function cashSuggestions(amount: number): number[] {
  const due = wholeDue(amount)

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
