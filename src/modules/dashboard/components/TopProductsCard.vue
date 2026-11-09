<!-- Plats et boissons les plus vendus sur 7 jours, avec une barre proportionnelle. -->
<script setup lang="ts">
import { money, plural } from '../format'
import type { RestaurantDashboard } from '../types'

const props = defineProps<{ data: RestaurantDashboard | null }>()

const products = computed(() => props.data?.top_produits ?? [])
const max = computed(() => Math.max(1, ...products.value.map(p => p.quantite)))
</script>

<template>
  <VCard
    class="h-100"
    data-tour="dash-top"
  >
    <VCardItem>
      <template #prepend>
        <VAvatar
          color="primary"
          variant="tonal"
          rounded="lg"
        >
          <VIcon icon="ri-trophy-line" />
        </VAvatar>
      </template>
      <VCardTitle>Les plus vendus</VCardTitle>
      <VCardSubtitle>Sur les 7 derniers jours</VCardSubtitle>
    </VCardItem>

    <VSkeletonLoader
      v-if="!data"
      type="list-item-two-line, list-item-two-line"
    />

    <VCardText v-else-if="!products.length">
      <AppEmptyState
        icon="ri-restaurant-line"
        title="Pas encore de ventes"
        text="Le classement apparaît dès les premières commandes."
      />
    </VCardText>

    <VCardText
      v-else
      class="d-flex flex-column gap-4"
    >
      <div
        v-for="(p, i) in products"
        :key="p.nom"
      >
        <div class="d-flex align-center gap-3 mb-1">
          <VAvatar
            size="26"
            :color="i === 0 ? 'primary' : 'secondary'"
            :variant="i === 0 ? 'flat' : 'tonal'"
            class="text-caption font-weight-bold"
          >
            {{ i + 1 }}
          </VAvatar>
          <span class="text-body-1 font-weight-medium text-truncate flex-grow-1">{{ p.nom }}</span>
          <span class="text-body-2 text-medium-emphasis text-no-wrap">{{ plural(p.quantite, 'vendu', 'vendus') }}</span>
        </div>
        <div class="d-flex align-center gap-3">
          <VProgressLinear
            :model-value="(p.quantite / max) * 100"
            :color="i === 0 ? 'primary' : 'secondary'"
            height="6"
            rounded
            bg-opacity="0.12"
          />
          <span class="text-body-2 font-weight-medium tabular-nums text-no-wrap amount">{{ money(p.montant, data.devise) }}</span>
        </div>
      </div>
    </VCardText>
  </VCard>
</template>

<style scoped>
.amount {
  min-width: 96px;
  text-align: end;
}
</style>
