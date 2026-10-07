import { useDocumentVisibility, useIntervalFn } from '@vueuse/core'
import { container } from '@/container'

/**
 * Actualise un écran à intervalle régulier tant que l'onglet est visible.
 *
 * Un onglet en arrière-plan ne consomme rien ; au retour, l'écran se remet à jour tout de
 * suite au lieu d'attendre le prochain tour. Les écrans à très faible latence (cuisine)
 * utilisent un WebSocket à la place.
 */
export function useLive(refresh: () => unknown, intervalMs: number = container.config.livePollIntervalMs) {
  const visibility = useDocumentVisibility()
  const { pause, resume, isActive } = useIntervalFn(() => refresh(), intervalMs, { immediate: false })

  watch(visibility, state => {
    if (state === 'visible') {
      refresh()
      resume()
    }
    else {
      pause()
    }
  }, { immediate: true })

  return { isLive: isActive, pause, resume }
}
