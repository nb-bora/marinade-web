/**
 * Aménagement de la salle : niveaux (étages), zones (salle, terrasse, bar…) et emplacement des tables.
 *
 * Tout est enregistré côté serveur, sans table de plus :
 *  - les niveaux et les zones vivent dans `config_jsonb.salle` du restaurant ;
 *  - l'emplacement d'une table vit dans `attributs_jsonb.plan` de la table (à côté de `service`).
 * Ainsi chaque poste (tablette, caisse, téléphone du gérant) voit le même plan.
 */
import type { Table, TableUpdate, TableView } from './types'

export type ZoneType = 'salle' | 'terrasse' | 'bar' | 'vip' | 'autre'

export const ZONE_TYPES: { value: ZoneType; title: string; icon: string }[] = [
  { value: 'salle', title: 'Salle intérieure', icon: 'ri-home-4-line' },
  { value: 'terrasse', title: 'Terrasse', icon: 'ri-sun-line' },
  { value: 'bar', title: 'Bar / comptoir', icon: 'ri-goblet-line' },
  { value: 'vip', title: 'Salon privé / VIP', icon: 'ri-vip-crown-line' },
  { value: 'autre', title: 'Autre', icon: 'ri-layout-grid-line' },
]

export interface LevelDef {
  id: string
  nom: string
}

export interface ZoneDef {
  nom: string
  type: ZoneType

  /** Identifiant du niveau où se trouve la zone. */
  niveau: string
}

export interface SalleConfig {
  version: 1
  niveaux: LevelDef[]
  zones: ZoneDef[]
}

export type PlacementShape = 'round' | 'square' | 'rect'

/** Emplacement d'une table : niveau, position en pourcentage du plan du niveau, forme et rotation facultatives. */
export interface Placement {
  niveau: string
  x: number
  y: number
  forme?: PlacementShape
  rot?: number
}

export const DEFAULT_LEVEL: LevelDef = { id: 'rdc', nom: 'Rez-de-chaussée' }

export const defaultSalle = (): SalleConfig => ({ version: 1, niveaux: [{ ...DEFAULT_LEVEL }], zones: [] })

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const isZoneType = (value: unknown): value is ZoneType => ZONE_TYPES.some(type => type.value === value)
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/** Une zone dont le nom évoque une terrasse, un bar ou un salon est classée en conséquence. */
export function guessZoneType(nom: string): ZoneType {
  const n = nom.toLowerCase()

  if (/terrasse|jardin|patio|rooftop|exterieur|extérieur/.test(n))
    return 'terrasse'

  if (/bar|comptoir|lounge/.test(n))
    return 'bar'

  if (/vip|salon|priv/.test(n))
    return 'vip'

  return 'salle'
}

/** Lit `config_jsonb.salle` sans jamais échouer : une config absente ou abîmée donne un seul niveau. */
export function readSalle(config: unknown): SalleConfig {
  const raw = isObject(config) && isObject(config.salle) ? config.salle : null
  const levels: LevelDef[] = []

  for (const item of Array.isArray(raw?.niveaux) ? raw.niveaux : []) {
    if (isObject(item) && typeof item.id === 'string' && typeof item.nom === 'string' && item.id && item.nom.trim() && !levels.some(level => level.id === item.id))
      levels.push({ id: item.id, nom: item.nom.trim() })
  }

  if (!levels.length)
    levels.push({ ...DEFAULT_LEVEL })

  const zones: ZoneDef[] = []

  for (const item of Array.isArray(raw?.zones) ? raw.zones : []) {
    if (!isObject(item) || typeof item.nom !== 'string' || !item.nom.trim() || zones.some(zone => zone.nom === item.nom))
      continue

    zones.push({
      nom: item.nom.trim(),
      type: isZoneType(item.type) ? item.type : guessZoneType(item.nom),
      niveau: typeof item.niveau === 'string' && levels.some(level => level.id === item.niveau) ? item.niveau : levels[0].id,
    })
  }

  return { version: 1, niveaux: levels, zones }
}

/** Fusionne l'aménagement dans la config du restaurant sans toucher aux autres clés (taxes, horaires...). */
export const withSalle = (config: unknown, salle: SalleConfig): Record<string, unknown> => ({
  ...(isObject(config) ? config : {}),
  salle: { version: 1, niveaux: salle.niveaux, zones: salle.zones },
})

/** « Étage 1 » → « etage-1 » : identifiant stable et lisible. */
export function slug(text: string, taken: readonly string[] = []): string {
  const base = text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'niveau'
  let id = base

  for (let i = 2; taken.includes(id); i++)
    id = `${base}-${i}`

  return id
}

// Tables -------------------------------------------------------------------------------

export function placementOf(table: Table): Placement | null {
  const raw = table.attributs_jsonb?.plan

  if (!isObject(raw) || typeof raw.niveau !== 'string' || typeof raw.x !== 'number' || typeof raw.y !== 'number')
    return null

  return {
    niveau: raw.niveau,
    x: clamp(raw.x, 0, 100),
    y: clamp(raw.y, 0, 100),
    forme: formeOf(table),
    rot: typeof raw.rot === 'number' ? raw.rot : undefined,
  }
}

const SHAPE_WORDS: Record<string, PlacementShape> = {
  round: 'round',
  rond: 'round',
  ronde: 'round',
  circulaire: 'round',
  square: 'square',
  carre: 'square',
  carree: 'square',
  rect: 'rect',
  rectangle: 'rect',
  rectangulaire: 'rect',
  longue: 'rect',
}

/**
 * Forme choisie pour la table : `plan.forme`, sinon l'ancienne clé `forme` (« rond », « rectangle »)
 * que l'import Excel écrivait. Indépendante de la position : une table pas encore placée peut avoir sa forme.
 */
export function formeOf(table: Table): PlacementShape | undefined {
  const plan = table.attributs_jsonb?.plan
  const candidates = [isObject(plan) ? plan.forme : undefined, table.attributs_jsonb?.forme]

  for (const raw of candidates) {
    if (typeof raw !== 'string')
      continue

    const shape = SHAPE_WORDS[raw.trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')]

    if (shape)
      return shape
  }

  return undefined
}

export const zoneOf = (table: Table) => table.emplacement?.trim() ? table.emplacement.trim().charAt(0).toUpperCase() + table.emplacement.trim().slice(1) : 'Salle'

/** Niveau d'une table : celui de son emplacement, sinon celui de sa zone, sinon le premier niveau. */
export function levelIdOf(table: Table, salle: SalleConfig): string {
  const placed = placementOf(table)

  if (placed && salle.niveaux.some(level => level.id === placed.niveau))
    return placed.niveau

  const zone = salle.zones.find(item => item.nom.toLowerCase() === zoneOf(table).toLowerCase())

  return zone?.niveau ?? salle.niveaux[0].id
}

export const viewsOfLevel = (views: readonly TableView[], salle: SalleConfig, levelId: string) =>
  views.filter(view => levelIdOf(view.table, salle) === levelId)

export function zoneTypeOf(name: string, salle: SalleConfig): ZoneType {
  return salle.zones.find(zone => zone.nom.toLowerCase() === name.toLowerCase())?.type ?? guessZoneType(name)
}

/** Mise à jour d'une table qui n'écrit que son emplacement (le reste de `attributs_jsonb` est conservé). */
export function withPlacement(table: Table, placement: Placement): TableUpdate {
  return {
    attributs_jsonb: {
      ...table.attributs_jsonb,
      plan: { niveau: placement.niveau, x: Math.round(placement.x * 10) / 10, y: Math.round(placement.y * 10) / 10, ...(placement.forme ? { forme: placement.forme } : {}), ...(placement.rot ? { rot: placement.rot } : {}) },
    },
  }
}

/**
 * Nouveaux `attributs_jsonb` d'une table après un changement de niveau, de position ou de forme :
 * tout le reste (service en cours, autres clés) est conservé. Une forme `null` l'efface ; l'ancienne
 * clé `forme` est retirée dès qu'on en choisit une nouvelle.
 */
export function buildAttributes(
  current: Table['attributs_jsonb'] | undefined,
  patch: { niveau?: string; spot?: { x: number; y: number }; forme?: PlacementShape | null },
): Record<string, unknown> {
  const base: Record<string, unknown> = { ...(isObject(current) ? current : {}) }
  const plan: Record<string, unknown> = isObject(base.plan) ? { ...base.plan } : {}

  if (patch.niveau !== undefined)
    plan.niveau = patch.niveau

  if (patch.spot) {
    plan.x = Math.round(patch.spot.x * 10) / 10
    plan.y = Math.round(patch.spot.y * 10) / 10
  }

  if (patch.forme === null)
    delete plan.forme
  else if (patch.forme)
    plan.forme = patch.forme

  if (patch.forme !== undefined)
    delete base.forme

  if (Object.keys(plan).length)
    base.plan = plan
  else
    delete base.plan

  return base
}

// Places libres ---------------------------------------------------------------------------

/** Places restantes à une table : sa capacité moins les couverts déjà assis (jamais négatif). */
export function freeSeats(view: TableView): number {
  const taken = view.session ? view.covers ?? 0 : 0

  return Math.max(0, view.table.capacite - taken)
}

/** « 2 places libres » / « complète » / « 4 places » : ce que le plan écrit sur une table. */
export function seatsLabel(view: TableView): string {
  const free = freeSeats(view)

  if (!view.session)
    return `${view.table.capacite} place${view.table.capacite > 1 ? 's' : ''}`

  if (view.covers === null)
    return `${view.table.capacite} places`

  return free === 0 ? 'complète' : `${free} place${free > 1 ? 's' : ''} libre${free > 1 ? 's' : ''}`
}

// Opérations sur l'aménagement (pures : elles rendent une nouvelle config) -----------------------

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

export function addLevel(salle: SalleConfig, nom: string): SalleConfig {
  const name = nom.trim()

  if (!name)
    throw new Error('Le nom du niveau est obligatoire.')

  if (salle.niveaux.some(level => sameName(level.nom, name)))
    throw new Error('Un niveau porte déjà ce nom.')

  return { ...salle, niveaux: [...salle.niveaux, { id: slug(name, salle.niveaux.map(level => level.id)), nom: name }] }
}

export function renameLevel(salle: SalleConfig, id: string, nom: string): SalleConfig {
  const name = nom.trim()

  if (!name)
    throw new Error('Le nom du niveau est obligatoire.')

  if (salle.niveaux.some(level => level.id !== id && sameName(level.nom, name)))
    throw new Error('Un autre niveau porte déjà ce nom.')

  return { ...salle, niveaux: salle.niveaux.map(level => level.id === id ? { ...level, nom: name } : level) }
}

/** Monte (-1) ou descend (+1) un niveau dans la liste (du bas vers le haut du bâtiment). */
export function moveLevel(salle: SalleConfig, id: string, direction: -1 | 1): SalleConfig {
  const index = salle.niveaux.findIndex(level => level.id === id)
  const target = index + direction

  if (index < 0 || target < 0 || target >= salle.niveaux.length)
    return salle

  const niveaux = [...salle.niveaux]

  ;[niveaux[index], niveaux[target]] = [niveaux[target], niveaux[index]]

  return { ...salle, niveaux }
}

/** Retire un niveau et ses zones ; refusé s'il reste des tables dessus ou si c'est le dernier niveau. */
export function removeLevel(salle: SalleConfig, id: string, tablesOnLevel: number): SalleConfig {
  if (salle.niveaux.length <= 1)
    throw new Error('Le restaurant doit garder au moins un niveau.')

  if (tablesOnLevel > 0)
    throw new Error(`Ce niveau porte encore ${tablesOnLevel} table${tablesOnLevel > 1 ? 's' : ''} : déplacez-les ou supprimez-les d'abord.`)

  return { ...salle, niveaux: salle.niveaux.filter(level => level.id !== id), zones: salle.zones.filter(zone => zone.niveau !== id) }
}

/** Ajoute une zone, ou remplace celle qui porte le nom `previous`. */
export function upsertZone(salle: SalleConfig, zone: ZoneDef, previous?: string): SalleConfig {
  const name = zone.nom.trim()

  if (!name)
    throw new Error('Le nom de la zone est obligatoire.')

  if (salle.zones.some(item => !sameName(item.nom, previous ?? '') && sameName(item.nom, name)))
    throw new Error('Une zone porte déjà ce nom.')

  const next = { ...zone, nom: name }

  if (previous === undefined)
    return { ...salle, zones: [...salle.zones, next] }

  return { ...salle, zones: salle.zones.map(item => sameName(item.nom, previous) ? next : item) }
}

export function removeZone(salle: SalleConfig, nom: string, tablesInZone: number): SalleConfig {
  if (tablesInZone > 0)
    throw new Error(`Cette zone porte encore ${tablesInZone} table${tablesInZone > 1 ? 's' : ''} : déplacez-les ou supprimez-les d'abord.`)

  return { ...salle, zones: salle.zones.filter(zone => !sameName(zone.nom, nom)) }
}

/**
 * Numéros des prochaines tables : « T1, T2… » à la suite des numéros existants du même préfixe
 * (jamais un numéro déjà pris, même s'il manque un trou plus bas).
 */
export function nextTableNumbers(existing: readonly string[], prefix: string, count: number): string[] {
  const taken = new Set(existing.map(numero => numero.toLowerCase()))
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)
  const pattern = new RegExp(`^${escaped}(\\d+)$`, 'i')
  let n = existing.reduce((max, numero) => Math.max(max, Number(pattern.exec(numero)?.[1] ?? 0)), 0)
  const result: string[] = []

  while (result.length < count) {
    n++

    const numero = `${prefix}${n}`

    if (!taken.has(numero.toLowerCase()))
      result.push(numero)
  }

  return result
}
