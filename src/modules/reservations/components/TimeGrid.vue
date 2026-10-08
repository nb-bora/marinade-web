<!--
  Grille horaire d'un ou plusieurs jours : les réservations sont des blocs colorés par statut,
  placés à leur heure et à la hauteur de leur durée ; ceux qui se chevauchent se partagent la largeur.
-->
<script setup lang="ts">
import { HOUR_PX, dayKey, formatWeekday, formatWeekdayShort, layoutDay, minutesOfDay, sameDay } from '../calendar'
import { coversLabel, isDead, presentStatus } from '../labels'
import type { Booking } from '../composables/useReservationRange'

const props = defineProps<{
  days: Date[]
  bookings: Booking[]
  tableLabelOf: (id: string | null | undefined) => string

  /** Autorise le clic sur un créneau vide pour créer une réservation. */
  canCreate: boolean
}>()

const emit = defineEmits<{
  select: [booking: Booking]
  create: [date: Date]
  pickDay: [date: Date]
}>()

const compact = computed(() => props.days.length > 1)

const byDay = computed(() => {
  const groups = new Map<string, Booking[]>()

  for (const booking of props.bookings) {
    const key = dayKey(booking.start)

    groups.set(key, [...(groups.get(key) ?? []), booking])
  }

  return groups
})

// La plage horaire s'élargit si une réservation tombe en dehors des heures habituelles.
const startHour = computed(() => {
  const earliest = Math.min(...props.bookings.map(({ start }) => start.getHours()), 10)

  return Math.max(0, earliest)
})

const endHour = computed(() => {
  const latest = Math.max(...props.bookings.map(({ end, start }) => (sameDay(start, end) ? Math.ceil(minutesOfDay(end) / 60) : 24)), 23)

  return Math.min(24, latest + (latest < 24 ? 1 : 0))
})

const hours = computed(() => Array.from({ length: endHour.value - startHour.value }, (_, index) => startHour.value + index))
const bodyHeight = computed(() => hours.value.length * HOUR_PX)
const topOf = (minutes: number) => ((minutes - startHour.value * 60) / 60) * HOUR_PX

const columns = computed(() => props.days.map(day => {
  const items = (byDay.value.get(dayKey(day)) ?? []).map(booking => ({
    item: booking,
    start: minutesOfDay(booking.start),
    end: Math.min(endHour.value * 60, sameDay(booking.start, booking.end) ? minutesOfDay(booking.end) : 24 * 60),
  }))

  return {
    day,
    placed: layoutDay(items).map(entry => ({
      ...entry,
      style: {
        insetBlockStart: `${topOf(entry.start)}px`,
        blockSize: `${Math.max(((entry.end - entry.start) / 60) * HOUR_PX - 2, 26)}px`,
        insetInlineStart: `calc(${(entry.lane / entry.lanes) * 100}% + 2px)`,
        inlineSize: `calc(${100 / entry.lanes}% - 4px)`,
      },
      short: ((entry.end - entry.start) / 60) * HOUR_PX < 48,
    })),
  }
}))

const now = useNow({ interval: 60_000 })
const nowTop = computed(() => topOf(minutesOfDay(now.value)))
const nowVisible = computed(() => nowTop.value >= 0 && nowTop.value <= bodyHeight.value)

const timeFormat = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' })

/** Clic sur un créneau vide : l'heure visée, arrondie à la demi-heure. */
function onColumnClick(event: MouseEvent, day: Date) {
  if (!props.canCreate || event.target !== event.currentTarget)
    return

  const offset = (event as MouseEvent & { offsetY: number }).offsetY
  const minutes = Math.floor(((offset / HOUR_PX) * 60 + startHour.value * 60) / 30) * 30
  const date = new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(minutes / 60), minutes % 60)

  emit('create', date)
}

function describe(booking: Booking) {
  const { reservation } = booking

  return `${timeFormat.format(booking.start)}, ${reservation.customer_name}, ${coversLabel(reservation.party_size)}, ${presentStatus(reservation.status).label}`
}
</script>

<template>
  <div class="tg">
    <div class="tg__head">
      <div class="tg__gutter-head" />
      <button
        v-for="day in days"
        :key="dayKey(day)"
        type="button"
        class="tg__day-head"
        :class="{ 'tg__day-head--today': sameDay(day, now) }"
        :aria-label="`Afficher le ${formatWeekday(day)} ${day.getDate()}`"
        @click="emit('pickDay', day)"
      >
        <span class="text-caption">{{ compact ? formatWeekdayShort(day) : formatWeekday(day) }}</span>
        <span class="tg__day-number text-h6">{{ day.getDate() }}</span>
      </button>
    </div>

    <div
      class="tg__body"
      :style="{ blockSize: `${bodyHeight}px` }"
    >
      <div class="tg__gutter">
        <span
          v-for="hour in hours"
          :key="hour"
          class="tg__hour text-caption text-medium-emphasis"
          :style="{ insetBlockStart: `${(hour - startHour) * HOUR_PX}px` }"
        >{{ String(hour).padStart(2, '0') }}:00</span>
      </div>

      <div
        v-for="column in columns"
        :key="dayKey(column.day)"
        class="tg__col"
        :class="{ 'tg__col--create': canCreate }"
        :style="{ '--hour': `${HOUR_PX}px` }"
        @click="onColumnClick($event, column.day)"
      >
        <button
          v-for="entry in column.placed"
          :key="entry.item.reservation.id"
          type="button"
          class="tg__event"
          :class="[
            `tg__event--${presentStatus(entry.item.reservation.status).color}`,
            { 'tg__event--dead': isDead(entry.item.reservation.status), 'tg__event--short': entry.short },
          ]"
          :style="entry.style"
          :aria-label="describe(entry.item)"
          @click.stop="emit('select', entry.item)"
        >
          <span class="tg__event-title">
            <strong>{{ timeFormat.format(entry.item.start) }}</strong>
            {{ entry.item.reservation.customer_name }}
          </span>
          <span
            v-if="!entry.short"
            class="tg__event-meta"
          >
            {{ coversLabel(entry.item.reservation.party_size) }}<template v-if="!compact || column.placed.length < 3"> · {{ tableLabelOf(entry.item.reservation.table_id) }}</template>
          </span>
        </button>

        <div
          v-if="nowVisible && sameDay(column.day, now)"
          class="tg__now"
          :style="{ insetBlockStart: `${nowTop}px` }"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.tg {
  --gutter: 52px;

  min-inline-size: 0;
}

.tg__head,
.tg__body {
  display: grid;
  grid-template-columns: var(--gutter) repeat(v-bind('days.length'), minmax(0, 1fr));
}

.tg__head {
  border-block-end: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.tg__day-head {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-block: 8px;
  border-inline-start: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

.tg__day-head:hover {
  background: rgba(var(--v-theme-on-surface), var(--v-hover-opacity));
}

.tg__day-number {
  color: rgb(var(--v-theme-on-surface));
}

.tg__day-head--today .tg__day-number {
  display: grid;
  border-radius: 50%;
  background: rgb(var(--v-theme-primary));
  block-size: 2rem;
  color: rgb(var(--v-theme-on-primary));
  inline-size: 2rem;
  place-items: center;
}

.tg__body {
  position: relative;
}

.tg__gutter {
  position: relative;
}

.tg__hour {
  position: absolute;
  inset-inline-end: 8px;
  transform: translateY(-50%);
}

.tg__hour:first-child {
  transform: translateY(2px);
}

.tg__col {
  position: relative;
  border-inline-start: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  background-image: repeating-linear-gradient(
    to bottom,
    transparent 0,
    transparent calc(var(--hour) - 1px),
    rgba(var(--v-border-color), var(--v-border-opacity)) calc(var(--hour) - 1px),
    rgba(var(--v-border-color), var(--v-border-opacity)) var(--hour)
  );
}

.tg__col--create {
  cursor: copy;
}

.tg__event {
  --tone: var(--v-theme-primary);

  position: absolute;
  display: flex;
  overflow: hidden;
  flex-direction: column;
  padding: 4px 8px;
  border-inline-start: 3px solid rgb(var(--tone));
  border-radius: 6px;
  background: color-mix(in srgb, rgb(var(--tone)) 18%, rgb(var(--v-theme-surface)));
  color: rgb(var(--v-theme-on-surface));
  cursor: pointer;
  font-size: 0.8125rem;
  line-height: 1.25;
  text-align: start;
  transition: box-shadow 0.12s ease;
}

.tg__event:hover {
  box-shadow: 0 2px 8px rgba(var(--v-shadow-key-umbra-color), 0.3);
  z-index: 2;
}

.tg__event:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  z-index: 3;
}

.tg__event--warning { --tone: var(--v-theme-warning); }
.tg__event--info { --tone: var(--v-theme-info); }
.tg__event--success { --tone: var(--v-theme-success); }
.tg__event--error { --tone: var(--v-theme-error); }
.tg__event--secondary { --tone: var(--v-theme-secondary); }

.tg__event--dead {
  opacity: 0.6;
  text-decoration: line-through;
}

.tg__event--short {
  justify-content: center;
}

.tg__event-title,
.tg__event-meta {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tg__event-meta {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.75rem;
}

.tg__now {
  position: absolute;
  z-index: 1;
  background: rgb(var(--v-theme-error));
  block-size: 2px;
  inline-size: 100%;
  inset-inline: 0;
  pointer-events: none;
}

.tg__now::before {
  position: absolute;
  border-radius: 50%;
  background: inherit;
  block-size: 10px;
  content: '';
  inline-size: 10px;
  inset-block-start: -4px;
  inset-inline-start: -5px;
}
</style>
