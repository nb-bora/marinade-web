<!-- Caisse : qui encaisse en ce moment et ce qu'il reste à encaisser. -->
<script setup lang="ts">
import { money, plural } from '../format'
import type { RestaurantDashboard } from '../types'

const props = defineProps<{ data: RestaurantDashboard | null }>()

const cash = computed(() => props.data?.caisse)
</script>

<template>
  <VCard
    class="h-100"
    data-tour="dash-cash"
  >
    <VCardItem>
      <template #prepend>
        <VAvatar
          :color="cash?.ouvertes ? 'success' : 'secondary'"
          variant="tonal"
          rounded="lg"
        >
          <VIcon icon="ri-store-2-line" />
        </VAvatar>
      </template>
      <VCardTitle>Caisse</VCardTitle>
      <VCardSubtitle v-if="cash">
        {{ cash.ouvertes ? plural(cash.ouvertes, 'caisse ouverte', 'caisses ouvertes') : 'Aucune caisse ouverte' }}
      </VCardSubtitle>
    </VCardItem>

    <VSkeletonLoader
      v-if="!data"
      type="article"
    />

    <VCardText v-else>
      <div class="d-flex flex-wrap gap-2 mb-4">
        <VChip
          v-for="name in cash?.caissiers"
          :key="name"
          color="success"
          variant="tonal"
          prepend-icon="ri-user-3-line"
        >
          {{ name }}
        </VChip>
        <span
          v-if="!cash?.caissiers.length"
          class="text-body-2 text-medium-emphasis"
        >Ouvrez une caisse pour suivre les espèces et les écarts.</span>
      </div>

      <div class="due pa-4">
        <div class="text-body-2 text-medium-emphasis">
          Reste à encaisser
        </div>
        <div
          class="text-h5 font-weight-semibold tabular-nums"
          :class="data.kpi.reste_a_encaisser > 0 ? 'text-warning' : 'text-success'"
        >
          {{ money(data.kpi.reste_a_encaisser, data.devise) }}
        </div>
      </div>

      <VBtn
        block
        class="mt-4"
        variant="tonal"
        to="/caisse"
        prepend-icon="ri-store-2-line"
      >
        Ouvrir la caisse
      </VBtn>
    </VCardText>
  </VCard>
</template>

<style scoped>
.due {
  background: rgba(var(--v-theme-on-surface), 0.04);
  border-radius: 12px;
}
</style>
