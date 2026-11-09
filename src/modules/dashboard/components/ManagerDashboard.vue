<!--
  Tableau de bord du restaurant (propriétaire, manager) : tout vient d'une seule requête
  (GET /v1/ros/restaurants/{id}/dashboard) et l'écran se met à jour seul toutes les 30 secondes
  tant que l'onglet est visible.

  Lecture du haut vers le bas : le bandeau et les cinq chiffres du jour, ce qui se passe EN DIRECT
  (salle, production, points d'attention), la PERFORMANCE (courbe, paiements, semaine, classement)
  puis les OPÉRATIONS à suivre (réservations, stock, caisse).
-->
<script setup lang="ts">
import { dashboardApi } from '../api'
import AlertsCard from './AlertsCard.vue'
import CashCard from './CashCard.vue'
import DashboardHero from './DashboardHero.vue'
import HallCard from './HallCard.vue'
import KitchenCard from './KitchenCard.vue'
import KpiCards from './KpiCards.vue'
import PaymentMixCard from './PaymentMixCard.vue'
import ReservationsCard from './ReservationsCard.vue'
import RevenueCard from './RevenueCard.vue'
import StockCard from './StockCard.vue'
import TopProductsCard from './TopProductsCard.vue'
import WeekCard from './WeekCard.vue'
import { useAsyncData } from '@/composables/useAsyncData'
import { useLive } from '@/composables/useLive'
import { useSessionStore } from '@/stores/session.store'
import { useTenantStore } from '@/stores/tenant.store'

const LIVE_MS = 30_000

const session = useSessionStore()
const tenant = useTenantStore()

const board = useAsyncData(
  signal => tenant.currentId ? dashboardApi.restaurant(tenant.currentId, signal) : Promise.resolve(null),
  { watch: [() => tenant.currentId] },
)

useLive(() => board.refresh(), LIVE_MS)

const data = computed(() => board.data.value)

const today = computed(() => {
  const text = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: data.value?.fuseau }).format(new Date())

  return text.charAt(0).toUpperCase() + text.slice(1)
})

const greeting = computed(() => `${new Date().getHours() < 18 ? 'Bonjour' : 'Bonsoir'} ${session.user?.first_name ?? ''}`.trim())
</script>

<template>
  <div class="dash">
    <DashboardHero
      :data="data"
      :greeting="greeting"
      :restaurant="tenant.current?.name ?? 'Votre restaurant'"
      :today="today"
      :loading="board.loading.value"
      @refresh="board.reload()"
    />

    <AppErrorState
      v-if="board.error.value && !data"
      class="mt-6"
      :error="board.error.value"
      @retry="board.reload()"
    />

    <template v-else>
      <KpiCards
        class="mt-5"
        :data="data"
      />

      <section aria-labelledby="dash-live">
        <h2
          id="dash-live"
          class="dash-section"
        >
          <span class="dash-section__dot" />En direct
        </h2>
        <VRow>
          <VCol
            cols="12"
            md="6"
            lg="4"
          >
            <HallCard :data="data" />
          </VCol>
          <VCol
            cols="12"
            md="6"
            lg="4"
          >
            <KitchenCard :data="data" />
          </VCol>
          <VCol
            cols="12"
            lg="4"
          >
            <AlertsCard :data="data" />
          </VCol>
        </VRow>
      </section>

      <section aria-labelledby="dash-perf">
        <h2
          id="dash-perf"
          class="dash-section"
        >
          <span class="dash-section__dot" />Performance
        </h2>
        <VRow>
          <VCol
            cols="12"
            lg="8"
          >
            <RevenueCard :data="data" />
          </VCol>
          <VCol
            cols="12"
            lg="4"
          >
            <PaymentMixCard :data="data" />
          </VCol>
          <VCol
            cols="12"
            md="6"
          >
            <WeekCard :data="data" />
          </VCol>
          <VCol
            cols="12"
            md="6"
          >
            <TopProductsCard :data="data" />
          </VCol>
        </VRow>
      </section>

      <section aria-labelledby="dash-ops">
        <h2
          id="dash-ops"
          class="dash-section"
        >
          <span class="dash-section__dot" />Opérations
        </h2>
        <VRow>
          <VCol
            cols="12"
            md="6"
            lg="4"
          >
            <ReservationsCard :data="data" />
          </VCol>
          <VCol
            cols="12"
            md="6"
            lg="4"
          >
            <StockCard :data="data" />
          </VCol>
          <VCol
            cols="12"
            lg="4"
          >
            <CashCard :data="data" />
          </VCol>
        </VRow>
      </section>
    </template>
  </div>
</template>

<style scoped lang="scss">
.dash-section {
  align-items: center;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  display: flex;
  font-size: 0.78rem;
  font-weight: 700;
  gap: 0.6rem;
  letter-spacing: 0.12em;
  margin: 2rem 0 0.75rem;
  text-transform: uppercase;

  /* Filet qui prolonge le titre jusqu'au bord : structure la page sans la charger. */
  &::after {
    background: linear-gradient(90deg, rgba(var(--v-border-color), 0.2), transparent);
    content: '';
    flex: 1;
    height: 1px;
  }
}

.dash-section__dot {
  background: rgb(var(--v-theme-primary));
  border-radius: 2px;
  height: 14px;
  transform: skewX(-18deg);
  width: 5px;
}

/* Cartes : même grammaire partout — coins larges, filet fin plutôt qu'ombre lourde, halo discret au survol. */
.dash :deep(.v-card) {
  border: 1px solid rgba(var(--v-border-color), 0.14);
  border-radius: 16px;
  box-shadow: 0 1px 2px rgba(var(--v-theme-on-surface), 0.04) !important;
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}

.dash :deep(.v-card:not(.kpi):hover) {
  border-color: rgba(var(--v-theme-primary), 0.3);
}

.dash :deep(.v-card-item) {
  padding: 1.1rem 1.25rem 0.9rem;
}

.dash :deep(.v-card-title) {
  font-size: 1.02rem;
  font-weight: 650;
}

.dash :deep(.v-card-subtitle) {
  font-size: 0.82rem;
  opacity: 0.8;
}

.dash :deep(.v-card-text) {
  padding: 0.25rem 1.25rem 1.25rem;
}
</style>
