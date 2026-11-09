import type { Ref } from 'vue'
import type { PlanState } from '../labels'
import { formeOf, placementOf } from '../layout'
import { locationOf, tableState } from '../service'
import type { SessionStatus, TableView } from '../types'

/** Position d'une table sur le plan, en pourcentage de la largeur (x) et de la hauteur (y). */
export interface PlanPoint {
  x: number
  y: number
}

export type PlanShape = 'round' | 'square' | 'rect'

export interface PlanWorld {
  width: number
  height: number
}

export interface PlanChair {
  x: number
  y: number
  taken: boolean
}

/** Une table prête à être dessinée : coordonnées en unités du plan, forme, chaises. */
export interface PlanNode {
  id: string
  view: TableView
  state: PlanState
  zone: string
  shape: PlanShape
  cx: number
  cy: number
  width: number
  height: number
  chairs: PlanChair[]

  /** Rotation de la table et de ses chaises, en degrés (le texte reste droit). */
  rot: number
}

/** Le plan est dessiné dans un repère de 160 × 90 unités (16/9) ; en compact (téléphone), 100 × 75 (4/3). */
export const WIDE_WORLD: PlanWorld = { width: 160, height: 90 }
export const COMPACT_WORLD: PlanWorld = { width: 100, height: 75 }

/** Les tables ne sortent jamais du plan : marge en pourcentage. */
const MARGIN_X = 6
const MARGIN_Y = 9

/** Plus de place en bas : les boutons de zoom y sont posés. */
const MARGIN_BOTTOM = 16

/** Espace laissé entre deux zones, en rangées de tables. */
const ZONE_GAP = 0.7

const PAYING: readonly SessionStatus[] = ['PAYMENT_PENDING', 'PARTIALLY_PAID']

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/** Nombre stable dans [0, 1[ tiré d'un texte : une table sans place libre se pose toujours au même endroit. */
function hash01(text: string, salt: number): number {
  let h = 2166136261 ^ salt

  for (let i = 0; i < text.length; i++)
    h = Math.imul(h ^ text.charCodeAt(i), 16777619)

  return ((h >>> 0) % 10000) / 10000
}

export function planStateOf(view: TableView): PlanState {
  if (view.session)
    return PAYING.includes(view.session.status) ? 'paying' : 'busy'

  const state = tableState(view)

  if (state === 'reservee')
    return 'reserved'

  return state === 'maintenance' || state === 'settled' ? state : 'free'
}

export function shapeOf(capacity: number): PlanShape {
  if (capacity <= 2)
    return 'round'

  return capacity <= 4 ? 'square' : 'rect'
}

/** Dimensions d'une table à l'échelle 1, en unités du plan. */
function sizeOf(shape: PlanShape, capacity: number): { width: number; height: number } {
  if (shape === 'round') {
    const diameter = 11 + Math.min(capacity, 6) * 0.8

    return { width: diameter, height: diameter }
  }

  if (shape === 'square')
    return { width: 13.5, height: 13.5 }

  return { width: 14 + (Math.min(capacity, 12) - 4) * 1.6, height: 12.5 }
}

/** Chaises autour de la table ; les premières sont « prises » à hauteur du nombre de couverts. */
function chairsOf(shape: PlanShape, width: number, height: number, capacity: number, covers: number): PlanChair[] {
  const count = Math.min(Math.max(capacity, 1), 12)
  const gap = 2.4
  const chairs: PlanChair[] = []

  if (shape === 'round') {
    const radius = width / 2 + gap

    for (let index = 0; index < count; index++) {
      const angle = (index / count) * Math.PI * 2 - Math.PI / 2

      chairs.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, taken: index < covers })
    }

    return chairs
  }

  // Tables carrées et rectangulaires : chaises réparties sur les deux grands côtés.
  const top = Math.ceil(count / 2)
  const bottom = count - top

  const row = (amount: number, y: number, offset: number) => {
    for (let index = 0; index < amount; index++) {
      const x = ((index + 0.5) / amount - 0.5) * (width - 2)

      chairs.push({ x, y, taken: offset + index < covers })
    }
  }

  row(top, -(height / 2 + gap), 0)
  row(bottom, height / 2 + gap, top)

  return chairs
}

/** Grille de repli : `count` emplacements répartis sur le plan, en pourcentages. */
export function gridSlots(count: number, aspect = 1.6): { slots: PlanPoint[]; cols: number; rows: number } {
  const cols = Math.max(1, Math.ceil(Math.sqrt(count * aspect)))
  const rows = Math.max(1, Math.ceil(count / cols))
  const slots: PlanPoint[] = []

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      slots.push({
        x: MARGIN_X + ((col + 0.5) / cols) * (100 - MARGIN_X * 2),
        y: MARGIN_Y + ((row + 0.5) / rows) * (100 - MARGIN_Y - MARGIN_BOTTOM),
      })
    }
  }

  return { slots, cols, rows }
}

/**
 * Disposition automatique « par zones » : chaque zone occupe ses propres rangées (la terrasse ne se
 * mélange pas à la salle), les tables d'une zone sont alignées de gauche à droite puis de haut en bas.
 * `zones` donne, dans l'ordre de placement, la zone de chaque table.
 */
export function zonedLayout(
  zones: readonly { id: string; zone: string }[],
  aspect = 1.6,
): { layout: Record<string, PlanPoint>; cols: number; rows: number } {
  const cols = Math.max(1, Math.ceil(Math.sqrt(zones.length * aspect)))
  const groups = new Map<string, string[]>()

  for (const { id, zone } of zones)
    groups.set(zone, [...(groups.get(zone) ?? []), id])

  const rows = Math.max(1, [...groups.values()].reduce((sum, ids) => sum + Math.ceil(ids.length / cols), 0) + Math.max(0, groups.size - 1) * ZONE_GAP)
  const layout: Record<string, PlanPoint> = {}
  let rowOffset = 0

  for (const ids of groups.values()) {
    ids.forEach((id, index) => {
      const col = index % cols
      const row = rowOffset + Math.floor(index / cols)

      layout[id] = {
        x: Math.round((MARGIN_X + ((col + 0.5) / cols) * (100 - MARGIN_X * 2)) * 10) / 10,
        y: Math.round((MARGIN_Y + ((row + 0.5) / rows) * (100 - MARGIN_Y - MARGIN_BOTTOM)) * 10) / 10,
      }
    })

    // Un demi-rang d'air entre deux zones : leurs cadres ne se touchent pas.
    rowOffset += Math.ceil(ids.length / cols) + ZONE_GAP
  }

  return { layout, cols, rows }
}

/**
 * Complète la disposition : les tables sans position prennent le premier emplacement de la
 * grille qu'aucune autre table n'occupe. Ne déplace jamais une table déjà placée.
 */
export function completeLayout(
  layout: Record<string, PlanPoint>,
  ordered: readonly string[],
  aspect = 1.6,
): Record<string, PlanPoint> | null {
  const missing = ordered.filter(id => !layout[id])

  if (!missing.length)
    return null

  const { slots, cols, rows } = gridSlots(ordered.length, aspect)
  const gap = Math.min((100 - MARGIN_X * 2) / cols, (100 - MARGIN_Y - MARGIN_BOTTOM) / rows) * 0.55
  const taken: PlanPoint[] = ordered.filter(id => layout[id]).map(id => layout[id])
  const next = { ...layout }

  for (const id of missing) {
    const free = slots.find(slot => taken.every(point => Math.hypot(point.x - slot.x, (point.y - slot.y) * 1.4) >= gap))
    const spot = free ?? { x: MARGIN_X + hash01(id, 1) * (100 - MARGIN_X * 2), y: MARGIN_Y + hash01(id, 2) * (100 - MARGIN_Y - MARGIN_BOTTOM) }

    next[id] = { x: Math.round(spot.x * 10) / 10, y: Math.round(spot.y * 10) / 10 }
    taken.push(spot)
  }

  return next
}

/**
 * Positions effectives des tables d'un niveau (en %) : l'emplacement enregistré de chacune, et pour
 * celles qui n'en ont pas, la disposition automatique par zones. Partagé par le plan 2D et la vue 3D.
 */
export function positionsOf(views: readonly TableView[], aspect = WIDE_WORLD.width / WIDE_WORLD.height): Record<string, PlanPoint> {
  const ordered = [...views].sort((a, b) => locationOf(a.table).localeCompare(locationOf(b.table), 'fr')
    || a.table.numero.localeCompare(b.table.numero, 'fr', { numeric: true, sensitivity: 'base' }))

  if (!ordered.length)
    return {}

  const saved: Record<string, PlanPoint> = {}

  for (const view of ordered) {
    const placed = placementOf(view.table)

    if (placed)
      saved[view.table.id] = { x: placed.x, y: placed.y }
  }

  if (!Object.keys(saved).length)
    return zonedLayout(ordered.map(view => ({ id: view.table.id, zone: locationOf(view.table) })), aspect).layout

  return completeLayout(saved, ordered.map(view => view.table.id), aspect) ?? saved
}

/**
 * Premier emplacement libre d'un niveau, en %, sans déplacer aucune table : celle qu'on y ajoute ou
 * qu'on y envoie se pose là où il y a de la place.
 */
export function freeSpot(levelViews: readonly TableView[], aspect = WIDE_WORLD.width / WIDE_WORLD.height): PlanPoint {
  const base = positionsOf(levelViews, aspect)
  const ghost = '__spot__'

  return completeLayout(base, [...levelViews.map(view => view.table.id), ghost], aspect)?.[ghost] ?? { x: 50, y: 50 }
}

/** Disposition automatique de toutes les tables d'un niveau (bouton « Ranger automatiquement »). */
export function autoLayoutOf(views: readonly TableView[], aspect = WIDE_WORLD.width / WIDE_WORLD.height): Record<string, PlanPoint> {
  const ordered = [...views].sort((a, b) => locationOf(a.table).localeCompare(locationOf(b.table), 'fr')
    || a.table.numero.localeCompare(b.table.numero, 'fr', { numeric: true, sensitivity: 'base' }))

  return zonedLayout(ordered.map(view => ({ id: view.table.id, zone: locationOf(view.table) })), aspect).layout
}

/**
 * Disposition du plan d'UN niveau : l'emplacement enregistré de chaque table (`attributs_jsonb.plan`),
 * une disposition automatique par zones pour celles qui n'en ont pas encore, dimensions selon la
 * capacité. Un déplacement vit ici jusqu'au relâchement : `endDrag` rend alors la position à enregistrer.
 */
export function useFloorPlan(views: Ref<TableView[]>, compact: Ref<boolean>) {
  const world = computed<PlanWorld>(() => compact.value ? COMPACT_WORLD : WIDE_WORLD)
  const aspect = computed(() => world.value.width / world.value.height)

  // Ordre de placement : par zone puis par numéro, pour que chaque zone reste groupée.
  const ordered = computed(() => [...views.value]
    .sort((a, b) => locationOf(a.table).localeCompare(locationOf(b.table), 'fr')
      || a.table.numero.localeCompare(b.table.numero, 'fr', { numeric: true, sensitivity: 'base' }))
    .map(view => view.table.id))

  const zoneList = computed(() => ordered.value.map(id => {
    const view = views.value.find(item => item.table.id === id)!

    return { id, zone: locationOf(view.table) }
  }))

  /** Positions effectives : enregistrées, complétées (sans jamais déplacer une table déjà placée). */
  const positions = computed<Record<string, PlanPoint>>(() => positionsOf(views.value, aspect.value))

  /** Table en cours de déplacement : sa position vit ici jusqu'au relâchement. */
  const dragging = ref<{ id: string } & PlanPoint | null>(null)

  const pointOf = (id: string): PlanPoint => {
    if (dragging.value?.id === id)
      return dragging.value

    return positions.value[id] ?? { x: 50, y: 50 }
  }

  /** Réduit les tables quand la salle est dense, pour qu'elles ne se chevauchent pas. */
  const scale = computed(() => {
    const { cols, rows } = zonedLayout(zoneList.value, aspect.value)
    const width = world.value.width * (100 - MARGIN_X * 2) / 100 / cols
    const height = world.value.height * (100 - MARGIN_Y - MARGIN_BOTTOM) / 100 / rows

    return clamp(Math.min(width, height) / 20, 0.5, 1)
  })

  const nodes = computed<PlanNode[]>(() => views.value.map(view => {
    const placed = placementOf(view.table)
    const shape = formeOf(view.table) ?? shapeOf(view.table.capacite)
    const base = sizeOf(shape, view.table.capacite)
    const width = base.width * scale.value
    const height = base.height * scale.value
    const point = pointOf(view.table.id)
    const covers = view.session ? view.covers ?? 0 : 0

    return {
      id: view.table.id,
      view,
      state: planStateOf(view),
      zone: locationOf(view.table),
      shape,
      cx: point.x / 100 * world.value.width,
      cy: point.y / 100 * world.value.height,
      width,
      height,
      rot: placed?.rot ?? 0,
      chairs: chairsOf(shape, width, height, view.table.capacite, covers)
        .map(chair => ({ ...chair, x: chair.x * scale.value, y: chair.y * scale.value })),
    }
  }))

  function startDrag(id: string, point: PlanPoint) {
    dragging.value = { id, ...toPercent(point) }
  }

  /** Les coordonnées reçues sont en unités du plan. */
  function toPercent(point: PlanPoint): PlanPoint {
    return {
      x: clamp(point.x / world.value.width * 100, MARGIN_X, 100 - MARGIN_X),
      y: clamp(point.y / world.value.height * 100, MARGIN_Y, 100 - MARGIN_BOTTOM),
    }
  }

  function dragTo(point: PlanPoint) {
    if (dragging.value)
      dragging.value = { id: dragging.value.id, ...toPercent(point) }
  }

  /** Termine le déplacement et rend la position (en %) à enregistrer, ou `null` si rien ne bougeait. */
  function endDrag(): ({ id: string } & PlanPoint) | null {
    const current = dragging.value

    dragging.value = null

    return current ? { id: current.id, x: Math.round(current.x * 10) / 10, y: Math.round(current.y * 10) / 10 } : null
  }

  return { nodes, world, scale, dragging, startDrag, dragTo, endDrag }
}
