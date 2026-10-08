<!-- Pied de tableau : lignes par page, plage affichée, pages, précédent / suivant. -->
<script setup lang="ts">
const props = withDefaults(defineProps<{
  page: number
  pageSize: number

  /** Lignes de la page courante. */
  count: number

  /** Total connu ; à défaut, on n'affiche que la plage. */
  total?: number | null

  /** Nombre de pages joignables (les pages connues), pour les numéros. */
  pages?: number
  hasNext: boolean
  loading?: boolean
  sizes?: number[]
}>(), {
  total: null,
  pages: 1,
  loading: false,
  sizes: () => [10, 25, 50, 100],
})

const emit = defineEmits<{
  'update:page': [page: number]
  'update:pageSize': [size: number]
}>()

const first = computed(() => (props.count === 0 ? 0 : (props.page - 1) * props.pageSize + 1))
const last = computed(() => (props.page - 1) * props.pageSize + props.count)

// Au plus 5 numéros autour de la page courante.
const numbers = computed(() => {
  const end = Math.max(props.pages, props.page)
  const start = Math.max(1, Math.min(props.page - 2, end - 4))

  return Array.from({ length: Math.min(5, end - start + 1) }, (_, index) => start + index)
})
</script>

<template>
  <div class="app-table-pagination d-flex flex-wrap align-center justify-end gap-x-6 gap-y-3 px-5 py-3">
    <div class="d-flex align-center gap-2 text-body-2">
      <span class="text-medium-emphasis">Lignes par page</span>
      <VSelect
        :model-value="pageSize"
        :items="sizes"
        density="compact"
        variant="plain"
        hide-details
        class="app-table-pagination__size"
        aria-label="Lignes par page"
        @update:model-value="emit('update:pageSize', Number($event))"
      />
    </div>

    <span class="text-body-2 text-medium-emphasis tabular-nums">
      {{ first }}–{{ last }}<template v-if="total !== null"> sur {{ total }}</template>
    </span>

    <nav
      class="d-flex align-center gap-1"
      aria-label="Pagination"
    >
      <IconBtn
        size="small"
        :disabled="page <= 1 || loading"
        aria-label="Page précédente"
        @click="emit('update:page', page - 1)"
      >
        <VIcon icon="ri-arrow-left-s-line" />
      </IconBtn>

      <VBtn
        v-for="number in numbers"
        :key="number"
        size="small"
        :variant="number === page ? 'flat' : 'text'"
        :color="number === page ? 'primary' : 'default'"
        :disabled="loading || number > Math.max(pages, page)"
        class="app-table-pagination__number"
        :aria-current="number === page ? 'page' : undefined"
        @click="number !== page && emit('update:page', number)"
      >
        {{ number }}
      </VBtn>

      <IconBtn
        size="small"
        :disabled="!hasNext || loading"
        aria-label="Page suivante"
        @click="emit('update:page', page + 1)"
      >
        <VIcon icon="ri-arrow-right-s-line" />
      </IconBtn>
    </nav>
  </div>
</template>

<style scoped>
.app-table-pagination__size {
  max-inline-size: 4.5rem;
}

/* Le thème impose une largeur minimale et un padding aux boutons : on force un carré. */
.app-table-pagination__number {
  min-inline-size: 2.25rem !important;
  inline-size: 2.25rem;
  block-size: 2.25rem !important;
  padding-inline: 0 !important;
  font-variant-numeric: tabular-nums;
}
</style>
