import type { Ref } from 'vue'

/**
 * Pagination en mémoire, pour les listes que l'API renvoie en entier (carte, tables...).
 * Revient à la page 1 quand la liste change de taille (filtre, recherche).
 */
export function useClientPagination<T>(source: Ref<T[]>, initialPageSize = 10) {
  const page = ref(1)
  const pageSize = ref(initialPageSize)

  const total = computed(() => source.value.length)
  const pages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
  const rows = computed(() => source.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value))
  const hasNext = computed(() => page.value < pages.value)

  watch([total, pageSize], () => {
    page.value = 1
  })

  return { page, pageSize, total, pages, rows, hasNext }
}
