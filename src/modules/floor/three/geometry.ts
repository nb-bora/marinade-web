/**
 * Géométrie pure de la vue 3D (aucune dépendance à three) : conversions plan → mètres, dimensions
 * des tables, placement des chaises, étagement des niveaux, cadrage de la caméra et clés de
 * comparaison. Tout ce qui est testable sans WebGL est ici.
 */
import type { PlanState } from '../labels'
import type { Scene3DLevel, Scene3DTable, Scene3DZone, SceneShape, ViewMode } from './sceneTypes'

/** Un niveau est une dalle de 32 m × 18 m ; le plan en % s'y projette. */
export const LEVEL_W = 32
export const LEVEL_D = 18
export const SLAB_T = 0.3
export const LEVEL_GAP = 4.5
export const EXPLODE = 1.6
export const TABLE_H = 0.75
export const WALL_H = 1.0
export const CHAIR_SPACING = 0.5

export const STATE_COLORS: Record<PlanState, number> = {
  free: 0x28A05A,
  busy: 0xE08A0B,
  paying: 0xE5483E,
  reserved: 0x2F7DE1,
  settled: 0xF2B84B,
  maintenance: 0x8A8F98,
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/** % du plan → mètres, origine au centre de la dalle ; `x` à droite, `z` vers le spectateur. */
export function pctToMeters(x: number, y: number): { x: number; z: number } {
  return { x: (clamp(x, 0, 100) / 100 - 0.5) * LEVEL_W, z: (clamp(y, 0, 100) / 100 - 0.5) * LEVEL_D }
}

export interface ZoneRect { cx: number; cz: number; w: number; d: number }

export function zoneRect(zone: Pick<Scene3DZone, 'x' | 'y' | 'w' | 'h'>): ZoneRect {
  const x1 = clamp(zone.x, 0, 100)
  const y1 = clamp(zone.y, 0, 100)
  const x2 = clamp(zone.x + zone.w, x1, 100)
  const y2 = clamp(zone.y + zone.h, y1, 100)
  const a = pctToMeters(x1, y1)
  const b = pctToMeters(x2, y2)

  return { cx: (a.x + b.x) / 2, cz: (a.z + b.z) / 2, w: b.x - a.x, d: b.z - a.z }
}

/** Dimensions d'une table en mètres (largeur sur x, profondeur sur z). */
export function tableSize(shape: SceneShape, capacity: number): { w: number; d: number } {
  if (shape === 'round') {
    const diameter = clamp(0.9 + (capacity - 1) * 0.1, 0.9, 1.5)

    return { w: diameter, d: diameter }
  }

  if (shape === 'square')
    return { w: 1.1, d: 1.1 }

  return { w: clamp(1.8 + (capacity - 4) * 0.125, 1.8, 2.8), d: 0.9 }
}

export interface ChairPlacement {

  /** Position relative au centre de la table. */
  x: number
  z: number

  /** Rotation y pour que l'avant de la chaise (+z local) regarde la table. */
  ry: number
}

const CHAIR_OFFSET = 0.34

const facing = (x: number, z: number): ChairPlacement => ({ x, z, ry: Math.atan2(-x, -z) })

function interleave<T>(rows: T[][]): T[] {
  const out: T[] = []
  const longest = Math.max(0, ...rows.map(row => row.length))

  for (let i = 0; i < longest; i++) {
    for (const row of rows) {
      if (i < row.length)
        out.push(row[i])
    }
  }

  return out
}

/**
 * Chaises autour d'une table, dans l'ordre où elles « se remplissent » : les premières sont prises
 * en premier (on alterne les côtés pour que la table se garnisse de façon équilibrée).
 */
export function chairPlacements(shape: SceneShape, capacity: number): ChairPlacement[] {
  const count = clamp(Math.round(capacity), 1, 12)
  const { w, d } = tableSize(shape, capacity)

  if (shape === 'round') {
    const radius = w / 2 + CHAIR_OFFSET

    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2

      return facing(Math.sin(angle) * radius, -Math.cos(angle) * radius)
    })
  }

  if (shape === 'square') {
    const per = [0, 0, 0, 0]

    for (let i = 0; i < count; i++)
      per[i % 4]++

    const offset = w / 2 + CHAIR_OFFSET
    const span = w - 0.3
    const along = (n: number, j: number) => ((j + 0.5) / n - 0.5) * span
    const side = (n: number, make: (a: number) => ChairPlacement) => Array.from({ length: n }, (_, j) => make(along(n, j)))

    return interleave([
      side(per[0], a => facing(a, -offset)),
      side(per[1], a => facing(a, offset)),
      side(per[2], a => facing(-offset, a)),
      side(per[3], a => facing(offset, a)),
    ])
  }

  // Rectangle : les deux grands côtés d'abord, puis les deux extrémités.
  const maxSide = Math.max(1, Math.floor(w / CHAIR_SPACING))
  const top = Math.min(Math.ceil(count / 2), maxSide)
  const bottom = Math.min(count - top, maxSide)
  const ends = count - top - bottom
  const offsetZ = d / 2 + CHAIR_OFFSET
  const along = (n: number, j: number) => ((j + 0.5) / n - 0.5) * (w - 0.2)
  const topRow = Array.from({ length: top }, (_, j) => facing(along(top, j), -offsetZ))
  const bottomRow = Array.from({ length: bottom }, (_, j) => facing(along(bottom, j), offsetZ))
  const endRow = Array.from({ length: Math.min(ends, 2) }, (_, j) => facing(j === 0 ? -(w / 2 + CHAIR_OFFSET) : w / 2 + CHAIR_OFFSET, 0))

  return [...interleave([topRow, bottomRow]), ...endRow]
}

/** Hauteur (y) du dessus d'un niveau ; les niveaux au-dessus du niveau mis en avant s'écartent pour le dégager. */
export function levelElevation(index: number, focusIndex: number | null = null): number {
  return index * LEVEL_GAP + (focusIndex !== null && focusIndex >= 0 && index > focusIndex ? EXPLODE : 0)
}

/** Niveaux à dessiner : un seul en mode `level`, tous en mode `building`. */
export function visibleLevels(levels: readonly Scene3DLevel[], mode: ViewMode, levelId: string | null): Scene3DLevel[] {
  if (mode === 'building')
    return [...levels]

  const chosen = levels.find(level => level.id === levelId) ?? levels[0]

  return chosen ? [chosen] : []
}

/** Distance caméra → cible pour qu'un rectangle `halfW × halfD` tienne dans le cadre (marge de 12 %). */
export function fitDistance(halfW: number, halfD: number, fovDeg: number, aspect: number): number {
  const tan = Math.tan((fovDeg * Math.PI) / 360)

  return Math.max(halfD / tan, halfW / (tan * Math.max(aspect, 0.2))) * 1.12
}

export interface Framing {
  target: { x: number; y: number; z: number }
  distance: number
}

/** Écran plus haut que large (téléphone) : on regarde la salle par son petit côté, la grande dimension à la verticale. */
export const isPortrait = (aspect: number) => aspect < 0.85

/** Cible et distance pour cadrer la scène : un niveau, ou l'immeuble entier. */
export function framing(levelCount: number, mode: ViewMode, fovDeg: number, aspect: number, tilted: boolean): Framing {
  const count = mode === 'building' ? Math.max(levelCount, 1) : 1
  const height = (count - 1) * LEVEL_GAP + EXPLODE
  const portrait = isPortrait(aspect)

  // En perspective inclinée l'étage supérieur « monte » dans le cadre : on s'éloigne un peu.
  const halfD = (portrait ? LEVEL_W : LEVEL_D) / 2 + (tilted ? height * 0.6 : 0)
  const halfW = (portrait ? LEVEL_D : LEVEL_W) / 2

  return {
    target: { x: 0, y: mode === 'building' ? height / 2 : 0.4, z: 0 },
    distance: fitDistance(halfW, halfD, fovDeg, aspect) * (tilted ? 1.05 : 1),
  }
}

/** Structure : tout ce qui oblige à reconstruire la scène (pas les états, qui changent toutes les 5 s). */
export function structureKey(levels: readonly Scene3DLevel[], mode: ViewMode, levelId: string | null): string {
  return JSON.stringify([
    mode,
    mode === 'level' ? levelId : null,
    levels.map(level => [
      level.id,
      level.name,
      level.zones.map(z => [z.name, z.type, z.x, z.y, z.w, z.h]),
      level.tables.map((t: Scene3DTable) => [t.id, t.numero, t.shape, t.x, t.y, t.capacity, t.rot ?? 0]),
    ]),
  ])
}

/** États : changer cette clé suffit à recolorer sans rebâtir. */
export const stateKey = (levels: readonly Scene3DLevel[]): string =>
  levels.map(level => level.tables.map(t => `${t.id}:${t.state}:${t.taken}`).join('|')).join('||')

/** Deuxième ligne de l'étiquette d'une table : les places libres, si elle est occupée. */
export function seatsNote(table: Pick<Scene3DTable, 'capacity' | 'taken' | 'state'>): string {
  if (table.taken <= 0 || (table.state !== 'busy' && table.state !== 'paying'))
    return ''

  const free = Math.max(0, table.capacity - table.taken)

  return free === 0 ? 'complète' : `${free} libre${free > 1 ? 's' : ''}`
}
