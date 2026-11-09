<!-- Tableau de bord : les réservations d'aujourd'hui, les prochaines en premier. -->
<script setup lang="ts">
import { reservationsApi } from '../api'
import { addDaysIn, formatClock, startOfDayIn } from '../calendar'
import { useRestaurantZone } from '../composables/useRestaurantZone'
import { coversLabel, isDead, presentStatus } from '../labels'
import type { Reservation } from '../types'
import ReservationStatusChip from '../components/ReservationStatusChip.vue'
import { useLive } from '@/composables/useLive'
import { useTenantStore } from '@/stores/tenant.store'

const tenant = useTenantStore()
const { zone } = useRestaurantZone()
const items = ref<Reservation[] | null>(null)
const error = ref<unknown>(null)

const TONE_COLOR = { success: 'success', error: 'error', warning: 'warning', info: 'info', neutral: 'secondary' } as const

async function load() {
  if (!tenant.currentId)
    return

  try {
    // « Aujourd'hui » est le jour civil du restaurant, pas celui du poste.
    const from = startOfDayIn(new Date(), zone.value)

    items.value = await reservationsApi.list(tenant.currentId, { from, to: new Date(addDaysIn(from, 1, zone.value).getTime() - 1) })
    error.value = null
  }
  catch (cause) {
    if (items.value === null)
      error.value = cause
  }
}

useLive(load)

const today = computed(() => (items.value ?? [])
  .filter(item => !isDead(item.status))
  .sort((a, b) => new Date(a.reservation_date).getTime() - new Date(b.reservation_date).getTime()))

const covers = computed(() => today.value.reduce((sum, item) => sum + item.party_size, 0))
const visible = computed(() => today.value.slice(0, 5))
</script>

<template>
  <VCard class="h-100">
    <VCardItem>
      <VCardTitle>Réservations du jour</VCardTitle>
      <VCardSubtitle v-if="items">
        {{ today.length }} réservation{{ today.length > 1 ? 's' : '' }} · {{ coversLabel(covers) }}
      </VCardSubtitle>
      <template #append>
        <VBtn
          to="/reservations"
          variant="text"
          size="small"
          append-icon="ri-arrow-right-line"
        >
          Tout voir
        </VBtn>
      </template>
    </VCardItem>

    <VCardText>
      <AppErrorState
        v-if="error"
        :error="error"
        @retry="load"
      />

      <VSkeletonLoader
        v-else-if="!items"
        type="list-item-avatar-two-line@4"
      />

      <AppEmptyState
        v-else-if="today.length === 0"
        icon="ri-calendar-event-line"
        title="Aucune réservation aujourd'hui"
        text="Les tables réservées pour aujourd'hui apparaîtront ici."
      >
        <VBtn
          to="/reservations"
          variant="outlined"
        >
          Ouvrir le calendrier
        </VBtn>
      </AppEmptyState>

      <ul
        v-else
        class="today"
      >
        <li
          v-for="item in visible"
          :key="item.id"
          class="d-flex align-center gap-3"
        >
          <VAvatar
            :color="TONE_COLOR[presentStatus(item.status).tone]"
            variant="tonal"
            rounded
            size="40"
          >
            <span class="text-body-2 font-weight-semibold">{{ formatClock(new Date(item.reservation_date), zone) }}</span>
          </VAvatar>
          <div class="min-w-0">
            <div class="text-body-1 font-weight-medium text-truncate">
              {{ item.customer_name }}
            </div>
            <div class="text-body-2 text-medium-emphasis text-truncate">
              {{ coversLabel(item.party_size) }}
            </div>
          </div>
          <VSpacer />
          <ReservationStatusChip :status="item.status" />
        </li>
      </ul>
      <p
        v-if="today.length > visible.length"
        class="text-body-2 text-medium-emphasis mt-4 mb-0"
      >
        et {{ today.length - visible.length }} autre{{ today.length - visible.length > 1 ? 's' : '' }} aujourd'hui.
      </p>
    </VCardText>
  </VCard>
</template>

<style scoped>
.today {
  display: grid;
  gap: 1.125rem;
  padding: 0;
  list-style: none;
}
</style>
