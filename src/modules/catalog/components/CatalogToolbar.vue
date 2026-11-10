<!--
  Barre d'outils commune aux listes de plats et de boissons : disponibilité (avec les effectifs),
  recherche, filtres propres à la liste (slot), tri, décompte des résultats et remise à zéro.
-->
<script setup lang="ts">
import type { SortKey, SortOption } from '../products'

type Availability = 'all' | 'on' | 'off'

const props = defineProps<{

  /** Effectifs de la carte entière, hors filtres. */
  counts: { all: number; on: number; off: number }

  /** « plat », « boisson » : nom au singulier, pour le décompte. */
  noun: string
  shown: number
  total: number
  hasFilters: boolean
  loaded: boolean
  sortOptions: SortOption[]
}>()

defineEmits<{ clear: [] }>()

const availability = defineModel<Availability>('availability', { required: true })
const search = defineModel<string>('search', { required: true })
const sort = defineModel<SortKey>('sort', { required: true })

const availabilityOptions = computed(() => [
  { value: 'all' as const, title: `Tous (${props.counts.all})` },
  { value: 'on' as const, title: `Disponibles (${props.counts.on})` },
  { value: 'off' as const, title: `Indisponibles (${props.counts.off})` },
])

const summary = computed(() => {
  const label = `${props.shown} ${props.noun}${props.shown > 1 ? 's' : ''}`

  return props.hasFilters ? `${label} sur ${props.total}` : label
})
</script>

<template>
  <div class="catalog-toolbar">
    <div class="catalog-toolbar__row">
      <AppSegmented
        v-model="availability"
        :options="availabilityOptions"
        :label="`Filtrer les ${noun}s par disponibilité`"
        class="catalog-toolbar__segmented"
      />
      <VTextField
        v-model="search"
        class="catalog-toolbar__search"
        :label="`Rechercher un ${noun}`"
        placeholder="Nom ou description"
        prepend-inner-icon="ri-search-line"
        density="compact"
        variant="solo-filled"
        flat
        rounded="lg"
        hide-details
        clearable
        autocomplete="off"
      />
    </div>

    <div class="catalog-toolbar__row">
      <div class="catalog-toolbar__filters">
        <slot />
        <VSelect
          v-model="sort"
          :items="sortOptions"
          label="Trier par"
          prepend-inner-icon="ri-sort-desc"
          density="compact"
          variant="solo-filled"
          flat
          rounded="lg"
          hide-details
          class="catalog-toolbar__field"
        />
      </div>
    </div>

    <div class="catalog-toolbar__summary">
      <span
        class="text-body-2 text-medium-emphasis"
        aria-live="polite"
      >
        <template v-if="loaded">{{ summary }}</template>
      </span>
      <VBtn
        v-if="hasFilters"
        size="small"
        variant="text"
        color="primary"
        prepend-icon="ri-filter-off-line"
        @click="$emit('clear')"
      >
        Effacer les filtres
      </VBtn>
    </div>
  </div>
</template>

<style scoped>
.catalog-toolbar {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 20px 8px;
}

.catalog-toolbar__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px 16px;
}

.catalog-toolbar__search {
  flex: 0 1 340px;
  min-inline-size: 220px;
}

.catalog-toolbar__filters {
  display: flex;
  flex: 1 1 auto;
  flex-wrap: wrap;
  gap: 12px;
}

/* Les filtres de la liste (slot) et le tri partagent la même largeur. */
.catalog-toolbar__filters :deep(.v-input),
.catalog-toolbar__field {
  flex: 1 1 200px;
  max-inline-size: 280px;
}

.catalog-toolbar__summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-block-size: 32px;
}

@media (max-width: 599px) {
  .catalog-toolbar {
    padding-inline: 14px;
  }

  .catalog-toolbar__row > *,
  .catalog-toolbar__filters :deep(.v-input),
  .catalog-toolbar__field {
    flex: 1 1 100%;
    max-inline-size: none;
  }

  .catalog-toolbar__segmented {
    display: flex;
  }

  .catalog-toolbar__segmented :deep(.app-segmented__item) {
    flex: 1 1 0;
    padding-inline: 4px;
    text-align: center;
  }
}
</style>
