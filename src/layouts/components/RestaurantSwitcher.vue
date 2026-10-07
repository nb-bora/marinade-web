<script lang="ts" setup>
import { relationLabel } from '@/lib/labels'
import { useTenantStore } from '@/stores/tenant.store'

const tenant = useTenantStore()

const hasChoice = computed(() => tenant.restaurants.length > 1)
</script>

<template>
  <div
    v-if="tenant.current"
    class="restaurant-switcher"
  >
    <VBtn
      v-if="hasChoice"
      variant="tonal"
      color="primary"
      class="text-none px-3"
      prepend-icon="ri-restaurant-2-line"
      append-icon="ri-arrow-down-s-line"
      aria-label="Changer de restaurant"
    >
      <span class="text-truncate restaurant-switcher__name">{{ tenant.current.name }}</span>

      <VMenu
        activator="parent"
        location="bottom start"
        max-height="420"
      >
        <VList
          density="comfortable"
          min-width="260"
          :selected="[tenant.current.restaurant_id]"
        >
          <VListSubheader>Mes restaurants</VListSubheader>
          <VListItem
            v-for="restaurant in tenant.restaurants"
            :key="restaurant.restaurant_id"
            :value="restaurant.restaurant_id"
            :title="restaurant.name"
            :subtitle="[restaurant.city, relationLabel(restaurant)].filter(Boolean).join(' · ')"
            @click="tenant.select(restaurant.restaurant_id)"
          />
        </VList>
      </VMenu>
    </VBtn>

    <div
      v-else
      class="d-flex align-center gap-2 text-body-1 font-weight-medium"
    >
      <VIcon
        icon="ri-restaurant-2-line"
        size="20"
        class="text-medium-emphasis"
      />
      <span class="text-truncate restaurant-switcher__name">{{ tenant.current.name }}</span>
    </div>
  </div>
</template>

<style scoped>
.restaurant-switcher__name {
  max-inline-size: 14rem;
}
</style>
