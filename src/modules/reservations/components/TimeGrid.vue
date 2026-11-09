<!--
  Grille horaire d'une journée (heure du restaurant). Chaque réservation est un bloc coloré par
  état, placé à son heure ; les blocs qui se chevauchent se partagent la largeur. Un clic sur une
  zone libre propose une réservation à cette demi-heure. Le trait rouge marque l'heure actuelle.
-->
<script setup lang="ts">
import type { Booking } from '../composables/useReservationRange'
import { HOUR_PX, dayKey, formatClock, fromInputs, layoutDay, minutesOfDay, sameDay, toDateInput } from '../calendar'
import { presentStatus } from '../labels'

const props = defineProps<{
  day: Date
  bookings: Booking[]
  zone: string
  now: Date
  tableLabelOf: (id: string | null | undefined) => string
}>()

const emit = defineEmits<{
  open: [booking: Booking]
  create: [instant: Date]
}>()

const DEFAULT_FIRST = 11 * 60
const DEFAULT_LAST = 23 * 60

const dayBookings = computed(() => props.bookings.filter(({ start }) => dayKey(start, props.zone) === dayKey(props.day, props.zone)))

/** Plage horaire affichée : de 11 h à 23 h, élargie aux réservations qui sortent de cette plage. */
const range = computed(() => {
  let first = DEFAULT_FIRST
  let last = DEFAULT_LAST

  for (const { reservation, start } of dayBookings.value) {
    const from = minutesOfDay(start, props.zone)
    const to = from + reservation.duration_minutes

    first = Math.min(first, Math.floor(from / 60) * 60)
    last = Math.max(last, Math.min(1440, Math.ceil(to / 60) * 60))
  }

  return { first: Math.max(0, first), last: Math.min(1440, last) }
})

const hours = computed(() => {
  const count = (range.value.last - range.value.first) / 60

  return Array.from({ length: count }, (_, index) => range.value.first + index * 60)
})

const height = computed(() => ((range.value.last - range.value.first) / 60) * HOUR_PX)

const placed = computed(() => layoutDay(dayBookings.value.map(booking => {
  const start = minutesOfDay(booking.start, props.zone) - range.value.first
  const end = Math.min(range.value.last - range.value.first, start + booking.reservation.duration_minutes)

  return { item: booking, start, end: Math.max(end, start + 30) }
})))

const isToday = computed(() => sameDay(props.now, props.day, props.zone))

const nowTop = computed(() => {
  if (!isToday.value)
    return null

  const minutes = minutesOfDay(props.now, props.zone) - range.value.first

  return minutes < 0 || minutes > range.value.last - range.value.first ? null : (minutes / 60) * HOUR_PX
})

const hourLabel = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:00`

function blockStyle(start: number, end: number, lane: number, lanes: number) {
  const width = 100 / lanes

  return {
    top: `${(start / 60) * HOUR_PX}px`,
    height: `${Math.max(30, ((end - start) / 60) * HOUR_PX - 3)}px`,
    left: `calc(${lane * width}% + 2px)`,
    width: `calc(${width}% - 4px)`,
  }
}

function describe(booking: Booking): string {
  const { reservation, start } = booking
  const table = reservation.table_id ? props.tableLabelOf(reservation.table_id) : 'sans table'

  return `${reservation.customer_name}, ${formatClock(start, props.zone)}, ${reservation.party_size} couvert${reservation.party_size > 1 ? 's' : ''}, ${table}, ${presentStatus(reservation.status).label}`
}

/** Clic sur une zone libre : proposition à la demi-heure cliquée. */
function onGridClick(event: MouseEvent) {
  const target = event.currentTarget as HTMLElement

  if ((event.target as HTMLElement).closest('.time-grid__block'))
    return

  const rect = target.getBoundingClientRect()
  const minutes = range.value.first + Math.floor(((event.clientY - rect.top) / HOUR_PX) * 60 / 30) * 30
  const date = toDateInput(props.day, props.zone)
  const time = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

  emit('create', fromInputs(date, time, props.zone))
}
</script>

<template>
  <div
    class="time-grid"
    role="group"
    aria-label="Grille horaire de la journée"
  >
    <div class="time-grid__scroll">
      <div
        class="time-grid__body"
        :style="{ height: `${height}px` }"
      >
        <div class="time-grid__hours">
          <div
            v-for="minutes in hours"
            :key="minutes"
            class="time-grid__hour"
            :style="{ height: `${HOUR_PX}px` }"
          >
            {{ hourLabel(minutes) }}
          </div>
        </div>

        <div
          class="time-grid__column"
          :style="{ height: `${height}px` }"
          @click="onGridClick"
        >
          <div
            v-for="minutes in hours"
            :key="`line-${minutes}`"
            class="time-grid__line"
            :style="{ top: `${((minutes - range.first) / 60) * HOUR_PX}px` }"
          />

          <button
            v-for="entry in placed"
            :key="entry.item.reservation.id"
            type="button"
            class="time-grid__block"
            :class="[`time-grid__block--${entry.item.reservation.status}`, { 'time-grid__block--closed': presentStatus(entry.item.reservation.status).closed }]"
            :style="blockStyle(entry.start, entry.end, entry.lane, entry.lanes)"
            :aria-label="describe(entry.item)"
            @click.stop="emit('open', entry.item)"
          >
            <span class="time-grid__time">
              {{ formatClock(entry.item.start, zone) }}
            </span>
            <span class="time-grid__name">{{ entry.item.reservation.customer_name }}</span>
            <span class="time-grid__meta">
              {{ entry.item.reservation.party_size }} · {{ entry.item.reservation.table_id ? tableLabelOf(entry.item.reservation.table_id) : 'sans table' }}
            </span>
            <span class="time-grid__status">{{ presentStatus(entry.item.reservation.status).label }}</span>
          </button>

          <div
            v-if="nowTop !== null"
            class="time-grid__now"
            :style="{ top: `${nowTop}px` }"
            aria-hidden="true"
          />
        </div>
      </div>
    </div>
    <p
      v-if="!dayBookings.length"
      class="time-grid__empty text-body-2 text-medium-emphasis"
    >
      Aucune réservation ce jour-là. Cliquez sur une heure pour en créer une.
    </p>
  </div>
</template>

<style scoped>
.time-grid__scroll {
  overflow-x: hidden;
}

.time-grid__body {
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr);
  position: relative;
}

.time-grid__hours {
  position: relative;
  font-size: 0.75rem;
  color: rgb(var(--v-theme-on-surface) / 0.6);
  font-variant-numeric: tabular-nums;
}

.time-grid__hour {
  transform: translateY(-8px);
  padding-right: 8px;
  text-align: right;
}

.time-grid__column {
  position: relative;
  border-left: 1px solid rgb(var(--v-theme-outline, 128 128 128) / 0.25);
  cursor: cell;
}

.time-grid__line {
  position: absolute;
  left: 0;
  right: 0;
  border-top: 1px solid rgb(var(--v-theme-outline, 128 128 128) / 0.18);
  pointer-events: none;
}

.time-grid__block {
  position: absolute;
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  padding: 4px 8px;
  overflow: hidden;
  border: 1px solid transparent;
  border-left-width: 4px;
  border-radius: 10px;
  background: rgb(var(--v-theme-surface-variant, 240 240 240) / 0.6);
  color: rgb(var(--v-theme-on-surface));
  font-size: 0.8125rem;
  line-height: 1.25;
  text-align: left;
  cursor: pointer;
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.06);
}

.time-grid__block:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}

.time-grid__block--pending { border-left-color: rgb(var(--v-theme-warning)); background: rgb(var(--v-theme-warning) / 0.14); }
.time-grid__block--confirmed { border-left-color: rgb(var(--v-theme-success)); background: rgb(var(--v-theme-success) / 0.14); }
.time-grid__block--checked_in { border-left-color: rgb(var(--v-theme-info)); background: rgb(var(--v-theme-info) / 0.16); }
.time-grid__block--no_show { border-left-color: rgb(var(--v-theme-error)); background: rgb(var(--v-theme-error) / 0.12); }
.time-grid__block--completed,
.time-grid__block--cancelled { border-left-color: rgb(var(--v-theme-outline, 128 128 128)); opacity: 0.75; }

.time-grid__block--closed .time-grid__name {
  text-decoration: line-through;
  text-decoration-thickness: 1px;
}

.time-grid__time,
.time-grid__meta,
.time-grid__status {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-variant-numeric: tabular-nums;
}

.time-grid__time {
  font-weight: 600;
}

.time-grid__name {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-weight: 600;
}

.time-grid__meta,
.time-grid__status {
  font-size: 0.75rem;
  color: rgb(var(--v-theme-on-surface) / 0.75);
}

.time-grid__now {
  position: absolute;
  left: 0;
  right: 0;
  height: 2px;
  background: rgb(var(--v-theme-error));
  pointer-events: none;
}

.time-grid__empty {
  margin-top: 12px;
}
</style>
