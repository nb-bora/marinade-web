/**
 * Règles de validation de formulaire (format attendu par les champs Vuetify : une règle
 * renvoie `true` ou le message à afficher). Elles reprennent celles du back : le serveur
 * reste l'autorité, ces règles évitent seulement un aller-retour inutile.
 */
export type Rule = (value: unknown) => true | string

const text = (value: unknown) => String(value ?? '').trim()

export const required: Rule = value => text(value) !== '' || 'Ce champ est obligatoire.'

export const email: Rule = value =>
  text(value) === '' || /^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/.test(text(value)) || 'Adresse e-mail invalide.'

export const minLength = (min: number): Rule => value =>
  text(value) === '' || String(value).length >= min || `Au moins ${min} caractères.`

/** Numéro au format international : `+237 6 55 00 00 00` ou `+237655000000`. */
export const internationalPhone: Rule = value => {
  if (text(value) === '')
    return true

  const digits = text(value).replace(/[\s().-]/g, '')

  return /^\+[1-9]\d{6,14}$/.test(digits) || 'Format international requis, par exemple +237 6 55 00 00 00.'
}

export const sameAs = (other: () => unknown, message = 'Les deux valeurs ne correspondent pas.'): Rule =>
  value => value === other() || message

export const positiveNumber: Rule = value =>
  text(value) === '' || (Number.isFinite(Number(value)) && Number(value) > 0) || 'Saisissez un nombre positif.'
