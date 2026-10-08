<!-- Tableau de bord : les réservations d'aujourd'hui, les prochaines en premier. -->
<script setup lang="ts">
import { reservationsApi } from '../api'
import { addDays, formatTime, startOfDay } from '@/lib/format'
import { coversLabel, isDead, presentStatus } from '../labels'
import type { Reservation } from '../types'
import ReservationStatusChip from '../components/ReservationStatusChip.vue'
import { useLive } from '@/composables/useLive'
import { useTenantStore } from '@/stores/tenant.store'

const tenant = useTenantStore()
const items = ref<Reservation[] | null>(null)
const error = ref<unknown>(null)

const TONE_COLOR = { success: 'success', error: 'error', warning: 'warning', info: 'info', neutral: 'secondary' } as const

async function load() {
  if (!tenant.currentId)
    return

  try {
    const from = startOfDay()

    items.value = await reservationsApi.list(tenant.currentId, { from, to: new Date(addDays(from, 1).getTime() - 1) })
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
  .sort((a, b) => a.reservation_date.localeCompare(b.reservation_date)))

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
            <span class="text-body-2 font-weight-semibold">{{ formatTime(item.reservation_date) }}</span>
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
