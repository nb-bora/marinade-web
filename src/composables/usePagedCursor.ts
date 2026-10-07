import type { Ref } from 'vue'
import type { CursorPage } from './useCursorList'

export type PagedFetcher<T> = (cursor: string | undefined, limit: number, signal: AbortSignal) => Promise<CursorPage<T>>

/**
 * Pagination numérotée (page 1, 2, 3...) au-dessus d'une API à curseur.
 *
 * Le serveur ne connaît que « la page après tel curseur » : chaque page coûte donc la même
 * chose, qu'elle soit la première ou la centième. On mémorise le curseur de début de chaque
 * page déjà visitée, ce qui permet de revenir en arrière ou de sauter à une page connue sans
 * tout relire. Changer de taille de page ou de filtre repart de la page 1.
 */
export function usePagedCursor<T>(fetchPage: PagedFetcher<T>, initialPageSize = 10) {
  const items = ref([]) as Ref<T[]>
  const page = ref(1)
  const pageSize = ref(initialPageSize)
  const loading = ref(false)
  const loadedOnce = ref(false)
  const error = ref<unknown>(null)

  /** `starts[n]` : curseur de début de la page n+1 (`undefined` pour la première). */
  const starts = ref<(string | undefined)[]>([undefined])
  const hasNext = computed(() => starts.value.length > page.value)

  /** Pages joignables directement : celles déjà vues et la suivante. */
  const knownPages = computed(() => starts.value.length)

  let controller: AbortController | null = null

  async function load(target: number, silent = false): Promise<void> {
    if (target < 1 || target > starts.value.length)
      return

    controller?.abort()

    const current = new AbortController()

    controller = current
    if (!silent)
      loading.value = true

    try {
      const result = await fetchPage(starts.value[target - 1], pageSize.value, current.signal)

      if (current.signal.aborted)
        return

      items.value = result.items
      page.value = target
      error.value = null
      loadedOnce.value = true

      // Le curseur de la page suivante ; s'il disparaît, les pages au-delà n'existent plus.
      const next = result.next_cursor ?? null
      const kept = starts.value.slice(0, target)

      starts.value = next ? [...kept, next, ...starts.value.slice(target + 1)] : kept
    }
    catch (cause) {
      if (!current.signal.aborted && (!silent || !loadedOnce.value))
        error.value = cause
    }
    finally {
      if (controller === current)
        loading.value = false
    }
  }

  /** Repart de la première page (filtre ou taille de page modifiés). */
  function reset(): Promise<void> {
    starts.value = [undefined]

    return load(1)
  }

  /** Actualise la page affichée sans état de chargement (écran « en direct »). */
  const refresh = () => load(page.value, true)

  const goTo = (target: number) => load(target)
  const next = () => (hasNext.value ? load(page.value + 1) : Promise.resolve())
  const previous = () => (page.value > 1 ? load(page.value - 1) : Promise.resolve())

  watch(pageSize, () => reset())

  onScopeDispose(() => controller?.abort())

  return { items, page, pageSize, loading, loadedOnce, error, hasNext, knownPages, reset, refresh, goTo, next, previous }
}
