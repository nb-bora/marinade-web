import { pressingApi } from '../api'
import { pressingError } from '../labels'
import type { Machine, MachineState } from '../types'
import { useConfirm } from '@/composables/useConfirm'
import { useTenantStore } from '@/stores/tenant.store'
import { useToast } from '@/stores/toast.store'

/** Machine à conduire : l'identifiant, le nom pour les messages et l'état courant. */
export interface CycleTarget {
  id: string
  nom: string
  etat: MachineState
}

export const toTarget = (machine: Pick<Machine, 'id' | 'nom' | 'etat_operationnel'>): CycleTarget => ({
  id: machine.id,
  nom: machine.nom,
  etat: machine.etat_operationnel,
})

/** Erreur rédigée pour l'utilisateur (état qui a changé, déchargement à moitié fait...). */
class CycleError extends Error {}

/**
 * Actions de conduite d'un cycle (terminer, décharger) avec confirmation, message de réussite et
 * erreur du serveur affichée telle quelle. Le démarrage a son propre dialogue (choix du programme).
 */
export function useMachineCycle(onDone: () => unknown) {
  const tenant = useTenantStore()
  const toast = useToast()
  const confirm = useConfirm()

  /** Machines dont une action est en cours (le bouton se met en attente). */
  const busy = ref<Set<string>>(new Set())

  async function run(id: string, action: (restaurantId: string) => Promise<string>) {
    if (!tenant.currentId || busy.value.has(id))
      return

    busy.value = new Set([...busy.value, id])

    try {
      toast.success(await action(tenant.currentId))
    }
    catch (cause) {
      toast.error(cause instanceof CycleError ? cause.message : pressingError(cause))
    }
    finally {
      busy.value = new Set([...busy.value].filter(other => other !== id))
      await onDone()
    }
  }

  async function finish(target: CycleTarget) {
    const accepted = await confirm({
      title: `Terminer le cycle de ${target.nom} ?`,
      text: 'Le programme est fini et le linge est dans le tambour. L\'heure de fin réelle sera enregistrée.',
      confirmLabel: 'Terminer le cycle',
    })

    if (accepted) {
      await run(target.id, async restaurantId => {
        await pressingApi.finishCycle(restaurantId, target.id)

        return `Le cycle de ${target.nom} est terminé.`
      })
    }
  }

  /**
   * Décharger, en un seul geste : cycle terminé → « à décharger » → « libre ». L'état réel est relu
   * avant chaque appel ; une seconde transition n'est jamais envoyée si la machine n'est plus à l'étape
   * attendue. Une confirmation pour tout le geste.
   */
  async function unload(target: CycleTarget) {
    const accepted = await confirm({
      title: `Décharger ${target.nom} ?`,
      text: 'Le linge est sorti du tambour et la machine redevient libre, prête pour une nouvelle commande.',
      confirmLabel: 'Machine déchargée',
    })

    if (!accepted)
      return

    await run(target.id, async restaurantId => {
      const etatReel = async () => (await pressingApi.machine(restaurantId, target.id)).etat_operationnel
      const etat = await etatReel()

      if (etat === 'libre')
        return `${target.nom} est déjà libre.`

      if (etat !== 'cycle_termine' && etat !== 'attente_dechargement')
        throw new CycleError(`${target.nom} n'est plus à décharger : son état est maintenant « ${etat} ». Rien de plus n'a été envoyé.`)

      if (etat === 'cycle_termine') {
        try {
          await pressingApi.unload(restaurantId, target.id)
        }
        catch (cause) {
          throw new CycleError(`Le déchargement de ${target.nom} n'a pas pu commencer : ${pressingError(cause)}`)
        }

        const apres = await etatReel()

        if (apres !== 'attente_dechargement')
          throw new CycleError(`${target.nom} a changé d'état pendant l'opération (« ${apres} »). Rien de plus n'a été envoyé.`)
      }

      try {
        await pressingApi.unload(restaurantId, target.id)
      }
      catch (cause) {
        throw new CycleError(`${target.nom} est déchargée mais n'a pas été marquée libre : ${pressingError(cause)}. Réessayez « Machine vidée ».`)
      }

      return `${target.nom} est libre.`
    })
  }

  return { busy, finish, unload }
}

/** Libellé du bouton de déchargement selon l'état de la machine. */
export const unloadLabel = (state: MachineState) => state === 'attente_dechargement' ? 'Machine vidée' : 'Décharger'
