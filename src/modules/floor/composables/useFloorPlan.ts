import { useStorage } from '@vueuse/core'
import type { Ref } from 'vue'
import type { PlanState } from '../labels'
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
}

export const LAYOUT_KEY = 'marinade.floor.layout'

/** Le plan est dessiné dans un repère de 160 × 90 unités (16/9) ; en compact (téléphone), 100 × 75 (4/3). */
export const WIDE_WORLD: PlanWorld = { width: 160, height: 90 }
export const COMPACT_WORLD: PlanWorld = { width: 100, height: 75 }

/** Les tables ne sortent jamais du plan : marge en pourcentage. */
const MARGIN_X = 6
const MARGIN_Y = 9

/** Plus de place en bas : les boutons de zoom y sont posés. */
const MARGIN_BOTTOM = 16

const PAYING: readonly SessionStatus[] = ['PAYMENT_PENDING', 'PARTIALLY_PAID']

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

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
    const spot = free ?? { x: MARGIN_X + Math.random() * (100 - MARGIN_X * 2), y: MARGIN_Y + Math.random() * (100 - MARGIN_Y - MARGIN_BOTTOM) }

    next[id] = { x: Math.round(spot.x * 10) / 10, y: Math.round(spot.y * 10) / 10 }
    taken.push(spot)
  }

  return next
}

/**
 * Disposition du plan : positions mémorisées dans le navigateur (`marinade.floor.layout`),
 * dimensions des tables selon leur capacité, déplacement à la souris ou au doigt.
 */
export function useFloorPlan(views: Ref<TableView[]>, compact: Ref<boolean>) {
  const layout = useStorage<Record<string, PlanPoint>>(LAYOUT_KEY, {}, undefined, {
    mergeDefaults: false,
    onError: () => {},
  })

  const world = computed<PlanWorld>(() => compact.value ? COMPACT_WORLD : WIDE_WORLD)

  // Ordre de placement : par zone puis par numéro, pour que chaque zone reste groupée.
  const ordered = computed(() => [...views.value]
    .sort((a, b) => locationOf(a.table).localeCompare(locationOf(b.table), 'fr')
      || a.table.numero.localeCompare(b.table.numero, 'fr', { numeric: true, sensitivity: 'base' }))
    .map(view => view.table.id))

  watch(ordered, ids => {
    if (!ids.length)
      return

    const completed = completeLayout(layout.value, ids, world.value.width / world.value.height)

    if (completed)
      layout.value = completed
  }, { immediate: true })

  /** Table en cours de déplacement : sa position vit ici jusqu'au relâchement. */
  const dragging = ref<{ id: string } & PlanPoint | null>(null)

  const pointOf = (id: string): PlanPoint => {
    if (dragging.value?.id === id)
      return dragging.value

    return layout.value[id] ?? { x: 50, y: 50 }
  }

  /** Réduit les tables quand la salle est dense, pour qu'elles ne se chevauchent pas. */
  const scale = computed(() => {
    const { cols, rows } = gridSlots(views.value.length || 1, world.value.width / world.value.height)
    const width = world.value.width * (100 - MARGIN_X * 2) / 100 / cols
    const height = world.value.height * (100 - MARGIN_Y - MARGIN_BOTTOM) / 100 / rows

    return clamp(Math.min(width, height) / 20, 0.5, 1)
  })

  const nodes = computed<PlanNode[]>(() => views.value.map(view => {
    const shape = shapeOf(view.table.capacite)
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

  function endDrag() {
    const current = dragging.value

    if (current) {
      layout.value = {
        ...layout.value,
        [current.id]: { x: Math.round(current.x * 10) / 10, y: Math.round(current.y * 10) / 10 },
      }
    }

    dragging.value = null
  }

  /** Repart de la grille automatique. */
  function resetLayout() {
    layout.value = {}
    layout.value = completeLayout({}, ordered.value, world.value.width / world.value.height) ?? {}
  }

  return { nodes, world, scale, dragging, startDrag, dragTo, endDrag, resetLayout }
}
