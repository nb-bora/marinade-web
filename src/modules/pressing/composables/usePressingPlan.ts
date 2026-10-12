import { useStorage } from '@vueuse/core'
import type { Ref } from 'vue'
import type { Machine, MachineCategory, MachineState, Plan, PlanMachine, Zone } from '../types'
import { COMPACT_WORLD, WIDE_WORLD, autoSlots, clampMachine, clampZone, machineDiameter, snapPercent, zoneAt } from './planGeometry'
import type { PlanPoint, PlanRect, PlanWorld } from './planGeometry'
import type { DragKind } from './usePlanViewport'

/** Une zone prête à être dessinée : rectangle en pourcentages et en unités du plan. */
export interface ZoneNode {
  id: string
  zone: Zone

  /** Rectangle en pourcentages (enregistré ou en cours de modification). */
  rect: PlanRect

  /** Rectangle en unités du plan. */
  x: number
  y: number
  w: number
  h: number
  moved: boolean
}

/** Une machine prête à être dessinée : centre et diamètre en unités du plan. */
export interface MachineNode {
  id: string
  machine: PlanMachine
  category: MachineCategory
  state: MachineState
  round: boolean
  cx: number
  cy: number
  d: number

  /** Position en pourcentages (enregistrée, modifiée ou provisoire). */
  point: PlanPoint

  /** Faux tant qu'aucune position n'est enregistrée : l'emplacement est un repli automatique. */
  placed: boolean
  moved: boolean
  zoneName: string | null
}

export const SNAP_KEY = 'marinade.pressing.snap'

/**
 * Disposition du plan du pressing. Les positions viennent du serveur (pourcentages) ; pendant
 * « Aménager », chaque déplacement s'écrit dans un brouillon, jamais sur le serveur : « Annuler »
 * rejette le brouillon et rend la mise en page d'avant, « Enregistrer » est fait par la page.
 */
export function usePressingPlan(plan: Ref<Plan | null>, compact: Ref<boolean>) {
  const world = computed<PlanWorld>(() => compact.value ? COMPACT_WORLD : WIDE_WORLD)

  const editing = ref(false)
  const snap = useStorage(SNAP_KEY, true, undefined, { onError: () => {} })
  const zoneDraft = ref<Record<string, PlanRect>>({})
  const machineDraft = ref<Record<string, PlanPoint>>({})
  const dragging = ref<{ kind: DragKind; id: string } | null>(null)

  const zones = computed(() => plan.value?.zones ?? [])
  const machines = computed(() => plan.value?.machines ?? [])

  const toUnits = (point: PlanPoint): PlanPoint => ({ x: point.x / 100 * world.value.width, y: point.y / 100 * world.value.height })
  const toPercent = (point: PlanPoint): PlanPoint => ({ x: point.x / world.value.width * 100, y: point.y / world.value.height * 100 })

  /** Ordre de lecture (donc de tabulation) : de haut en bas par bandes de 10 %, puis de gauche à droite. */
  const readingOrder = <T extends { x: number; y: number }>(a: T, b: T) =>
    Math.floor(a.y / 10) - Math.floor(b.y / 10) || a.x - b.x

  const zoneNodes = computed<ZoneNode[]>(() => zones.value.map(zone => {
    const draft = zoneDraft.value[zone.id]
    const rect = draft ?? { x: zone.x, y: zone.y, w: zone.w, h: zone.h }

    return {
      id: zone.id,
      zone,
      rect,
      x: rect.x / 100 * world.value.width,
      y: rect.y / 100 * world.value.height,
      w: rect.w / 100 * world.value.width,
      h: rect.h / 100 * world.value.height,
      moved: !!draft,
    }
  }).sort((a, b) => readingOrder(a.rect, b.rect)))

  const diameterOf = (machine: PlanMachine) => machineDiameter(Number(machine.capacite_kg), compact.value)

  const savedPoint = (machine: PlanMachine): PlanPoint | null =>
    machine.position_x != null && machine.position_y != null ? { x: machine.position_x, y: machine.position_y } : null

  /**
   * Emplacements de repli des machines non placées : la grille automatique, à raison d'une case par
   * machine du parc (classé par nom). Une machine garde donc la même case tant que le parc ne change
   * pas, même quand ses voisines sont posées ailleurs.
   */
  const fallback = computed<Record<string, PlanPoint>>(() => {
    const ordered = [...machines.value].sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { numeric: true, sensitivity: 'base' }))
    const slots = autoSlots(ordered.length, world.value.width / world.value.height)

    return Object.fromEntries(ordered.map((machine, index) => [machine.id, slots[index]]))
  })

  const zoneNames = computed(() => new Map(zones.value.map(zone => [zone.id, zone.nom])))

  /** Rang de la zone dans l'ordre de lecture : les machines sont groupées par zone, les autres en dernier. */
  const zoneRank = (id: string | null | undefined) => {
    const index = zoneNodes.value.findIndex(node => node.id === id)

    return index === -1 ? zoneNodes.value.length : index
  }

  const machineNodes = computed<MachineNode[]>(() => machines.value.map(machine => {
    const saved = savedPoint(machine)
    const draft = machineDraft.value[machine.id]
    const point = draft ?? saved ?? fallback.value[machine.id] ?? { x: 50, y: 50 }
    const units = toUnits(point)

    return {
      id: machine.id,
      machine,
      category: machine.categorie,
      state: machine.etat_operationnel,
      round: machine.categorie === 'lave_linge',
      cx: units.x,
      cy: units.y,
      d: diameterOf(machine),
      point,
      placed: !!saved || !!draft,
      moved: !!draft,
      zoneName: machine.zone_id ? zoneNames.value.get(machine.zone_id) ?? null : null,
    }
  }).sort((a, b) => zoneRank(a.machine.zone_id) - zoneRank(b.machine.zone_id) || a.machine.nom.localeCompare(b.machine.nom, 'fr', { numeric: true, sensitivity: 'base' })))

  const zoneChanges = computed(() => Object.entries(zoneDraft.value).map(([id, rect]) => ({ id, rect })))
  const machineChanges = computed(() => Object.entries(machineDraft.value).map(([id, point]) => ({ id, point })))
  const dirtyCount = computed(() => zoneChanges.value.length + machineChanges.value.length)
  const unplacedCount = computed(() => machineNodes.value.filter(node => !node.placed).length)

  // --- Glisser-déposer ----------------------------------------------------------------------

  function originOf(kind: DragKind, id: string): PlanPoint | null {
    if (kind === 'machine') {
      const node = machineNodes.value.find(item => item.id === id)

      return node ? { x: node.cx, y: node.cy } : null
    }

    const node = zoneNodes.value.find(item => item.id === id)

    if (!node)
      return null

    return kind === 'zone' ? { x: node.x, y: node.y } : { x: node.x + node.w, y: node.y + node.h }
  }

  function setMachine(id: string, percent: PlanPoint) {
    const node = machineNodes.value.find(item => item.id === id)

    if (!node)
      return

    const snapped = { x: snapPercent(percent.x, world.value.width, snap.value), y: snapPercent(percent.y, world.value.height, snap.value) }

    machineDraft.value = { ...machineDraft.value, [id]: clampMachine(snapped, node.d, world.value) }
  }

  function setZone(kind: 'zone' | 'resize', id: string, percent: PlanPoint) {
    const rect = zoneNodes.value.find(node => node.id === id)?.rect

    if (!rect)
      return

    const x = snapPercent(percent.x, world.value.width, snap.value)
    const y = snapPercent(percent.y, world.value.height, snap.value)

    zoneDraft.value = {
      ...zoneDraft.value,
      [id]: kind === 'zone'
        ? clampZone({ ...rect, x, y })
        : clampZone({ ...rect, w: Math.min(x - rect.x, 100 - rect.x), h: Math.min(y - rect.y, 100 - rect.y) }),
    }
  }

  function startDrag(kind: DragKind, id: string) {
    dragging.value = { kind, id }
  }

  /** Le point reçu est en unités du plan. */
  function dragTo(point: PlanPoint) {
    const current = dragging.value

    if (!current)
      return

    if (current.kind === 'machine')
      setMachine(current.id, toPercent(point))
    else
      setZone(current.kind, current.id, toPercent(point))
  }

  function endDrag() {
    dragging.value = null
  }

  /** Déplace d'un pas de grille (clavier). */
  function nudge(kind: DragKind, id: string, dx: number, dy: number) {
    const origin = originOf(kind, id)

    if (!origin)
      return

    const step = 4
    const target = toPercent({ x: origin.x + dx * step, y: origin.y + dy * step })

    if (kind === 'machine')
      setMachine(id, target)
    else
      setZone(kind, id, target)
  }

  /** Adopte l'emplacement automatique de toutes les machines non placées. */
  function placeAll() {
    const draft = { ...machineDraft.value }

    for (const node of machineNodes.value) {
      if (!node.placed)
        draft[node.id] = fallback.value[node.id]
    }

    machineDraft.value = draft
  }

  // --- Cycle d'aménagement ------------------------------------------------------------------

  function begin() {
    zoneDraft.value = {}
    machineDraft.value = {}
    editing.value = true
  }

  /** Rejette le brouillon : la mise en page d'avant l'aménagement revient. */
  function discard() {
    zoneDraft.value = {}
    machineDraft.value = {}
    dragging.value = null
    editing.value = false
  }

  /** Zone d'un point du plan (pourcentages), pour rattacher une machine posée dans une zone. */
  function zoneContaining(point: PlanPoint) {
    return zoneAt(point, zoneNodes.value.map(node => ({ id: node.id, ...node.rect })))
  }

  return {
    world,
    editing,
    snap,
    dragging,
    zoneNodes,
    machineNodes,
    zoneChanges,
    machineChanges,
    dirtyCount,
    unplacedCount,
    originOf,
    startDrag,
    dragTo,
    endDrag,
    nudge,
    placeAll,
    begin,
    discard,
    zoneContaining,
  }
}

/** Corps de `PUT /machines/{id}` : tous les champs de saisie de la machine, avec la nouvelle position. */
export function machineBody(machine: Machine, patch: { position_x?: number | null; position_y?: number | null; zone_id?: string | null }) {
  return {
    nom: machine.nom,
    categorie: machine.categorie,
    marque: machine.marque ?? null,
    modele: machine.modele ?? null,
    numero_serie: machine.numero_serie ?? null,
    type_fonctionnement: machine.type_fonctionnement,
    capacite_kg: machine.capacite_kg,
    programmes: machine.programmes,
    zone_id: patch.zone_id !== undefined ? patch.zone_id : machine.zone_id ?? null,
    position_x: patch.position_x !== undefined ? patch.position_x : machine.position_x ?? null,
    position_y: patch.position_y !== undefined ? patch.position_y : machine.position_y ?? null,
    conso_electrique_kwh_cycle: machine.conso_electrique_kwh_cycle ?? null,
    conso_eau_litres_cycle: machine.conso_eau_litres_cycle ?? null,
    date_mise_en_service: machine.date_mise_en_service ?? null,
    remarques: machine.remarques ?? null,
    contraintes: machine.contraintes ?? null,
  }
}
