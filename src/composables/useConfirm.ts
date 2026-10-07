import { createGlobalState } from '@vueuse/core'

export interface ConfirmOptions {
  title: string
  text?: string
  confirmLabel?: string
  cancelLabel?: string

  /** Action destructive : bouton rouge. */
  danger?: boolean
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (accepted: boolean) => void
}

export const useConfirmState = createGlobalState(() => ({ pending: ref<PendingConfirm | null>(null) }))

/**
 * Demande une confirmation et attend la réponse :
 * `if (await confirm({ title: 'Annuler la commande ?', danger: true })) ...`
 */
export function useConfirm() {
  const { pending } = useConfirmState()

  return (options: ConfirmOptions) => new Promise<boolean>(resolve => {
    pending.value?.resolve(false)
    pending.value = { ...options, resolve }
  })
}
