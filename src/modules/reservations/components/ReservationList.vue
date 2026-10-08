<!-- Les réservations en liste, regroupées par jour : vue « Liste » et agenda de la semaine sur mobile. -->
<script setup lang="ts">
import { dayKey, formatFullDate } from '../calendar'
import type { Booking } from '../composables/useReservationRange'
import { coversLabel, presentStatus } from '../labels'
import ReservationStatusChip from './ReservationStatusChip.vue'

const props = defineProps<{
  bookings: Booking[]
  tableLabelOf: (id: string | null | undefined) => string
}>()

const emit = defineEmits<{ select: [booking: Booking] }>()

const TONE_COLOR = { success: 'success', error: 'error', warning: 'warning', info: 'info', neutral: 'secondary' } as const

const timeFormat = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' })

const groups = computed(() => {
  const map = new Map<string, { day: Date; items: Booking[] }>()

  for (const booking of [...props.bookings].sort((a, b) => a.start.getTime() - b.start.getTime())) {
    const key = dayKey(booking.start)
    const group = map.get(key) ?? { day: booking.start, items: [] }

    group.items.push(booking)
    map.set(key, group)
  }

  return [...map.entries()].map(([key, group]) => ({ key, ...group }))
})
</script>

<template>
  <VTable
    hover
    class="reservation-list"
  >
    <thead>
      <tr>
        <th>Réservation</th>
        <th class="d-none d-sm-table-cell">
          Couverts
        </th>
        <th class="d-none d-md-table-cell">
          Table
        </th>
        <th>Statut</th>
      </tr>
    </thead>
    <tbody
      v-for="group in groups"
      :key="group.key"
    >
      <tr class="day-row">
        <td colspan="4">
          {{ formatFullDate(group.day) }}
          <span class="text-medium-emphasis ms-2">{{ group.items.length }} réservation{{ group.items.length > 1 ? 's' : '' }}</span>
        </td>
      </tr>
      <tr
        v-for="booking in group.items"
        :key="booking.reservation.id"
        class="cursor-pointer"
        tabindex="0"
        @click="emit('select', booking)"
        @keydown.enter="emit('select', booking)"
      >
        <td class="fill-cell">
          <div class="d-flex align-center gap-3 py-2">
            <VAvatar
              :color="TONE_COLOR[presentStatus(booking.reservation.status).tone]"
              variant="tonal"
              rounded
              size="38"
            >
              <span class="text-body-2 font-weight-semibold">{{ timeFormat.format(booking.start) }}</span>
            </VAvatar>
            <div class="min-w-0">
              <div class="text-body-1 font-weight-medium text-high-emphasis text-truncate">
                {{ booking.reservation.customer_name }}
              </div>
              <div class="text-body-2 text-medium-emphasis text-truncate">
                {{ coversLabel(booking.reservation.party_size) }}
                <span class="d-md-none"> · {{ tableLabelOf(booking.reservation.table_id) }}</span>
              </div>
            </div>
          </div>
        </td>
        <td class="d-none d-sm-table-cell">
          {{ booking.reservation.party_size }}
        </td>
        <td class="d-none d-md-table-cell">
          {{ tableLabelOf(booking.reservation.table_id) }}
        </td>
        <td>
          <ReservationStatusChip :status="booking.reservation.status" />
        </td>
      </tr>
    </tbody>
  </VTable>
</template>

<style scoped>
.fill-cell {
  inline-size: 100%;
  max-inline-size: 0;
}

.day-row td {
  background: rgba(var(--v-theme-on-surface), 0.04);
  font-size: 0.8125rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.reservation-list tbody + tbody {
  border-block-start: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
</style>
