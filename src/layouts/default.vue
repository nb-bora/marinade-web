<script lang="ts" setup>
import DefaultLayoutWithVerticalNav from './components/DefaultLayoutWithVerticalNav.vue'
import { useTenantStore } from '@/stores/tenant.store'

// Changer de restaurant remonte la page : chaque écran recharge ses données pour le
// nouveau restaurant, sans qu'aucun écran n'ait à écouter ce changement.
const tenant = useTenantStore()
</script>

<template>
  <DefaultLayoutWithVerticalNav>
    <RouterView v-slot="{ Component }">
      <Transition
        name="page"
        mode="out-in"
      >
        <Component
          :is="Component"
          :key="tenant.currentId ?? 'none'"
        />
      </Transition>
    </RouterView>
  </DefaultLayoutWithVerticalNav>
</template>

<style lang="scss">
// As we are using `layouts` plugin we need its styles to be imported
@use "@layouts/styles/default-layout";

.page-enter-active,
.page-leave-active {
  transition: opacity 0.12s ease;
}

.page-enter-from,
.page-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .page-enter-active,
  .page-leave-active {
    transition: none;
  }
}
</style>
