import type { PlanState } from '../labels'

export type SceneShape = 'round' | 'square' | 'rect'
export type SceneZoneType = 'salle' | 'terrasse' | 'bar' | 'vip' | 'autre'

/** Une table à placer dans la vue 3D. `x` et `y` sont en % (0..100) du plan du niveau. */
export interface Scene3DTable {
  id: string
  numero: string
  state: PlanState
  shape: SceneShape
  x: number
  y: number
  capacity: number

  /** Couverts assis (0 si la table est libre) : les chaises « prises » portent la couleur de l'état. */
  taken: number

  /** Rotation autour de l'axe vertical, en degrés. */
  rot?: number
}

/** Une zone : rectangle en % du plan du niveau. */
export interface Scene3DZone {
  name: string
  type: SceneZoneType
  x: number
  y: number
  w: number
  h: number
}

export interface Scene3DLevel {
  id: string
  name: string
  tables: Scene3DTable[]
  zones: Scene3DZone[]
}

export type ViewMode = 'level' | 'building'
