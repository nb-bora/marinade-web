import type { Ref, WatchSource } from 'vue'

export interface AsyncDataOptions {

  /** Recharge quand l'une de ces sources change (filtres, identifiant...). */
  watch?: WatchSource[]

  /** Charge dès la création (par défaut : oui). */
  immediate?: boolean
}

/**
 * Charge une donnée (liste, fiche...) avec état de chargement et d'erreur.
 *
 * Une nouvelle requête annule la précédente : une réponse lente et périmée n'écrase
 * jamais une réponse plus récente. `refresh` recharge sans repasser par l'état « chargement »
 * (pas de clignotement après une modification).
 */
export function useAsyncData<T>(fetcher: (signal: AbortSignal) => Promise<T>, options: AsyncDataOptions = {}) {
  const data = ref<T | null>(null) as Ref<T | null>
  const loading = ref(false)
  const error = ref<unknown>(null)

  let controller: AbortController | null = null

  async function run(silent: boolean): Promise<void> {
    controller?.abort()

    const current = new AbortController()

    controller = current
    if (!silent)
      loading.value = true

    try {
      const result = await fetcher(current.signal)

      if (!current.signal.aborted) {
        data.value = result
        error.value = null
      }
    }
    catch (cause) {
      if (!current.signal.aborted && (!silent || data.value === null))
        error.value = cause
    }
    finally {
      if (controller === current)
        loading.value = false
    }
  }

  const reload = () => run(false)
  const refresh = () => run(true)

  if (options.watch?.length)
    watch(options.watch, () => reload())

  if (options.immediate !== false)
    reload()

  onScopeDispose(() => controller?.abort())

  return { data, loading, error, reload, refresh }
}
