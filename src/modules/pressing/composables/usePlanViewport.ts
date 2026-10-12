import type { Ref } from 'vue'
import type { PlanPoint, PlanWorld } from './planGeometry'

export const MIN_ZOOM = 1
export const MAX_ZOOM = 4

/** Distance (en pixels) au-delà de laquelle un appui devient un glissement et non un clic. */
const DRAG_THRESHOLD = 6

/** Ce que l'on saisit dans le plan : une machine (par son centre), une zone (par son coin haut gauche) ou sa poignée (coin bas droit). */
export type DragKind = 'machine' | 'zone' | 'resize'

interface Hooks {

  /** Les éléments se déplacent-ils ? (mode « Aménager ») */
  canDrag: () => boolean

  /** Point de référence actuel de l'élément saisi, en unités du plan. */
  originOf: (kind: DragKind, id: string) => PlanPoint | null
  startDrag: (kind: DragKind, id: string, point: PlanPoint) => void
  dragTo: (point: PlanPoint) => void
  endDrag: () => void
}

interface Gesture {
  mode: 'pan' | 'item'
  kind: DragKind | null
  itemId: string | null
  pointerId: number
  startX: number
  startY: number
  lastX: number
  lastY: number
  offset: PlanPoint
  moved: boolean
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/**
 * Zoom et déplacement du plan (molette + Ctrl, boutons, pincement, glissement), et
 * déplacement des machines et des zones. Le repère est celui du SVG : `translate(tx ty) scale(k)`.
 * Même principe que le plan de salle, dont la logique est reprise ici (le module `floor` reste intact).
 */
export function usePlanViewport(svg: Ref<SVGSVGElement | null>, world: Ref<PlanWorld>, hooks: Hooks) {
  const zoom = ref(1)
  const tx = ref(0)
  const ty = ref(0)
  const smooth = ref(false)
  const gesturing = ref(false)

  const transform = computed(() => `translate(${tx.value} ${ty.value}) scale(${zoom.value})`)
  const zoomed = computed(() => zoom.value > MIN_ZOOM + 0.001)

  const pointers = new Map<number, { x: number; y: number }>()

  let gesture: Gesture | null = null
  let pinch: { distance: number; zoom: number } | null = null
  let swallowClick = false

  function pixelsPerUnit(): number {
    const rect = svg.value?.getBoundingClientRect()

    return rect && rect.width > 0 ? rect.width / world.value.width : 1
  }

  /** Pixels écran → unités du SVG (avant zoom). */
  function toSvg(clientX: number, clientY: number): PlanPoint {
    const rect = svg.value?.getBoundingClientRect()
    const scale = pixelsPerUnit()

    return rect ? { x: (clientX - rect.left) / scale, y: (clientY - rect.top) / scale } : { x: 0, y: 0 }
  }

  /** Pixels écran → unités du plan (après zoom et déplacement). */
  function toWorld(clientX: number, clientY: number): PlanPoint {
    const point = toSvg(clientX, clientY)

    return { x: (point.x - tx.value) / zoom.value, y: (point.y - ty.value) / zoom.value }
  }

  /** Empêche de sortir du plan : à zoom 1 il n'y a rien à déplacer. */
  function keepInside() {
    tx.value = clamp(tx.value, world.value.width * (1 - zoom.value), 0)
    ty.value = clamp(ty.value, world.value.height * (1 - zoom.value), 0)
  }

  /** Zoome en gardant fixe le point `at` (unités du SVG). */
  function zoomAt(factor: number, at: PlanPoint) {
    const next = clamp(zoom.value * factor, MIN_ZOOM, MAX_ZOOM)
    const ratio = next / zoom.value

    tx.value = at.x - (at.x - tx.value) * ratio
    ty.value = at.y - (at.y - ty.value) * ratio
    zoom.value = next
    keepInside()
  }

  /** Unités du plan → unités du SVG, zoom et déplacement compris (pour placer une infobulle). */
  const project = (point: PlanPoint): PlanPoint => ({ x: point.x * zoom.value + tx.value, y: point.y * zoom.value + ty.value })

  const center = (): PlanPoint => ({ x: world.value.width / 2, y: world.value.height / 2 })

  function zoomIn() {
    smooth.value = true
    zoomAt(1.4, center())
  }

  function zoomOut() {
    smooth.value = true
    zoomAt(1 / 1.4, center())
  }

  function reset() {
    smooth.value = true
    zoom.value = 1
    tx.value = 0
    ty.value = 0
  }

  function onWheel(event: WheelEvent) {
    if (!event.ctrlKey && !event.metaKey)
      return

    event.preventDefault()
    smooth.value = false
    zoomAt(Math.exp(-event.deltaY * 0.012), toSvg(event.clientX, event.clientY))
  }

  function pinchDistance(): number {
    const [a, b] = [...pointers.values()]

    return Math.hypot(a.x - b.x, a.y - b.y)
  }

  function pinchCenter(): PlanPoint {
    const [a, b] = [...pointers.values()]

    return toSvg((a.x + b.x) / 2, (a.y + b.y) / 2)
  }

  function onPointerDown(event: PointerEvent) {
    if (event.pointerType === 'mouse' && event.button !== 0)
      return

    smooth.value = false
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })

    if (pointers.size === 2) {
      // Deuxième doigt : on abandonne tout déplacement d'élément et on passe au pincement.
      if (gesture?.mode === 'item' && gesture.moved)
        hooks.endDrag()

      gesture = null
      pinch = { distance: pinchDistance() || 1, zoom: zoom.value }
      gesturing.value = true

      return
    }

    if (pointers.size > 2)
      return

    const element = event.target instanceof Element ? event.target.closest<HTMLElement | SVGElement>('[data-drag-id]') : null
    const itemId = element?.getAttribute('data-drag-id') ?? null
    const kind = (element?.getAttribute('data-drag-kind') ?? null) as DragKind | null
    const dragItem = itemId !== null && kind !== null && hooks.canDrag()
    const origin = dragItem ? hooks.originOf(kind, itemId) : null
    const here = toWorld(event.clientX, event.clientY)

    gesture = {
      mode: dragItem && origin ? 'item' : 'pan',
      kind,
      itemId,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      offset: origin ? { x: origin.x - here.x, y: origin.y - here.y } : { x: 0, y: 0 },
      moved: false,
    }
  }

  function onPointerMove(event: PointerEvent) {
    if (pointers.has(event.pointerId))
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })

    if (pinch && pointers.size >= 2) {
      const at = pinchCenter()
      const wanted = clamp(pinch.zoom * (pinchDistance() / pinch.distance), MIN_ZOOM, MAX_ZOOM)

      zoomAt(wanted / zoom.value, at)
      swallowClick = true

      return
    }

    if (!gesture || gesture.pointerId !== event.pointerId)
      return

    if (!gesture.moved) {
      if (Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) < DRAG_THRESHOLD)
        return

      gesture.moved = true
      gesturing.value = true

      // La capture n'est prise qu'à ce moment : un simple appui garde son clic sur l'élément.
      svg.value?.setPointerCapture(event.pointerId)

      if (gesture.mode === 'item' && gesture.itemId && gesture.kind) {
        const origin = hooks.originOf(gesture.kind, gesture.itemId)

        if (origin)
          hooks.startDrag(gesture.kind, gesture.itemId, origin)
      }
    }

    if (gesture.mode === 'item') {
      const here = toWorld(event.clientX, event.clientY)

      hooks.dragTo({ x: here.x + gesture.offset.x, y: here.y + gesture.offset.y })
    }
    else if (zoomed.value) {
      const scale = pixelsPerUnit()

      tx.value += (event.clientX - gesture.lastX) / scale
      ty.value += (event.clientY - gesture.lastY) / scale
      keepInside()
    }

    gesture.lastX = event.clientX
    gesture.lastY = event.clientY
  }

  function finish(event: PointerEvent) {
    pointers.delete(event.pointerId)

    if (pinch) {
      if (pointers.size < 2) {
        pinch = null
        gesturing.value = false
      }

      return
    }

    if (!gesture || gesture.pointerId !== event.pointerId)
      return

    if (gesture.moved) {
      if (gesture.mode === 'item')
        hooks.endDrag()

      swallowClick = true
    }

    if (svg.value?.hasPointerCapture(event.pointerId))
      svg.value.releasePointerCapture(event.pointerId)

    gesture = null
    gesturing.value = false

    if (swallowClick)
      setTimeout(() => { swallowClick = false }, 0)
  }

  /** À appeler au début d'un clic sur un élément : `false` si ce « clic » était la fin d'un glissement. */
  function acceptClick(): boolean {
    const accepted = !swallowClick

    swallowClick = false

    return accepted
  }

  return {
    zoom,
    transform,
    zoomed,
    smooth,
    gesturing,
    zoomIn,
    zoomOut,
    reset,
    toSvg,
    project,
    acceptClick,
    handlers: { onWheel, onPointerDown, onPointerMove, onPointerUp: finish, onPointerCancel: finish },
  }
}
