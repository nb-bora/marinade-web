import type { CaParService, EditableLine, HistoryEventType, MachineCategory, MachineMode, MachineState, MaintenanceType, RoundingMode, RoundingStep, ZoneType } from './types'
import { formatMoney } from '@/lib/format'
import { describeError } from '@/lib/http/errorMessages'
import { isApiError } from '@/lib/http/errors'
import { formatNational } from '@/lib/phone'

export const DEFAULT_KILO_PRICE = 500

export const STEP_LABELS: Record<RoundingStep, string> = {
  1: 'Au gramme près',
  100: '100 g',
  500: '500 g',
  1000: '1 kg',
}

export const MODE_LABELS: Record<RoundingMode, string> = {
  superieur: 'Facturer le kilo entamé en entier',
  proche: 'Arrondir au plus proche',
}

export const MODE_HINTS: Record<RoundingMode, string> = {
  superieur: 'Toute fraction commencée est facturée en entier.',
  proche: 'La fraction est arrondie au palier le plus proche, la moitié vers le haut.',
}

/** Exemples chiffrés de l'aperçu de l'arrondi, en grammes pesés. */
export const PREVIEW_WEIGHTS = [3400, 2050, 350]

/** Poids facturable en grammes selon la règle d'arrondi du pressing (aperçu uniquement). */
export function billableGrams(grams: number, step: number, mode: RoundingMode): number {
  if (grams <= 0 || step <= 0)
    return 0

  return mode === 'superieur'
    ? Math.ceil(grams / step) * step
    : Math.floor(grams / step + 0.5) * step
}

/** Montant du lavage pour un poids facturable (le prix s'entend par kilo). */
export const washAmount = (grams: number, kiloPrice: number) => Math.round(grams * kiloPrice / 1000)

/** `3400` devient « 3,4 kg ». */
export function formatKg(grams: number): string {
  return `${(grams / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 3 })} kg`
}

/** « 3,4 » ou « 3.4 » en grammes entiers ; texte invalide : message à afficher. */
export function parseKg(text: string): { grams: number } | { error: string } {
  const value = text.trim().replace(/\s/g, '')

  if (value === '')
    return { error: 'Saisissez le poids du linge en kilogrammes, par exemple 3,4.' }

  if (!/^\d+(?:[.,]\d*)?$/.test(value))
    return { error: 'Le poids doit être un nombre positif, par exemple 3,4.' }

  const decimals = value.split(/[.,]/)[1] ?? ''

  if (decimals.length > 3)
    return { error: 'Trois décimales au plus : le poids est connu au gramme près.' }

  const grams = Math.round(Number(value.replace(',', '.')) * 1000)

  return grams > 0 ? { grams } : { error: 'Le poids doit être supérieur à 0.' }
}

/** Entier positif ou nul saisi dans un champ, ou `null`. */
export function toInt(text: string | number | null | undefined): number | null {
  const value = String(text ?? '').trim()

  return /^\d+$/.test(value) ? Number(value) : null
}

export const normalize = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

let uid = 0

export const newLine = (id: string | null = null, quantite = '1'): EditableLine => ({ uid: ++uid, id, quantite })

/** Les lignes complètes (choix + quantité entière au moins 1), fusionnées par élément. */
export function mergedLines(lines: EditableLine[]): Array<{ id: string; quantite: number }> {
  const totals = new Map<string, number>()

  for (const line of lines) {
    const quantite = toInt(line.quantite)

    if (line.id && quantite !== null && quantite >= 1)
      totals.set(line.id, (totals.get(line.id) ?? 0) + quantite)
  }

  return [...totals].map(([id, quantite]) => ({ id, quantite }))
}

/**
 * Message à montrer pour une réponse du serveur. Les refus métier du pressing (doublon, article
 * désactivé, remise trop haute...) sont rédigés pour l'utilisateur : on les affiche tels quels.
 */
export function pressingError(error: unknown): string {
  if (isApiError(error) && ['validation', 'conflict', 'client'].includes(error.kind) && !/^HTTP \d+$/.test(error.message))
    return error.message

  return describeError(error)
}

// --- Parc de machines et plan ---------------------------------------------------------------

export interface StateInfo {
  label: string
  icon: string

  /** Couleur du thème Vuetify, ou valeur hexadécimale pour les états sans équivalent. */
  color: string

  /** Valeur CSS de la variable `--c` du plan (triplet « r, g, b »). */
  rgb: string
  hint: string
}

/** Les sept états opérationnels d'une machine : libellé, icône, couleur et sens en une phrase. */
export const STATE_INFO: Record<MachineState, StateInfo> = {
  libre: { label: 'Libre', icon: 'ri-checkbox-circle-line', color: 'success', rgb: 'var(--v-theme-success)', hint: 'Prête à recevoir une charge.' },
  reservee: { label: 'Réservée', icon: 'ri-bookmark-line', color: 'info', rgb: 'var(--v-theme-info)', hint: 'Gardée pour une commande, pas encore lancée.' },
  en_cycle: { label: 'En cycle', icon: 'ri-refresh-line', color: 'primary', rgb: 'var(--v-theme-primary)', hint: 'Un programme tourne en ce moment.' },
  cycle_termine: { label: 'Cycle terminé', icon: 'ri-check-double-line', color: 'warning', rgb: 'var(--v-theme-warning)', hint: 'Le programme est fini, le linge est dans le tambour.' },
  attente_dechargement: { label: 'À décharger', icon: 'ri-hourglass-line', color: 'warning', rgb: 'var(--v-theme-warning)', hint: 'Le linge attend d\'être sorti de la machine.' },
  maintenance: { label: 'En maintenance', icon: 'ri-tools-line', color: '#8E5CF7', rgb: '142, 92, 247', hint: 'Entretien ou réparation en cours.' },
  hors_service: { label: 'Hors service', icon: 'ri-forbid-line', color: '#7C8798', rgb: '124, 135, 152', hint: 'Indisponible jusqu\'à nouvel ordre.' },
}

export const STATES = Object.keys(STATE_INFO) as MachineState[]

export const STATE_OPTIONS = STATES.map(value => ({ value, title: STATE_INFO[value].label }))

/** Groupes d'états pour le tableau de bord : une tuile par groupe. */
export const STATE_GROUPS: Array<{ id: string; label: string; icon: string; color: string; states: MachineState[] }> = [
  { id: 'libres', label: 'Libres', icon: 'ri-checkbox-circle-line', color: 'success', states: ['libre'] },
  { id: 'occupees', label: 'Occupées', icon: 'ri-refresh-line', color: 'primary', states: ['en_cycle', 'cycle_termine', 'attente_dechargement'] },
  { id: 'reservees', label: 'Réservées', icon: 'ri-bookmark-line', color: 'info', states: ['reservee'] },
  { id: 'maintenance', label: 'En maintenance', icon: 'ri-tools-line', color: '#8E5CF7', states: ['maintenance'] },
  { id: 'hors_service', label: 'Hors service', icon: 'ri-forbid-line', color: '#7C8798', states: ['hors_service'] },
]

/** Transitions que le serveur accepte (`POST /machines/{id}/etat`) ; toute autre est refusée en 409. */
export const TRANSITIONS: Record<MachineState, MachineState[]> = {
  libre: ['reservee', 'en_cycle', 'maintenance', 'hors_service'],
  reservee: ['libre', 'en_cycle'],
  en_cycle: ['cycle_termine'],
  cycle_termine: ['attente_dechargement', 'libre'],
  attente_dechargement: ['libre'],
  maintenance: ['libre', 'hors_service'],
  hors_service: ['libre', 'maintenance'],
}

/** États qui exigent un motif écrit. */
export const MOTIF_REQUIRED: readonly MachineState[] = ['maintenance', 'hors_service']

/** Passages qui restent possibles pour une machine liée à une commande : le reste passe par la commande. */
const TRANSITIONS_HORS_COMMANDE: readonly MachineState[] = ['maintenance', 'hors_service']

/**
 * Passages proposés à partir de l'état courant. Une machine liée à une commande n'en garde que la
 * maintenance et la mise hors service, et seulement hors cycle : le reste casserait la commande.
 */
export function transitionsPermises(etat: MachineState, liee: boolean): MachineState[] {
  if (!liee)
    return TRANSITIONS[etat]

  if (etat === 'en_cycle')
    return []

  return TRANSITIONS[etat].filter(target => TRANSITIONS_HORS_COMMANDE.includes(target))
}

/** Texte du bouton de chaque transition, selon l'état visé. */
export const TRANSITION_ACTION: Record<MachineState, string> = {
  libre: 'Remettre en service',
  reservee: 'Réserver',
  en_cycle: 'Lancer un cycle',
  cycle_termine: 'Marquer le cycle terminé',
  attente_dechargement: 'Signaler à décharger',
  maintenance: 'Mettre en maintenance',
  hors_service: 'Déclarer hors service',
}

export const CATEGORY_INFO: Record<MachineCategory, { label: string; icon: string; color: string }> = {
  lave_linge: { label: 'Lave-linge', icon: 'ri-drop-line', color: 'info' },
  seche_linge: { label: 'Sèche-linge', icon: 'ri-temp-hot-line', color: 'warning' },
}

export const CATEGORY_OPTIONS = (Object.keys(CATEGORY_INFO) as MachineCategory[]).map(value => ({ value, title: CATEGORY_INFO[value].label }))

export const MODE_INFO: Record<MachineMode, { label: string; hint: string }> = {
  automatique: { label: 'Automatique', hint: 'La machine mène le cycle seule, sans intervention.' },
  semi_automatique: { label: 'Semi-automatique', hint: 'Un opérateur intervient pendant le cycle (ajout de produit, retournement...).' },
  autre: { label: 'Autre', hint: 'Fonctionnement particulier, à préciser dans les contraintes d\'utilisation.' },
}

export const MODE_OPTIONS = (Object.keys(MODE_INFO) as MachineMode[]).map(value => ({ value, title: MODE_INFO[value].label }))

export const ZONE_INFO: Record<ZoneType, { label: string; color: string; hint: string }> = {
  lavage: { label: 'Lavage', color: '#3B82F6', hint: 'Là où se trouvent les lave-linge.' },
  sechage: { label: 'Séchage', color: '#F59E0B', hint: 'Là où se trouvent les sèche-linge.' },
  reception: { label: 'Réception', color: '#10B981', hint: 'Dépôt et retrait du linge par les clients.' },
  attente: { label: 'Attente', color: '#8B5CF6', hint: 'Linge en attente de traitement.' },
  pliage: { label: 'Pliage', color: '#EC4899', hint: 'Repassage, pliage et emballage.' },
  stockage: { label: 'Stockage', color: '#64748B', hint: 'Produits, sacs et linge prêt à rendre.' },
  autre: { label: 'Autre', color: '#94A3B8', hint: 'Toute autre partie du local.' },
}

export const ZONE_OPTIONS = (Object.keys(ZONE_INFO) as ZoneType[]).map(value => ({ value, title: ZONE_INFO[value].label }))

/** Icône Remix de chaque type de zone (menus et fiches ; le plan dessine les tracés ci-dessous). */
export const ZONE_ICON: Record<ZoneType, string> = {
  lavage: 'ri-drop-line',
  sechage: 'ri-temp-hot-line',
  reception: 'ri-customer-service-2-line',
  attente: 'ri-time-line',
  pliage: 'ri-t-shirt-line',
  stockage: 'ri-archive-line',
  autre: 'ri-layout-grid-line',
}

/** Tracés Remix (grille 24 × 24) des icônes de zone, dessinés dans le plan SVG. */
export const ZONE_ICON_PATH: Record<ZoneType, string> = {
  lavage: 'm12 3.097l-4.95 4.95a7 7 0 1 0 9.9 0zM12 .27l6.364 6.364a9 9 0 1 1-12.728 0z',
  sechage: 'M8 5a4 4 0 1 1 8 0v5.255a7 7 0 1 1-8 0zm1.144 6.895a5 5 0 1 0 5.712 0L14 11.298V5a2 2 0 1 0-4 0v6.298zm1.856.231V5h2v7.126A4.002 4.002 0 0 1 12 20a4 4 0 0 1-1-7.874M12 18a2 2 0 1 0 0-4a2 2 0 0 0 0 4',
  reception: 'M19.938 8H21a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-1.062A8 8 0 0 1 12 23v-2a6 6 0 0 0 6-6V9A6 6 0 0 0 6 9v7H3a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h1.062a8.001 8.001 0 0 1 15.876 0M3 10v4h1v-4zm17 0v4h1v-4zM7.76 15.785l1.06-1.696A5.97 5.97 0 0 0 12 15a5.97 5.97 0 0 0 3.18-.911l1.06 1.696A7.96 7.96 0 0 1 12 17a7.96 7.96 0 0 1-4.24-1.215',
  attente: 'M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10s-4.477 10-10 10m0-2a8 8 0 1 0 0-16a8 8 0 0 0 0 16m1-8h4v2h-6V7h2z',
  pliage: 'm14.514 5l2.606-2.607a1 1 0 0 1 1.414 0l4.243 4.243a1 1 0 0 1 0 1.414l-3.778 3.778V21a1 1 0 0 1-1 1h-12a1 1 0 0 1-1-1v-9.17L1.22 8.05a1 1 0 0 1 0-1.414l4.242-4.243a1 1 0 0 1 1.414 0L9.484 5zm.828 2H8.656L6.17 4.515L3.342 7.343L6.999 11v9h10v-9l3.657-3.657l-2.829-2.828z',
  stockage: 'M3 10H2V4.003C2 3.449 2.455 3 2.992 3h18.016A.99.99 0 0 1 22 4.003V10h-1v10.002a.996.996 0 0 1-.993.998H3.993A.996.996 0 0 1 3 20.002zm16 0H5v9h14zM4 5v3h16V5zm5 7h6v2H9z',
  autre: 'M21 3a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM11 13H4v6h7zm9 0h-7v6h7zm-9-8H4v6h7zm9 0h-7v6h7z',
}

/** Palette proposée pour colorer une zone (lisible en clair comme en sombre). */
export const ZONE_COLORS = ['#3B82F6', '#F59E0B', '#10B981', '#8B5CF6', '#EC4899', '#64748B', '#E67E22', '#14B8A6', '#EF4444', '#94A3B8']

export const MAINTENANCE_INFO: Record<MaintenanceType, { label: string; icon: string; color: string }> = {
  entretien: { label: 'Entretien', icon: 'ri-brush-line', color: 'info' },
  panne: { label: 'Panne', icon: 'ri-alarm-warning-line', color: 'error' },
  reparation: { label: 'Réparation', icon: 'ri-tools-line', color: 'warning' },
}

export const MAINTENANCE_OPTIONS = (Object.keys(MAINTENANCE_INFO) as MaintenanceType[]).map(value => ({ value, title: MAINTENANCE_INFO[value].label }))

export const HISTORY_INFO: Record<HistoryEventType, { label: string; icon: string; color: string }> = {
  etat_change: { label: 'Changement d\'état', icon: 'ri-swap-line', color: 'primary' },
  maintenance: { label: 'Maintenance', icon: 'ri-tools-line', color: 'warning' },
  note: { label: 'Note', icon: 'ri-sticky-note-line', color: 'secondary' },
}

/** Types de linge proposés en un clic dans l'éditeur de programmes (la saisie reste libre). */
export const LINEN_SUGGESTIONS = ['coton', 'delicat', 'synthetique', 'laine', 'drap', 'couette', 'serviette', 'tout']

/** « 8.00 » devient « 8 kg » et « 8.50 » « 8,5 kg ». */
export function formatCapacity(value: string | number | null | undefined): string {
  const number = Number(value)

  return Number.isFinite(number) ? `${number.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} kg` : '—'
}

/** 65 minutes deviennent « 1 h 05 », 40 minutes « 40 min ». */
export function formatMinutes(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined)
    return '—'

  if (minutes < 60)
    return `${minutes} min`

  const rest = minutes % 60

  return `${Math.floor(minutes / 60)} h${rest ? ` ${String(rest).padStart(2, '0')}` : ''}`
}

export const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count > 1 ? many : one}`

// --- Caisse, clients, rapports ----------------------------------------------------------------

export const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

export const isDayKey = (value: string | null | undefined): value is string => /^\d{4}-\d{2}-\d{2}$/.test(value ?? '')

const dayFromKey = (key: string) => {
  const [year, month, day] = key.split('-').map(Number)

  return new Date(Date.UTC(year, month - 1, day))
}

const longDay = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
const shortDay = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const mediumDay = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
const numericDay = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })

/** Jour AAAA-MM-JJ en toutes lettres : « lundi 12 octobre 2026 ». */
export const formatDayLong = (key: string) => longDay.format(dayFromKey(key))

/** « 12 oct. » (axes des graphiques). */
export const formatDayShort = (key: string) => shortDay.format(dayFromKey(key))

/** « 12 octobre 2026 ». */
export const formatDayMedium = (key: string) => mediumDay.format(dayFromKey(key))

/** « 12/10/2026 » (exports CSV). */
export const formatDayNumeric = (key: string) => numericDay.format(dayFromKey(key))

/** Nombre de jours de `du` à `au`, bornes incluses. */
export const daysBetween = (du: string, au: string) => Math.round((dayFromKey(au).getTime() - dayFromKey(du).getTime()) / 86_400_000) + 1

/** Montant signé : une annulation (montant négatif) s'écrit « − 1 500 FCFA ». */
export const formatSignedMoney = (amount: number) => (amount < 0 ? `− ${formatMoney(-amount)}` : formatMoney(amount))

/** Libellé d'une ligne du journal de montant négatif (contre-passation d'un paiement). */
export const ANNULATION_LABEL = 'Annulation'

export type JourChoix = 'aujourdhui' | 'hier' | 'autre'

export const JOUR_OPTIONS: Array<{ value: JourChoix; title: string }> = [
  { value: 'aujourdhui', title: 'Aujourd\'hui' },
  { value: 'hier', title: 'Hier' },
  { value: 'autre', title: 'Autre jour' },
]

export interface EcartInfo {
  color: 'success' | 'warning' | 'error'
  icon: string
  title: string

  /** Phrase complète, prête à afficher. */
  text: string
}

/** Écart de caisse (espèces comptées moins espèces attendues) : couleur, icône et phrase. */
export function ecartInfo(ecart: number): EcartInfo {
  if (ecart === 0)
    return { color: 'success', icon: 'ri-checkbox-circle-line', title: 'Caisse juste', text: 'Le compte est juste : aucun écart avec les espèces attendues.' }

  if (ecart > 0)
    return { color: 'warning', icon: 'ri-error-warning-line', title: 'Excédent', text: `Il y a ${formatMoney(ecart)} de plus que prévu en caisse.` }

  return { color: 'error', icon: 'ri-alarm-warning-line', title: 'Manque', text: `Il manque ${formatMoney(-ecart)} en caisse.` }
}

export type PeriodeChoix = '7' | '30' | '90' | 'perso'

export const PERIODE_OPTIONS: Array<{ value: PeriodeChoix; title: string }> = [
  { value: '7', title: '7 jours' },
  { value: '30', title: '30 jours' },
  { value: '90', title: '90 jours' },
  { value: 'perso', title: 'Personnalisée' },
]

/** Période la plus longue que le serveur accepte pour un rapport. */
export const PERIODE_MAX_JOURS = 366

export const SERVICE_INFO: Record<keyof CaParService, { label: string; icon: string; color: 'primary' | 'info' | 'warning' | 'success' }> = {
  lavage: { label: 'Lavage', icon: 'ri-drop-line', color: 'info' },
  sechage: { label: 'Séchage', icon: 'ri-temp-hot-line', color: 'warning' },
  articles: { label: 'Articles à l\'unité', icon: 'ri-t-shirt-line', color: 'primary' },
  combinaisons: { label: 'Combinaisons', icon: 'ri-stack-line', color: 'success' },
}

export const SERVICES = Object.keys(SERVICE_INFO) as Array<keyof CaParService>

/** Numéro camerounais mis en forme (« +237 6 77 12 34 56 ») ; tout autre numéro reste tel quel. */
export function formatPhone(value: string | null | undefined): string {
  if (!value)
    return ''

  const match = value.replace(/\D/g, '').match(/^(?:237)?(6\d{8})$/)

  return match ? `+237 ${formatNational(match[1])}` : value
}

/** Deux initiales (« Mme Awa Ndiaye » donne « AN » : les civilités sont ignorées). */
export function initials(name: string): string {
  const words = name.replace(/\b(m|mme|mlle|mr|dr)\b\.?/gi, ' ').split(/\s+/).filter(word => /\p{L}/u.test(word))
  const letters = words.length > 1 ? [words[0], words[words.length - 1]] : words

  return letters.map(word => word.match(/\p{L}/u)?.[0] ?? '').join('').toUpperCase() || '?'
}

const AVATAR_COLORS = ['primary', 'info', 'success', 'warning', 'secondary'] as const

/** Couleur stable d'un avatar, tirée du nom (le même client garde la même couleur). */
export function avatarColor(seed: string): typeof AVATAR_COLORS[number] {
  let hash = 0

  for (const char of seed)
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0

  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}
