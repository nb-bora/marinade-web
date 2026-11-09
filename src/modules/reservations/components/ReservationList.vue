<!--
  Vue « Liste » : les réservations du mois, groupées par jour, en lignes lisibles sur téléphone comme
  sur ordinateur. Une ligne ouvre le détail ; les réservations closes sont estompées et barrées.
-->
<script setup lang="ts">
import type { Booking } from '../composables/useReservationRange'
import { dayKey, formatClock, formatFullDate } from '../calendar'
import { coversLabel, presentStatus } from '../labels'

const props = defineProps<{
  bookings: Booking[]
  zone: string
  tableLabelOf: (id: string | null | undefined) => string
}>()

const emit = defineEmits<{ open: [booking: Booking] }>()

interface Group {
  key: string
  day: Date
  items: Booking[]
}

const groups = computed<Group[]>(() => {
  const byDay = new Map<string, Group>()

  for (const booking of props.bookings) {
    const key = dayKey(booking.start, props.zone)
    const group = byDay.get(key) ?? { key, day: booking.start, items: [] }

    group.items.push(booking)
    byDay.set(key, group)
  }

  return [...byDay.values()]
})
</script>

<template>
  <div class="resa-list">
    <p
      v-if="!bookings.length"
      class="text-body-2 text-medium-emphasis pa-4"
    >
      Aucune réservation pour ce mois. Les réservations ajoutées apparaissent ici.
    </p>

    <section
      v-for="group in groups"
      :key="group.key"
      class="resa-list__group"
      :aria-label="formatFullDate(group.day, zone)"
    >
      <h3 class="resa-list__day text-subtitle-2">
        {{ formatFullDate(group.day, zone) }}
        <span class="text-medium-emphasis">· {{ group.items.length }}</span>
      </h3>

      <ul class="resa-list__items">
        <li
          v-for="booking in group.items"
          :key="booking.reservation.id"
        >
          <button
            type="button"
            class="resa-list__row"
            :class="{ 'resa-list__row--closed': presentStatus(booking.reservation.status).closed }"
            :aria-label="`${booking.reservation.customer_name}, ${formatClock(booking.start, zone)}, ${coversLabel(booking.reservation.party_size)}, ${presentStatus(booking.reservation.status).label}`"
            @click="emit('open', booking)"
          >
            <span class="resa-list__time">{{ formatClock(booking.start, zone) }}</span>
            <span class="resa-list__main">
              <span class="resa-list__name">{{ booking.reservation.customer_name }}</span>
              <span class="resa-list__meta">
                {{ coversLabel(booking.reservation.party_size) }}
                · {{ booking.reservation.table_id ? tableLabelOf(booking.reservation.table_id) : 'Sans table' }}
              </span>
            </span>
            <AppStatusChip
              :label="presentStatus(booking.reservation.status).label"
              :tone="presentStatus(booking.reservation.status).tone"
              :icon="presentStatus(booking.reservation.status).icon"
            />
          </button>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.resa-list__group + .resa-list__group {
  margin-top: 16px;
}

.resa-list__day {
  margin: 0 0 8px;
  padding: 0 4px;
  text-transform: none;
}

.resa-list__items {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;
}

.resa-list__row {
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 56px;
  padding: 10px 14px;
  border: 1px solid rgb(var(--v-theme-outline, 128 128 128) / 0.25);
  border-radius: 16px;
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
  text-align: left;
  cursor: pointer;
}

.resa-list__row:hover {
  border-color: rgb(var(--v-theme-primary));
}

.resa-list__row:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}

.resa-list__row--closed {
  opacity: 0.7;
}

.resa-list__time {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.resa-list__main {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.resa-list__name {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-weight: 600;
}

.resa-list__row--closed .resa-list__name {
  text-decoration: line-through;
  text-decoration-thickness: 1px;
}

.resa-list__meta {
  font-size: 0.8125rem;
  color: rgb(var(--v-theme-on-surface) / 0.7);
}

@media (max-width: 600px) {
  .resa-list__row {
    grid-template-columns: 48px minmax(0, 1fr);
  }

  .resa-list__row :deep(.v-chip) {
    grid-column: 2;
    justify-self: start;
  }
}
</style>
