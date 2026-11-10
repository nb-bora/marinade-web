import type { Composant, StockLevel, StockMovementType, StockRow, StockState } from './types'
import type { StatusTone } from '@/ui/AppStatusChip.vue'

export interface MovementOption {
  value: StockMovementType
  title: string
  icon: string
  quantityLabel: string
  help: string
}

/** Les mouvements acceptés par le serveur (`StockMouvementCreate.type`). */
export const MOVEMENTS: MovementOption[] = [
  {
    value: 'entree',
    title: 'Entrée',
    icon: 'ri-arrow-down-circle-line',
    quantityLabel: 'Quantité reçue',
    help: 'Livraison ou achat : la quantité est ajoutée au stock, avec son coût, son lot et sa date limite si besoin.',
  },
  {
    value: 'sortie',
    title: 'Sortie',
    icon: 'ri-arrow-up-circle-line',
    quantityLabel: 'Quantité sortie',
    help: 'Casse, péremption ou usage hors vente : la quantité est retirée du stock disponible. Un motif est obligatoire.',
  },
  {
    value: 'ajustement',
    title: 'Ajustement',
    icon: 'ri-scales-3-line',
    quantityLabel: 'Quantité réellement en stock',
    help: 'Inventaire : la quantité saisie remplace la quantité actuelle (0 est permis si le stock est vide).',
  },
]

/** Les trois types proposés dans le sélecteur du dialogue. */
export const MOVEMENT_CHOICES = MOVEMENTS.map(item => ({ value: item.value, title: item.title }))

export const movementLabel = (type: string) => MOVEMENTS.find(option => option.value === type)?.title ?? type

/** Motifs normalisés : mêmes codes que `app/services/stock_motifs.py` et `MOTIFS_SORTIE_MANUELLE`. */
export const MOTIF_LABELS: Record<string, string> = {
  perte: 'Perte',
  casse: 'Casse',
  peremption: 'Péremption',
  usage_interne: 'Usage interne',
  offert: 'Offert',
  erreur_saisie: 'Erreur de saisie',
  vol: 'Vol',
  inventaire: 'Inventaire',
  autre: 'Autre',
}

/** Motifs proposés selon le mouvement (le serveur refuse tout autre code). */
export const MOTIFS_BY_MOVEMENT: Record<'sortie' | 'ajustement', string[]> = {
  sortie: ['casse', 'peremption', 'perte', 'usage_interne', 'offert', 'vol', 'erreur_saisie', 'autre'],
  ajustement: ['inventaire', 'erreur_saisie', 'autre'],
}

export const motifOptions = (type: string) => {
  const codes = type === 'sortie' || type === 'ajustement' ? MOTIFS_BY_MOVEMENT[type] : []

  return codes.map(value => ({ value, title: MOTIF_LABELS[value] }))
}

/** Un motif est obligatoire pour une sortie et un ajustement ; « autre » exige un commentaire. */
export const motifRequired = (type: string) => type === 'sortie' || type === 'ajustement'

/** Suggestions seulement : le type d'un composant reste libre côté serveur. */
export const COMPONENT_TYPES = ['base', 'sauce', 'proteine', 'legume', 'boisson', 'garniture', 'epice']

const TYPE_LABELS: Record<string, string> = {
  base: 'Base',
  sauce: 'Sauce',
  proteine: 'Protéine',
  legume: 'Légume',
  boisson: 'Boisson',
  garniture: 'Garniture',
  epice: 'Épice',
}

export const componentTypeLabel = (type: string) => TYPE_LABELS[type.toLowerCase()] ?? (type.charAt(0).toUpperCase() + type.slice(1))

export const COMPONENT_TYPE_OPTIONS = COMPONENT_TYPES.map(value => ({ value, title: TYPE_LABELS[value] }))

export const UNITS = ['portion', 'kg', 'g', 'L', 'cl', 'pièce', 'bouteille', 'sachet']

export interface StateInfo {
  label: string
  tone: StatusTone
  color: string
  icon: string
}

export const STATE_INFO: Record<StockState, StateInfo> = {
  rupture: { label: 'Rupture', tone: 'error', color: 'error', icon: 'ri-error-warning-line' },
  alerte: { label: 'Sous le seuil', tone: 'warning', color: 'warning', icon: 'ri-alarm-warning-line' },
  ok: { label: 'Suffisant', tone: 'success', color: 'success', icon: 'ri-checkbox-circle-line' },
}

/**
 * Même règle que le serveur (`stock_engine.etat_stock`) : rupture si le disponible (quantité - réservé)
 * est nul ou négatif ; alerte si le seuil est fixé (> 0) et que le disponible l'atteint.
 */
export function stockState(stock: StockLevel): StockState {
  const available = Number(stock.disponible)

  if (available <= 0)
    return 'rupture'

  const threshold = Number(stock.seuil_alerte)

  return threshold > 0 && available <= threshold ? 'alerte' : 'ok'
}

export function buildRows(composants: Composant[], levels: StockLevel[]): StockRow[] {
  const byId = new Map(composants.map(composant => [composant.id, composant]))

  return levels.flatMap(stock => {
    const composant = byId.get(stock.composant_id)

    return composant ? [{ composant, stock, state: stockState(stock) }] : []
  })
}

/** Minuscules sans accents : « Protéine » et « proteine » se valent dans une recherche. */
export const normalizeText = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()

/** La saisie se retrouve-t-elle dans l'un des champs ? Insensible à la casse et aux accents. */
export function matchesSearch(term: string, ...fields: (string | null | undefined)[]): boolean {
  const needle = normalizeText(term)

  return !needle || fields.some(field => normalizeText(field ?? '').includes(needle))
}

export interface GaugeShares {

  /** Part du stock disponible (0 à 100). */
  available: number

  /** Part du stock réservé par des commandes en cours (0 à 100). */
  reserved: number

  /** Position du seuil d'alerte, ou `null` s'il n'y en a pas. */
  threshold: number | null
}

/**
 * Parts de la jauge (0 à 100). La jauge suit le disponible, comme l'état et l'alerte du serveur : un stock
 * entièrement réservé ne doit pas paraître plein. Le seuil est un repère ; l'échelle va jusqu'à deux fois le
 * seuil (ou jusqu'à la quantité si elle le dépasse). Sans seuil, la jauge représente tout le stock : seule
 * la part réservée se distingue.
 */
export function gaugeShares(stock: StockLevel): GaugeShares {
  const quantity = Math.max(0, Number(stock.quantite) || 0)
  const reserved = Math.min(quantity, Math.max(0, Number(stock.reservee) || 0))
  const threshold = Math.max(0, Number(stock.seuil_alerte) || 0)
  const scale = threshold > 0 ? Math.max(threshold * 2, quantity) : (quantity > 0 ? quantity : 1)
  const share = (value: number) => Math.max(0, Math.min(100, (value / scale) * 100))

  return {
    available: share(quantity - reserved),
    reserved: share(reserved),
    threshold: threshold > 0 ? share(threshold) : null,
  }
}

const quantityFormat = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 })

/** `'12.500'` → « 12,5 ». */
export function formatQty(value: number | string | null | undefined): string {
  const number = Number(value)

  return value === null || value === undefined || value === '' || !Number.isFinite(number) ? '—' : quantityFormat.format(number)
}

/** Accepte la virgule française. Renvoie `NaN` si la saisie n'est pas un nombre. */
export function parseQty(input: string | number | null | undefined): number {
  if (typeof input === 'number')
    return input

  return Number(String(input ?? '').trim().replace(/\s/g, '').replace(',', '.'))
}

/** Un nombre renvoyé par le serveur, prêt à être modifié dans un champ : `'12.500'` → « 12,5 ». */
export const toInput = (value: number | string | null | undefined) => String(Number(value ?? 0)).replace('.', ',')

// Unités ------------------------------------------------------------------------------------------

const UNIT_ALIASES: Record<string, string> = {
  litre: 'l',
  litres: 'l',
  kilo: 'kg',
  kilos: 'kg',
  kilogramme: 'kg',
  gramme: 'g',
  grammes: 'g',
  millilitre: 'ml',
  centilitre: 'cl',
  decilitre: 'dl',
  pieces: 'piece',
  unite: 'piece',
  unites: 'piece',
  portions: 'portion',
  bouteilles: 'bouteille',
  cartons: 'carton',
}

/** Facteur vers l'unité de référence de la grandeur : mêmes tables que `app/services/stock_units.py`. */
const DIMENSIONS: Record<string, Record<string, number>> = {
  masse: { kg: 1000, g: 1, mg: 0.001 },
  volume: { l: 1000, dl: 100, cl: 10, ml: 1 },
}

const UNIT_DISPLAY: Record<string, string> = { l: 'L' }

/** Même normalisation que le serveur : minuscules, sans accents, pluriels usuels ramenés au singulier. */
export function normalizeUnit(unit: string | null | undefined): string {
  const text = normalizeText(unit ?? '').replace(/\./g, '')

  return UNIT_ALIASES[text] ?? text
}

const dimensionOf = (unit: string) => Object.keys(DIMENSIONS).find(name => unit in DIMENSIONS[name]) ?? null

/**
 * Convertit une quantité d'une unité vers une autre ; `null` si c'est impossible côté client (unités de
 * comptage différentes : seul le serveur connaît les conversions propres à un composant).
 */
export function convertQty(quantity: number, from: string, to: string): number | null {
  const source = normalizeUnit(from)
  const target = normalizeUnit(to)

  if (!source || !target || source === target)
    return quantity

  const dimension = dimensionOf(source)

  if (!dimension || dimension !== dimensionOf(target))
    return null

  return quantity * DIMENSIONS[dimension][source] / DIMENSIONS[dimension][target]
}

/** Unités dans lesquelles on peut exprimer ce composant : son unité de stock, plus celles de sa grandeur. */
export function compatibleUnits(stockUnit: string): string[] {
  const dimension = dimensionOf(normalizeUnit(stockUnit))

  if (!dimension)
    return [stockUnit]

  return Object.keys(DIMENSIONS[dimension]).map(unit => UNIT_DISPLAY[unit] ?? unit)
}

/**
 * Combien de portions le disponible permet de servir pour une ligne de fiche technique ; `null` si on ne sait
 * pas convertir l'unité de la ligne en unité de stock.
 */
export function portionsFor(line: { quantite: string | number; unite: string }, stock: StockLevel, stockUnit: string): number | null {
  const need = convertQty(Number(line.quantite), line.unite, stockUnit)

  if (need === null || !Number.isFinite(need) || need <= 0)
    return null

  return Math.max(0, Math.floor(Number(stock.disponible) / need + 1e-9))
}

/** « Protéine » saisi à la main redevient le code `proteine` : pas de doublon de catégorie à cause d'un accent. */
export function normalizeType(input: string | null | undefined): string {
  const key = normalizeText(input ?? '')
  const known = COMPONENT_TYPES.find(code => code === key || normalizeText(TYPE_LABELS[code]) === key)

  return known ?? (input ?? '').trim().toLowerCase()
}

// Règles de champ (messages en français) ---------------------------------------------------------------

/** Plafond du serveur : Numeric(12, 3). */
export const QUANTITY_MAX = 999_999_999.999

/** Nombre de décimales d'une saisie (« 0,250 » → 3). */
export function decimalPlaces(input: string | number | null | undefined): number {
  const match = /[.,](\d+)$/.exec(String(input ?? '').trim().replace(/\s/g, ''))

  return match ? match[1].length : 0
}

export const required = (message: string) => (value: unknown) => (value !== null && value !== undefined && String(value).trim() !== '') || message

export const maxLength = (max: number, label: string) => (value: unknown) =>
  String(value ?? '').trim().length <= max || `${label} : ${max} caractères au plus.`

/** Quantité : > 0 (ou >= 0), au plus 3 décimales et dans les bornes du serveur. */
function quantityRule(allowZero: boolean) {
  const lower = allowZero ? 'Saisissez une quantité positive ou nulle.' : 'Saisissez une quantité supérieure à zéro.'

  return (value: string | number | null) => {
    const number = parseQty(value)

    if (!Number.isFinite(number) || (allowZero ? number < 0 : number <= 0))
      return lower
    if (decimalPlaces(value) > 3)
      return 'Trois décimales au plus (exemple : 0,250).'
    if (number > QUANTITY_MAX)
      return 'Cette quantité est trop grande.'

    return true
  }
}

export const positiveQty = quantityRule(false)
export const nonNegativeQty = quantityRule(true)

/** Montant positif (ou strictement positif), avec au plus `places` décimales. */
export const amountRule = (places: number, { allowZero = true } = {}) => (value: string | number | null) => {
  const number = parseQty(value)

  if (!Number.isFinite(number) || (allowZero ? number < 0 : number <= 0))
    return allowZero ? 'Saisissez un montant positif ou nul.' : 'Saisissez un montant supérieur à zéro.'
  if (decimalPlaces(value) > places)
    return places === 0 ? 'Saisissez un montant entier.' : `${places} décimale${places > 1 ? 's' : ''} au plus.`

  return true
}

// Mouvements --------------------------------------------------------------------------------------------

/** Stock physique après un mouvement ; `null` tant que la quantité saisie n'est pas un nombre. */
export function stockAfterMovement(stock: StockLevel, type: StockMovementType, quantity: number): number | null {
  if (!Number.isFinite(quantity) || quantity < 0)
    return null

  const current = Number(stock.quantite)

  if (type === 'entree')
    return current + quantity
  if (type === 'sortie' || type === 'perte')
    return current - quantity

  return quantity
}

/**
 * Quantité d'un mouvement, contrôlée comme le moteur de stock : une sortie ne dépasse pas le disponible, un
 * ajustement (qui peut valoir 0) ne descend pas sous le réservé. Évite un aller-retour pour une erreur connue.
 */
export function movementQuantityRule(type: StockMovementType, stock: StockLevel | null | undefined) {
  const base = type === 'ajustement' ? nonNegativeQty : positiveQty

  return (value: string | number | null) => {
    const basic = base(value)

    if (basic !== true || !stock)
      return basic

    const number = parseQty(value)
    const available = Number(stock.disponible)
    const reserved = Number(stock.reservee)

    if ((type === 'sortie' || type === 'perte') && number > available)
      return `Seulement ${formatQty(available)} disponible${available > 1 ? 's' : ''} (${formatQty(reserved)} réservé${reserved > 1 ? 's' : ''}).`

    if (type === 'ajustement' && number < reserved)
      return `Le stock ne peut pas descendre sous la quantité réservée (${formatQty(reserved)}).`

    return true
  }
}
