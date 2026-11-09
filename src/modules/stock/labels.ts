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
    help: 'Inventaire : la quantité saisie remplace la quantité actuelle.',
  },
]

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

/** Part de la jauge (0 à 100) : le seuil se trouve à mi-course, comme repère de la jauge. */
export function gaugePercent(stock: StockLevel): number {
  const quantity = Number(stock.quantite)
  const threshold = Number(stock.seuil_alerte)
  const scale = threshold > 0 ? threshold * 2 : Math.max(quantity, 1)

  return Math.max(0, Math.min(100, (quantity / scale) * 100))
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

/** Règles de champ : message en français. */
export const required = (message: string) => (value: unknown) => (value !== null && value !== undefined && String(value).trim() !== '') || message

export const positiveQty = (value: string | number | null) =>
  (Number.isFinite(parseQty(value)) && parseQty(value) > 0) || 'Saisissez une quantité supérieure à zéro.'

export const nonNegativeQty = (value: string | number | null) =>
  (Number.isFinite(parseQty(value)) && parseQty(value) >= 0) || 'Saisissez une quantité positive ou nulle.'
