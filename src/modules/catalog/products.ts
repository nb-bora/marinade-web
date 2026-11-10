/**
 * Logique commune aux plats et aux boissons : recherche sans accents, tri, statistiques de prix.
 * Pure (sans Vue ni réseau) pour rester testable.
 */

export type Station = 'KITCHEN' | 'BAR' | 'DESSERT'

const STATION_LABELS: Record<Station, string> = { KITCHEN: 'Cuisine', DESSERT: 'Desserts', BAR: 'Bar' }

/** Nom du poste de production, ou `null` quand l'article n'en a pas. */
export const stationLabel = (station: Station | null | undefined) => station ? STATION_LABELS[station] : null

/** Choix du champ « Poste de production », celui proposé par défaut en tête de liste. */
export const stationItems = (first: Station) =>
  [first, ...(Object.keys(STATION_LABELS) as Station[]).filter(station => station !== first)]
    .map(value => ({ value, title: STATION_LABELS[value] }))

export type SortKey = 'name' | 'price-asc' | 'price-desc' | 'time' | 'recent'

export interface SortOption {
  value: SortKey
  title: string
}

export const SORT_NAME: SortOption = { value: 'name', title: 'Nom (A → Z)' }
export const SORT_PRICE_ASC: SortOption = { value: 'price-asc', title: 'Prix croissant' }
export const SORT_PRICE_DESC: SortOption = { value: 'price-desc', title: 'Prix décroissant' }
export const SORT_TIME: SortOption = { value: 'time', title: 'Préparation la plus courte' }
export const SORT_RECENT: SortOption = { value: 'recent', title: 'Ajout le plus récent' }

/** « Crème Brûlée » → « creme brulee » : recherche insensible à la casse et aux accents. */
export const normalize = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

/** Vrai si `term` (déjà normalisé) figure dans l'un des champs ; un terme vide laisse tout passer. */
export function matchesSearch(term: string, ...fields: (string | null | undefined)[]) {
  return !term || normalize(fields.filter(Boolean).join(' ')).includes(term)
}

export const plural = (count: number, word: string, pluralWord = `${word}s`) => `${count} ${count > 1 ? pluralWord : word}`

interface Sortable {
  nom: string
  prix: string | number
  created_at: string
  temps_preparation?: number | null
}

const byName = (a: Sortable, b: Sortable) => a.nom.localeCompare(b.nom, 'fr')

// Sans temps renseigné, un plat passe après tous les autres.
const timeOf = (item: Sortable) => item.temps_preparation ?? Number.POSITIVE_INFINITY

const COMPARATORS: Record<SortKey, (a: Sortable, b: Sortable) => number> = {
  'name': () => 0,
  'price-asc': (a, b) => Number(a.prix) - Number(b.prix),
  'price-desc': (a, b) => Number(b.prix) - Number(a.prix),
  'time': (a, b) => timeOf(a) - timeOf(b),
  'recent': (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at),
}

/** Trie sans modifier la liste d'origine. À égalité, l'ordre alphabétique départage. */
export function sortProducts<T extends Sortable>(items: readonly T[], key: SortKey): T[] {
  return [...items].sort((a, b) => COMPARATORS[key](a, b) || byName(a, b))
}

export interface PriceStats {
  average: number
  min: number
  max: number

  /** Devise du premier produit : la carte d'un restaurant n'en a qu'une. */
  currency: string | undefined
}

/** Prix moyen, plus bas et plus haut ; `null` sans produit. Les prix illisibles sont ignorés. */
export function priceStats(items: readonly { prix: string | number; devise?: string }[]): PriceStats | null {
  const prices = items.map(item => Number(item.prix)).filter(Number.isFinite)

  if (!prices.length)
    return null

  return {
    average: prices.reduce((sum, value) => sum + value, 0) / prices.length,
    min: prices.reduce((low, value) => Math.min(low, value), Number.POSITIVE_INFINITY),
    max: prices.reduce((high, value) => Math.max(high, value), Number.NEGATIVE_INFINITY),
    currency: items[0]?.devise,
  }
}
