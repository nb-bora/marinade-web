<!-- Ingrédients sous leur seuil d'alerte, les plus critiques d'abord. -->
<script setup lang="ts">
import { plural } from '../format'
import type { RestaurantDashboard } from '../types'

const props = defineProps<{ data: RestaurantDashboard | null }>()

const stock = computed(() => props.data?.stock)

const num = (value: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(value)
</script>

<template>
  <VCard
    class="h-100"
    data-tour="dash-stock"
  >
    <VCardItem>
      <template #prepend>
        <VAvatar
          :color="stock?.ruptures ? 'error' : stock?.sous_seuil ? 'warning' : 'success'"
          variant="tonal"
          rounded="lg"
        >
          <VIcon icon="ri-store-3-line" />
        </VAvatar>
      </template>
      <VCardTitle>Stock à surveiller</VCardTitle>
      <VCardSubtitle v-if="stock">
        {{ stock.sous_seuil ? `${plural(stock.sous_seuil, 'ingrédient')} sous le seuil` : 'Tous les niveaux sont bons' }}
      </VCardSubtitle>
      <template #append>
        <VBtn
          variant="text"
          size="small"
          icon="ri-arrow-right-line"
          to="/stock"
          aria-label="Ouvrir le stock"
        />
      </template>
    </VCardItem>

    <VSkeletonLoader
      v-if="!data"
      type="list-item-two-line, list-item-two-line"
    />

    <VCardText v-else-if="!stock?.articles.length">
      <AppEmptyState
        icon="ri-checkbox-circle-line"
        title="Stock en ordre"
        text="Aucun ingrédient n'est passé sous son seuil d'alerte."
      />
    </VCardText>

    <VCardText
      v-else
      class="d-flex flex-column gap-4"
    >
      <div
        v-for="a in stock.articles"
        :key="a.nom"
      >
        <div class="d-flex align-center gap-2 mb-1">
          <span class="text-body-1 font-weight-medium text-truncate flex-grow-1">{{ a.nom }}</span>
          <VChip
            v-if="a.quantite <= 0"
            size="x-small"
            color="error"
            variant="flat"
            label
          >
            Rupture
          </VChip>
          <span
            v-else
            class="text-body-2 tabular-nums text-no-wrap"
          >{{ num(a.quantite) }} <span class="text-medium-emphasis">/ {{ num(a.seuil) }} {{ a.unite }}</span></span>
        </div>
        <VProgressLinear
          :model-value="a.seuil ? Math.min(100, (a.quantite / a.seuil) * 100) : 0"
          :color="a.quantite <= 0 ? 'error' : 'warning'"
          height="6"
          rounded
          bg-opacity="0.14"
        />
      </div>
    </VCardText>
  </VCard>
</template>
