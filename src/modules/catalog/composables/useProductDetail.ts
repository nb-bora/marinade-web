import type { Ref } from 'vue'

/**
 * Charge la fiche d'un produit quand son identifiant change (`null` : tiroir fermé).
 *
 * - Une nouvelle requête annule la précédente : une réponse lente ne remplace pas une plus récente.
 * - À la fermeture, la fiche reste affichée le temps de l'animation (le tiroir ne se vide pas
 *   pendant qu'il glisse) ; seule la requête en cours est annulée.
 * - `reload` recharge la fiche ouverte sans repasser par le squelette (après une modification).
 */
export function useProductDetail<T>(id: Ref<string | null>, fetcher: (id: string, signal: AbortSignal) => Promise<T>) {
  const detail = ref<T | null>(null) as Ref<T | null>
  const loading = ref(false)
  const error = ref<unknown>(null)

  let controller: AbortController | null = null

  async function load(target: string, silent = false) {
    controller?.abort()

    const current = new AbortController()

    controller = current
    error.value = null
    if (!silent)
      loading.value = true

    try {
      const result = await fetcher(target, current.signal)

      if (!current.signal.aborted)
        detail.value = result
    }
    catch (cause) {
      if (!current.signal.aborted)
        error.value = cause
    }
    finally {
      if (!current.signal.aborted)
        loading.value = false
    }
  }

  watch(id, value => {
    if (value) {
      detail.value = null
      load(value)
    }
    else {
      controller?.abort()
      loading.value = false
    }
  }, { immediate: true })

  onScopeDispose(() => controller?.abort())

  const retry = () => id.value ? load(id.value) : undefined
  const reload = () => id.value ? load(id.value, true) : undefined

  return { detail, loading, error, retry, reload }
}
