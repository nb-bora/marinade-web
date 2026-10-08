<script lang="ts" setup>
import logo from '@images/logo.svg?raw'
import VerticalNavLayout from '@layouts/components/VerticalNavLayout.vue'
import AppNavigation from '@/layouts/components/AppNavigation.vue'
import NavbarThemeSwitcher from '@/layouts/components/NavbarThemeSwitcher.vue'
import RestaurantSwitcher from '@/layouts/components/RestaurantSwitcher.vue'
import TourButton from '@/layouts/components/TourButton.vue'
import UserMenu from '@/layouts/components/UserMenu.vue'
import AppTourOverlay from '@/ui/AppTourOverlay.vue'
</script>

<template>
  <VerticalNavLayout>
    <!-- 👉 navbar -->
    <template #navbar="{ toggleVerticalOverlayNavActive }">
      <div class="d-flex h-100 align-center gap-2">
        <!-- 👉 Vertical nav toggle in overlay mode -->
        <IconBtn
          class="ms-n3 d-lg-none"
          aria-label="Ouvrir le menu"
          @click="toggleVerticalOverlayNavActive(true)"
        >
          <VIcon icon="ri-menu-line" />
        </IconBtn>

        <RestaurantSwitcher />

        <VSpacer />

        <TourButton />

        <NavbarThemeSwitcher class="me-2" />

        <UserMenu />
      </div>
    </template>

    <template #vertical-nav-header="{ toggleIsOverlayNavActive }">
      <RouterLink
        to="/"
        class="app-logo app-title-wrapper"
        aria-label="Marinade, accueil"
      >
        <!-- eslint-disable vue/no-v-html -->
        <div
          class="d-flex"
          v-html="logo"
        />
        <!-- eslint-enable -->

        <h1 class="font-weight-semibold leading-normal text-xl">
          Marinade
        </h1>
      </RouterLink>

      <IconBtn
        class="d-block d-lg-none"
        aria-label="Fermer le menu"
        @click="toggleIsOverlayNavActive(false)"
      >
        <VIcon icon="ri-close-line" />
      </IconBtn>
    </template>

    <template #vertical-nav-content>
      <AppNavigation />
    </template>

    <!-- 👉 Pages -->
    <slot />

    <!-- 👉 Visite guidée (une seule instance pour toutes les pages) -->
    <AppTourOverlay />

    <!-- 👉 Footer -->
    <template #footer>
      <div class="h-100 d-flex align-center justify-center justify-md-start text-body-2 text-medium-emphasis">
        &copy; {{ new Date().getFullYear() }} Marinade
      </div>
    </template>
  </VerticalNavLayout>
</template>

<style lang="scss" scoped>
.app-logo {
  display: flex;
  align-items: center;
  column-gap: 0.75rem;
  text-decoration: none;
  color: inherit;
}
</style>
