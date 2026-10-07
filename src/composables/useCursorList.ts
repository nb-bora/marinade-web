import type { Ref } from 'vue'

export interface CursorPage<T> {
  items: T[]
  next_cursor?: string | null
}

export type PageFetcher<T> = (cursor: string | undefined, signal: AbortSignal) => Promise<CursorPage<T>>

export interface CursorListOptions<T> {

  /** Identifiant stable d'une ligne : nécessaire à `refreshHead` pour fusionner sans doublon. */
  keyOf?: (item: T) => string
}

/**
 * Liste paginée par curseur (« charger plus »), pour toute route qui renvoie
 * `{ items, next_cursor }`.
 *
 * Chaque page coûte la même chose côté serveur, que l'on soit à la première ou à la
 * centième. Une nouvelle requête (`reload`) annule la précédente : une réponse lente et
 * périmée n'écrase jamais une réponse plus récente.
 */
export function useCursorList<T>(fetchPage: PageFetcher<T>, options: CursorListOptions<T> = {}) {
  const items = ref([]) as Ref<T[]>
  const nextCursor = ref<string | null>(null)
  const loading = ref(false)
  const loadingMore = ref(false)
  const error = ref<unknown>(null)
  const loadedOnce = ref(false)

  let controller: AbortController | null = null

  const hasMore = computed(() => nextCursor.value !== null)

  async function run(append: boolean): Promise<void> {
    controller?.abort()

    const current = new AbortController()

    controller = current
    error.value = null
    ;(append ? loadingMore : loading).value = true

    try {
      const page = await fetchPage(append ? nextCursor.value ?? undefined : undefined, current.signal)

      if (current.signal.aborted)
        return

      items.value = append ? [...items.value, ...page.items] : page.items
      nextCursor.value = page.next_cursor ?? null
      loadedOnce.value = true
    }
    catch (cause) {
      if (!current.signal.aborted)
        error.value = cause
    }
    finally {
      if (controller === current) {
        loading.value = false
        loadingMore.value = false
      }
    }
  }

  /** Repart de la première page. */
  const reload = () => run(false)

  /** Ajoute la page suivante, s'il y en a une. */
  const loadMore = () => hasMore.value && !loadingMore.value ? run(true) : Promise.resolve()

  /**
   * Actualise la tête de liste SANS perdre les pages déjà chargées : les lignes revenues
   * sont mises à jour (un statut qui change), les nouvelles sont ajoutées en haut. Sert
   * aux écrans « en direct » : l'utilisateur qui a déroulé la liste ne la voit pas sauter.
   */
  async function refreshHead(): Promise<void> {
    const keyOf = options.keyOf

    if (!keyOf || loading.value || loadingMore.value)
      return reload()

    const current = new AbortController()

    try {
      const page = await fetchPage(undefined, current.signal)
      const fresh = new Set(page.items.map(keyOf))

      items.value = [...page.items, ...items.value.filter(item => !fresh.has(keyOf(item)))]

      // Sans page suivante connue (liste vide jusque-là), la tête donne le curseur.
      if (!loadedOnce.value || (nextCursor.value === null && items.value.length === page.items.length))
        nextCursor.value = page.next_cursor ?? null

      loadedOnce.value = true
      error.value = null
    }
    catch (cause) {
      // Une actualisation silencieuse qui échoue ne doit pas effacer ce qui est affiché.
      if (!loadedOnce.value)
        error.value = cause
    }
  }

  onScopeDispose(() => controller?.abort())

  return { items, loading, loadingMore, error, hasMore, loadedOnce, reload, loadMore, refreshHead }
}
