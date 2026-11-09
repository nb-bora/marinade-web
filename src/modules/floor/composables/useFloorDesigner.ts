import { floorApi } from '../api'
import type { LevelDef, PlacementShape, SalleConfig, ZoneDef } from '../layout'
import { addLevel, buildAttributes, formeOf, levelIdOf, moveLevel, nextTableNumbers, placementOf, removeLevel, removeZone, renameLevel, upsertZone, withPlacement, withSalle, zoneOf } from '../layout'
import type { Table, TableView } from '../types'
import type { FloorSnapshot } from './useFloorData'
import { autoLayoutOf, completeLayout, freeSpot, positionsOf } from './useFloorPlan'
import { useConfirm } from '@/composables/useConfirm'
import { isApiError } from '@/lib/http/errors'
import { useTenantStore } from '@/stores/tenant.store'
import { useToast } from '@/stores/toast.store'

export interface NewTables {
  prefix: string
  count: number
  capacity: number
  zone: string
  shape?: PlacementShape
}

/** Les appels au serveur se font par petits groupes : 40 tables ne doivent pas ouvrir 40 connexions d'un coup. */
async function inChunks<T>(items: readonly T[], size: number, task: (item: T) => Promise<unknown>) {
  for (let i = 0; i < items.length; i += size)
    await Promise.all(items.slice(i, i + size).map(task))
}

/**
 * Actions d'aménagement de la salle : niveaux, zones, tables (ajout en série, déplacement,
 * forme, rotation, suppression). Chaque action prévient par un toast et recharge le plan.
 * Les confirmations des suppressions et des remises en ordre sont posées ici ; les ajouts et
 * modifications passent par leurs formulaires (qui confirment eux-mêmes).
 */
export function useFloorDesigner(snapshot: () => FloorSnapshot | null, onChanged: () => unknown) {
  const tenant = useTenantStore()
  const toast = useToast()
  const confirm = useConfirm()

  const busy = ref(false)

  async function run(task: () => Promise<unknown>, success?: string): Promise<boolean> {
    busy.value = true

    try {
      await task()

      if (success)
        toast.success(success)

      await onChanged()

      return true
    }
    catch (cause) {
      toast.error(cause instanceof Error && !isApiError(cause) ? cause.message : cause)

      return false
    }
    finally {
      busy.value = false
    }
  }

  const salle = () => snapshot()?.salle
  const views = () => snapshot()?.views ?? []
  const tablesOnLevel = (levelId: string) => views().filter(view => levelIdOf(view.table, salle()!) === levelId)

  // Niveaux et zones (enregistrés dans la config du restaurant) ---------------------------

  async function saveSalle(next: SalleConfig, success: string) {
    const restaurantId = tenant.currentId
    const current = snapshot()

    if (!restaurantId || !current)
      return false

    return run(async () => {
      try {
        await floorApi.updateRestaurant(restaurantId, { config_jsonb: withSalle(current.config, next) })
      }
      catch (cause) {
        if (isApiError(cause) && cause.kind === 'forbidden')
          throw new Error('Seul le propriétaire du restaurant peut modifier les niveaux et les zones.')

        throw cause
      }
    }, success)
  }

  const createLevel = (nom: string) => saveSalle(addLevel(salle()!, nom), `Niveau « ${nom.trim()} » ajouté.`)

  const renameLevelTo = (id: string, nom: string) => saveSalle(renameLevel(salle()!, id, nom), 'Niveau renommé.')

  const shiftLevel = (id: string, direction: -1 | 1) => saveSalle(moveLevel(salle()!, id, direction), 'Ordre des niveaux mis à jour.')

  async function deleteLevel(level: LevelDef) {
    let next: SalleConfig

    try {
      next = removeLevel(salle()!, level.id, tablesOnLevel(level.id).length)
    }
    catch (cause) {
      toast.error(cause)

      return false
    }

    if (!(await confirm({ title: `Supprimer le niveau « ${level.nom} » ?`, text: 'Le niveau et ses zones sont retirés de l\'aménagement. Aucune table n\'est touchée.', confirmLabel: 'Supprimer', danger: true })))
      return false

    return saveSalle(next, `Niveau « ${level.nom} » supprimé.`)
  }

  /** Crée ou modifie une zone ; renommer une zone renomme aussi l'emplacement de ses tables, en changer de niveau les y déplace. */
  async function saveZone(zone: ZoneDef, previous?: ZoneDef) {
    const current = snapshot()

    if (!current)
      return false

    const next = upsertZone(current.salle, zone, previous?.nom)

    const touched = previous
      ? current.views.filter(view => zoneOf(view.table).toLowerCase() === previous.nom.toLowerCase())
      : []

    const renamed = !!previous && previous.nom !== zone.nom.trim()
    const moved = !!previous && previous.niveau !== zone.niveau

    const ok = await saveSalle(next, previous ? `Zone « ${zone.nom.trim()} » mise à jour.` : `Zone « ${zone.nom.trim()} » ajoutée.`)

    if (ok && (renamed || moved) && touched.length) {
      await run(() => inChunks(touched, 4, view => {
        const placed = placementOf(view.table)

        const body = {
          ...(renamed ? { emplacement: zone.nom.trim() } : {}),
          ...(moved ? withPlacement(view.table, { niveau: zone.niveau, x: placed?.x ?? 50, y: placed?.y ?? 50, forme: formeOf(view.table), rot: placed?.rot }) : {}),
        }

        return floorApi.updateTable(view.table.id, body)
      }))
    }

    return ok
  }

  async function deleteZone(zone: ZoneDef) {
    const count = views().filter(view => zoneOf(view.table).toLowerCase() === zone.nom.toLowerCase()).length
    let next: SalleConfig

    try {
      next = removeZone(salle()!, zone.nom, count)
    }
    catch (cause) {
      toast.error(cause)

      return false
    }

    if (!(await confirm({ title: `Supprimer la zone « ${zone.nom} » ?`, text: 'La zone est retirée de l\'aménagement.', confirmLabel: 'Supprimer', danger: true })))
      return false

    return saveSalle(next, `Zone « ${zone.nom} » supprimée.`)
  }

  // Tables ----------------------------------------------------------------------------------

  /**
   * Fige la disposition d'un niveau : les tables qui n'ont pas encore d'emplacement enregistré reçoivent
   * celui que le plan leur montre. Sans cela, enregistrer UNE seule table ferait réorganiser toutes les
   * autres (la disposition automatique se recalcule autour de ce qui est enregistré). Ne fait rien si
   * tout est déjà placé.
   */
  async function stabilize(levelId: string, exceptId?: string) {
    const level = tablesOnLevel(levelId)
    const loose = level.filter(view => !placementOf(view.table) && view.table.id !== exceptId)

    if (!loose.length)
      return

    const points = positionsOf(level)

    await inChunks(loose, 4, view => {
      const point = points[view.table.id] ?? { x: 50, y: 50 }

      return floorApi.updateTable(view.table.id, withPlacement(view.table, { niveau: levelId, x: point.x, y: point.y, forme: formeOf(view.table) }))
    })
  }

  /** Ajoute `count` tables numérotées à la suite, rangées dans les emplacements libres du niveau. */
  async function createTables(levelId: string, spec: NewTables) {
    const restaurantId = tenant.currentId
    const current = snapshot()

    if (!restaurantId || !current)
      return false

    const numbers = nextTableNumbers(current.views.map(view => view.table.numero), spec.prefix.trim(), spec.count)

    // Les tables du niveau gardent la place que le plan leur montre ; les nouvelles prennent les places libres.
    const onLevel = tablesOnLevel(levelId)
    const shown = positionsOf(onLevel)
    const fresh = numbers.map(numero => `new:${numero}`)
    const points = completeLayout(shown, [...onLevel.map(view => view.table.id), ...fresh]) ?? shown

    return run(async () => {
      await stabilize(levelId)
      await inChunks(numbers, 4, numero => {
        const point = points[`new:${numero}`] ?? { x: 50, y: 50 }

        return floorApi.createTable(restaurantId, {
          numero,
          capacite: spec.capacity,
          emplacement: spec.zone,
          statut: 'libre',
          attributs_jsonb: { plan: { niveau: levelId, x: point.x, y: point.y, ...(spec.shape ? { forme: spec.shape } : {}) } },
        })
      })
    }, numbers.length > 1 ? `${numbers.length} tables ajoutées (${numbers[0]} à ${numbers[numbers.length - 1]}).` : `Table ${numbers[0]} ajoutée.`)
  }

  /** Enregistre l'emplacement (déplacement, forme, rotation) d'une table, sans bouger les autres. */
  async function placeTable(table: Table, patch: { niveau?: string; x?: number; y?: number; forme?: PlacementShape | null; rot?: number }, quiet = true) {
    const placed = placementOf(table)
    const current = snapshot()
    const niveau = patch.niveau ?? placed?.niveau ?? (current ? levelIdOf(table, current.salle) : 'rdc')

    // Une table pas encore placée garde la place que le plan lui montre (au lieu de sauter au centre).
    const shown = placed ?? positionsOf(tablesOnLevel(niveau))[table.id] ?? { x: 50, y: 50 }
    const forme = patch.forme === null ? undefined : patch.forme ?? formeOf(table)
    const body = withPlacement(table, { niveau, x: patch.x ?? shown.x, y: patch.y ?? shown.y, forme, rot: patch.rot ?? placed?.rot })

    return run(async () => {
      await stabilize(niveau, table.id)
      await floorApi.updateTable(table.id, body)
    }, quiet ? undefined : 'Table mise à jour.')
  }

  /**
   * Envoie une table à un autre niveau, sur le premier emplacement libre, et rend la table à jour.
   * Lève en cas d'échec : à utiliser depuis un formulaire qui affiche lui-même l'erreur.
   */
  async function relocateTable(table: Table, levelId: string): Promise<Table> {
    await stabilize(levelId)

    const spot = freeSpot(tablesOnLevel(levelId).filter(view => view.table.id !== table.id))

    return floorApi.updateTable(table.id, withPlacement(table, { niveau: levelId, x: spot.x, y: spot.y, forme: formeOf(table), rot: placementOf(table)?.rot }))
  }

  /** Crée UNE table (numéro choisi) à la première place libre du niveau. Lève en cas d'échec (voir `relocateTable`). */
  async function addTable(levelId: string, spec: { numero: string; capacity: number; zone: string | null; statut: string; shape?: PlacementShape }): Promise<Table> {
    const restaurantId = tenant.currentId

    if (!restaurantId)
      throw new Error('Aucun restaurant sélectionné.')

    await stabilize(levelId)

    const spot = freeSpot(tablesOnLevel(levelId))

    return floorApi.createTable(restaurantId, {
      numero: spec.numero.trim(),
      capacite: spec.capacity,
      emplacement: spec.zone?.trim() || null,
      statut: spec.statut,
      attributs_jsonb: buildAttributes(null, { niveau: levelId, spot, forme: spec.shape }),
    })
  }

  /** Envoie une table à un autre niveau (avec confirmation par toast et rechargement du plan). */
  async function moveToLevel(table: Table, levelId: string) {
    const target = snapshot()?.salle.niveaux.find(level => level.id === levelId)

    if (!target)
      return false

    return run(() => relocateTable(table, levelId), `Table ${table.numero} déplacée au niveau « ${target.nom} ».`)
  }

  async function deleteTable(view: TableView) {
    if (!(await confirm({ title: `Supprimer la table ${view.table.numero} ?`, text: 'Elle disparaît du plan. Son historique (sessions, commandes) est conservé.', confirmLabel: 'Supprimer', danger: true })))
      return false

    return run(async () => {
      try {
        await floorApi.deleteTable(view.table.id)
      }
      catch (cause) {
        if (isApiError(cause) && cause.kind === 'conflict')
          throw new Error('Cette table est occupée : libérez-la avant de la supprimer.')

        throw cause
      }
    }, `Table ${view.table.numero} supprimée.`)
  }

  /** Remet toutes les tables du niveau en ordre (disposition automatique par zones). */
  async function autoLayout(levelId: string) {
    const level = tablesOnLevel(levelId)

    if (!level.length)
      return false

    if (!(await confirm({ title: 'Ranger les tables automatiquement ?', text: 'Les tables de ce niveau retrouvent la disposition automatique, zone par zone. Votre disposition actuelle sera remplacée.', confirmLabel: 'Ranger' })))
      return false

    const layout = autoLayoutOf(level)

    return run(() => inChunks(level, 4, view => {
      const point = layout[view.table.id]

      return floorApi.updateTable(view.table.id, withPlacement(view.table, { niveau: levelId, x: point.x, y: point.y, forme: formeOf(view.table), rot: placementOf(view.table)?.rot }))
    }), 'Tables rangées.')
  }

  return { busy, createLevel, renameLevelTo, shiftLevel, deleteLevel, saveZone, deleteZone, createTables, addTable, placeTable, moveToLevel, relocateTable, deleteTable, autoLayout, tablesOnLevel }
}
