/**
 * Numéros camerounais : reconnaissance de l'opérateur, mise en forme.
 *
 * Les préfixes reprennent la table du back (`/v1/admin/mobile-operator-prefixes` :
 * MTN 650–654 et 67, Orange 655–659 et 69). Le serveur reste l'autorité ; ceci ne sert
 * qu'à rassurer l'utilisateur pendant la saisie.
 */

export type MobileOperator = 'MTN' | 'Orange'

const RULES: { prefix: string; operator: MobileOperator }[] = [
  { prefix: '650', operator: 'MTN' },
  { prefix: '651', operator: 'MTN' },
  { prefix: '652', operator: 'MTN' },
  { prefix: '653', operator: 'MTN' },
  { prefix: '654', operator: 'MTN' },
  { prefix: '67', operator: 'MTN' },
  { prefix: '655', operator: 'Orange' },
  { prefix: '656', operator: 'Orange' },
  { prefix: '657', operator: 'Orange' },
  { prefix: '658', operator: 'Orange' },
  { prefix: '659', operator: 'Orange' },
  { prefix: '69', operator: 'Orange' },
]

/** Les seuls chiffres du numéro national (sans +237). */
export const nationalDigits = (value: string) => value.replace(/\D/g, '').replace(/^237(?=\d{9}$)/, '').slice(0, 9)

/** L'opérateur du plus long préfixe correspondant, ou null. */
export function operatorOf(national: string): MobileOperator | null {
  const match = RULES
    .filter(rule => national.startsWith(rule.prefix))
    .sort((a, b) => b.prefix.length - a.prefix.length)[0]

  return match?.operator ?? null
}

/** `655123456` → `6 55 12 34 56`. */
export function formatNational(national: string): string {
  const digits = national.slice(0, 9)

  return [digits.slice(0, 1), digits.slice(1, 3), digits.slice(3, 5), digits.slice(5, 7), digits.slice(7, 9)]
    .filter(Boolean)
    .join(' ')
}

/** Format international attendu par l'API. */
export const toInternational = (national: string) => `+237${national}`

export const isValidCameroonMobile = (national: string) => /^6\d{8}$/.test(national)

/** Grandes villes, proposées à la saisie (l'utilisateur peut en taper une autre). */
export const CAMEROON_CITIES = [
  'Douala',
  'Yaoundé',
  'Bafoussam',
  'Bamenda',
  'Garoua',
  'Maroua',
  'Ngaoundéré',
  'Bertoua',
  'Buea',
  'Limbé',
  'Kribi',
  'Ebolowa',
  'Kumba',
  'Dschang',
  'Edéa',
]
