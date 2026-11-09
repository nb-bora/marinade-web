import { planStateOf, positionsOf } from '../composables/useFloorPlan'
import type { SalleConfig } from '../layout'
import { formeOf, levelIdOf, placementOf, zoneOf, zoneTypeOf } from '../layout'
import type { TableView } from '../types'
import type { Scene3DLevel, Scene3DTable, Scene3DZone } from './sceneTypes'

/** Marge autour des tables d'une zone, en % du plan : le sol de la zone dépasse un peu des chaises. */
const ZONE_PAD = 6
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const shapeOf = (capacity: number) => capacity <= 2 ? 'round' as const : capacity <= 4 ? 'square' as const : 'rect' as const

/**
 * Données de la vue 3D : un niveau par étage, avec les mêmes positions que le plan 2D (emplacement
 * enregistré, sinon disposition automatique par zones), l'état et les couverts de chaque table, et
 * une zone par groupe de tables (rectangle qui les enveloppe).
 */
export function buildScene3D(views: readonly TableView[], salle: SalleConfig): Scene3DLevel[] {
  return salle.niveaux.map(level => {
    const onLevel = views.filter(view => levelIdOf(view.table, salle) === level.id)
    const points = positionsOf(onLevel)

    const tables: Scene3DTable[] = onLevel.map(view => {
      const placed = placementOf(view.table)
      const point = points[view.table.id] ?? { x: 50, y: 50 }

      return {
        id: view.table.id,
        numero: view.table.numero,
        state: planStateOf(view),
        shape: formeOf(view.table) ?? shapeOf(view.table.capacite),
        x: point.x,
        y: point.y,
        capacity: view.table.capacite,
        taken: view.session ? Math.min(view.table.capacite, view.covers ?? 0) : 0,
        rot: placed?.rot,
      }
    })

    const groups = new Map<string, Scene3DTable[]>()

    for (const view of onLevel)
      groups.set(zoneOf(view.table), [...(groups.get(zoneOf(view.table)) ?? []), tables.find(table => table.id === view.table.id)!])

    const zones: Scene3DZone[] = [...groups].map(([name, list]) => {
      const x1 = clamp(Math.min(...list.map(table => table.x)) - ZONE_PAD, 0, 100)
      const y1 = clamp(Math.min(...list.map(table => table.y)) - ZONE_PAD, 0, 100)
      const x2 = clamp(Math.max(...list.map(table => table.x)) + ZONE_PAD, 0, 100)
      const y2 = clamp(Math.max(...list.map(table => table.y)) + ZONE_PAD, 0, 100)

      return { name, type: zoneTypeOf(name, salle), x: x1, y: y1, w: Math.max(8, x2 - x1), h: Math.max(8, y2 - y1) }
    })

    return { id: level.id, name: level.nom, tables, zones }
  })
}
