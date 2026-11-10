import { useConfirm } from '@/composables/useConfirm'
import { useSubmit } from '@/composables/useSubmit'
import { useToast } from '@/stores/toast.store'

interface Toggleable {
  id: string
  disponible: boolean
}

export interface AvailabilityCopy {

  /** Question posée avant de retirer l'article de la vente. */
  off: { title: string; text: string; done: string }

  /** Question posée avant de le remettre en vente. */
  on: { title: string; text: string; done: string }
}

/**
 * Bascule la disponibilité d'un plat ou d'une boisson : confirmation, enregistrement, message de
 * réussite, rechargement. Une seule bascule à la fois (`busyId` désigne l'article en cours), et
 * toute erreur du serveur s'affiche en message d'alerte.
 */
export function useAvailabilityToggle<T extends Toggleable>(options: {
  copy: (item: T) => AvailabilityCopy
  update: (id: string, disponible: boolean) => Promise<unknown>

  /** Appelé après l'enregistrement : recharge la liste, la fiche ouverte... */
  done: () => unknown
}) {
  const toast = useToast()
  const confirm = useConfirm()
  const busyId = ref<string | null>(null)

  const { submit: toggle, error } = useSubmit(async (item: T) => {
    const copy = options.copy(item)
    const next = item.disponible ? copy.off : copy.on

    if (!(await confirm({ title: next.title, text: next.text, confirmLabel: 'Enregistrer' })))
      return

    busyId.value = item.id
    try {
      await options.update(item.id, !item.disponible)
      toast.success(next.done)
      await options.done()
    }
    finally {
      busyId.value = null
    }
  })

  watch(error, value => {
    if (value)
      toast.error(value)
  })

  return { toggle, busyId }
}
