<!-- Bandeau d'accueil : salutation, phase du service, indicateur « en direct » et accès rapides. -->
<script setup lang="ts">
import { clock, localHour } from '../format'
import type { RestaurantDashboard } from '../types'

const props = defineProps<{
  data: RestaurantDashboard | null
  greeting: string
  restaurant: string
  today: string
  loading: boolean
}>()

defineEmits<{ refresh: [] }>()

const phase = computed(() => {
  const h = props.data ? localHour(props.data.genere_le, props.data.fuseau) : new Date().getHours()

  if (h < 11)
    return 'Service du matin'

  if (h < 15)
    return 'Service du midi'

  if (h < 18)
    return 'Après-midi'

  return 'Service du soir'
})
</script>

<template>
  <header class="hero">
    <div class="hero__main min-w-0">
      <div class="hero__eyebrow">
        <span class="live-dot" />
        <span>{{ phase }}</span>
        <span
          v-if="data"
          class="hero__sync"
          data-testid="dashboard-updated"
        >· mis à jour à {{ clock(data.genere_le, data.fuseau) }}</span>
      </div>
      <h1 class="hero__title">
        {{ greeting }}
      </h1>
      <p class="hero__subtitle">
        {{ restaurant }} · {{ today }}
      </p>
    </div>

    <div class="hero__actions">
      <VBtn
        prepend-icon="ri-layout-grid-line"
        to="/salle"
      >
        Prendre une commande
      </VBtn>
      <VBtn
        variant="tonal"
        prepend-icon="ri-store-2-line"
        to="/caisse"
      >
        Caisse
      </VBtn>
      <VBtn
        variant="tonal"
        color="secondary"
        prepend-icon="ri-calendar-check-line"
        to="/reservations"
      >
        Réservations
      </VBtn>
      <VBtn
        variant="text"
        color="secondary"
        icon="ri-refresh-line"
        aria-label="Actualiser"
        :loading="loading"
        @click="$emit('refresh')"
      />
    </div>
  </header>
</template>

<style scoped lang="scss">
.hero {
  align-items: center;
  background:
    radial-gradient(circle at 12% 0%, rgba(var(--v-theme-primary), 0.2), transparent 55%),
    linear-gradient(135deg, rgba(var(--v-theme-primary), 0.1), rgba(var(--v-theme-primary), 0.02) 70%),
    rgb(var(--v-theme-surface));
  border: 1px solid rgba(var(--v-theme-primary), 0.22);
  border-radius: 20px;
  display: flex;
  flex-wrap: wrap;
  gap: 1.25rem 2rem;
  justify-content: space-between;
  overflow: hidden;
  padding: 1.5rem 1.75rem;
  position: relative;

  /* Trame de points en filigrane, estompée vers la gauche : l'allure « cockpit » sans surcharge. */
  &::before {
    background-image: radial-gradient(rgba(var(--v-theme-on-surface), 0.12) 1px, transparent 1px);
    background-size: 16px 16px;
    content: '';
    inset: 0;
    -webkit-mask-image: linear-gradient(90deg, transparent 30%, #000 100%);
    mask-image: linear-gradient(90deg, transparent 30%, #000 100%);
    opacity: 0.55;
    pointer-events: none;
    position: absolute;
  }

  > * {
    position: relative;
  }
}

.hero__eyebrow {
  align-items: center;
  color: rgb(var(--v-theme-primary));
  display: flex;
  flex-wrap: wrap;
  font-size: 0.75rem;
  font-weight: 600;
  gap: 0.5rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.hero__sync {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-weight: 500;
  letter-spacing: 0.02em;
  text-transform: none;
}

.hero__title {
  font-size: clamp(1.5rem, 1.2rem + 1.2vw, 2.1rem);
  font-weight: 700;
  line-height: 1.2;
  margin-block: 0.35rem 0.2rem;
}

.hero__subtitle {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  margin: 0;
}

.hero__actions {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.live-dot {
  animation: live-pulse 2s ease-out infinite;
  background: rgb(var(--v-theme-success));
  border-radius: 50%;
  height: 9px;
  width: 9px;
}

@keyframes live-pulse {
  0% { box-shadow: 0 0 0 0 rgba(var(--v-theme-success), 0.55); }
  70% { box-shadow: 0 0 0 9px rgba(var(--v-theme-success), 0); }
  100% { box-shadow: 0 0 0 0 rgba(var(--v-theme-success), 0); }
}

@media (prefers-reduced-motion: reduce) {
  .live-dot {
    animation: none;
  }
}

@media (max-width: 599px) {
  .hero {
    padding: 1.15rem 1.1rem;
  }

  /* Sur téléphone : l'action principale pleine largeur, les deux autres côte à côte. */
  .hero__actions {
    width: 100%;

    > .v-btn:first-child {
      flex: 1 1 100%;
    }

    > .v-btn:nth-child(2),
    > .v-btn:nth-child(3) {
      flex: 1 1 0;
      min-width: 0;
    }
  }
}
</style>
