<!-- La carte du restaurant : recherche, catégories, grille d'articles à toucher pour ajouter. -->
<script setup lang="ts">
import type { CatalogItem } from '../types'
import { formatMoney } from '@/lib/format'

const props = defineProps<{
  items: CatalogItem[]
  loading: boolean
  error: unknown

  /** Quantité déjà dans le panier, par identifiant d'article. */
  quantities: Record<string, number>
}>()

const emit = defineEmits<{ add: [item: CatalogItem]; retry: [] }>()

const ALL = '__all__'

const search = ref('')
const searchDebounced = refDebounced(search, 150)
const category = ref(ALL)

const categories = computed(() => {
  const counts = new Map<string, number>()

  for (const item of props.items)
    counts.set(item.category, (counts.get(item.category) ?? 0) + 1)

  return [...counts.entries()].map(([name, count]) => ({ name, count }))
})

// Une catégorie qui disparaît de la carte ne doit pas laisser une grille vide.
watch(categories, list => {
  if (category.value !== ALL && !list.some(entry => entry.name === category.value))
    category.value = ALL
})

const normalize = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

const visible = computed(() => {
  const query = normalize(searchDebounced.value.trim())

  return props.items.filter(item =>
    (category.value === ALL || item.category === category.value)
    && (!query || normalize(`${item.name} ${item.category}`).includes(query)))
})

const hasSearch = computed(() => searchDebounced.value.trim() !== '')
</script>

<template>
  <VCard>
    <VCardItem class="pb-2">
      <VCardTitle>Carte</VCardTitle>
      <VCardSubtitle>Touchez un article pour l'ajouter à la commande.</VCardSubtitle>
    </VCardItem>

    <VCardText class="pb-2">
      <VTextField
        v-model="search"
        label="Rechercher un plat ou une boisson"
        prepend-inner-icon="ri-search-line"
        clearable
        hide-details
        autocomplete="off"
      />

      <div
        v-if="categories.length > 1"
        class="categories mt-4"
        role="group"
        aria-label="Catégories"
      >
        <VChip
          :variant="category === ALL ? 'flat' : 'tonal'"
          :color="category === ALL ? 'primary' : undefined"
          size="large"
          @click="category = ALL"
        >
          Tout
        </VChip>
        <VChip
          v-for="entry in categories"
          :key="entry.name"
          :variant="category === entry.name ? 'flat' : 'tonal'"
          :color="category === entry.name ? 'primary' : undefined"
          size="large"
          @click="category = entry.name"
        >
          {{ entry.name }}
        </VChip>
      </div>
    </VCardText>

    <VDivider class="mt-2" />

    <AppErrorState
      v-if="error && !items.length"
      class="ma-4"
      :error="error"
      @retry="emit('retry')"
    />

    <VSkeletonLoader
      v-else-if="loading && !items.length"
      type="card, card"
    />

    <AppEmptyState
      v-else-if="!items.length"
      icon="ri-restaurant-line"
      title="La carte est vide"
      text="Ajoutez des plats et des boissons à la carte pour pouvoir prendre des commandes."
    />

    <AppEmptyState
      v-else-if="!visible.length"
      icon="ri-search-line"
      title="Aucun article ne correspond"
      :text="hasSearch ? 'Essayez un autre mot ou une autre catégorie.' : 'Cette catégorie est vide.'"
    />

    <div
      v-else
      class="grid pa-4"
    >
      <button
        v-for="item in visible"
        :key="item.id"
        type="button"
        class="article"
        :class="{ 'article--off': !item.available, 'article--in': quantities[item.id] }"
        :disabled="!item.available"
        :aria-label="`Ajouter ${item.name}, ${formatMoney(item.price, item.currency)}`"
        @click="emit('add', item)"
      >
        <span class="d-flex align-start justify-space-between gap-2 w-100">
          <VIcon
            :icon="item.kind === 'plat' ? 'ri-restaurant-line' : 'ri-goblet-line'"
            size="20"
            class="text-medium-emphasis"
          />
          <span
            v-if="quantities[item.id]"
            class="article__badge"
          >{{ quantities[item.id] }}</span>
        </span>
        <span class="article__name">{{ item.name }}</span>
        <span class="d-flex flex-wrap align-center justify-space-between gap-x-2 w-100">
          <span class="font-weight-semibold tabular-nums text-no-wrap">{{ formatMoney(item.price, item.currency) }}</span>
          <span
            v-if="!item.available"
            class="text-caption text-error"
          >Indisponible</span>
        </span>
      </button>
    </div>
  </VCard>
</template>

<style scoped>
.categories {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(9.5rem, 1fr));
  gap: 12px;
}

.article {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  min-block-size: 112px;
  padding: 12px;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 12px;
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
  text-align: start;
  transition: transform 0.1s ease, border-color 0.12s ease, background-color 0.12s ease;
}

.article:hover:not(:disabled) {
  border-color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.06);
}

.article:active:not(:disabled) {
  transform: scale(0.97);
}

.article:focus-visible {
  outline: 3px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}

.article--in {
  border-color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.1);
}

.article--off {
  opacity: 0.5;
  cursor: not-allowed;
}

.article__name {
  flex: 1;
  display: -webkit-box;
  overflow: hidden;
  font-weight: 500;
  line-height: 1.3;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.article__badge {
  min-inline-size: 24px;
  padding-inline: 7px;
  border-radius: 12px;
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
  font-size: 0.8125rem;
  font-weight: 700;
  line-height: 24px;
  text-align: center;
}

@media (prefers-reduced-motion: reduce) {
  .article {
    transition: none;
  }
}
</style>
