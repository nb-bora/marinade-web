<!-- Petit calendrier mensuel : choisir un jour, repérer ceux qui ont des réservations. -->
<script setup lang="ts">
import { addMonths, dayKey, formatMonthYear, monthGrid, sameDay } from '../calendar'

const props = defineProps<{

  /** Nombre de réservations par jour (clé `AAAA-MM-JJ`). */
  counts: Map<string, number>
}>()

/** Jour sélectionné. */
const selected = defineModel<Date>({ required: true })

/** Mois affiché (premier jour du mois). */
const month = defineModel<Date>('month', { required: true })

const days = computed(() => monthGrid(month.value))
const today = new Date()
const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

function countOf(date: Date) {
  return props.counts.get(dayKey(date)) ?? 0
}

function label(date: Date) {
  const count = countOf(date)

  return `${date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}${count ? `, ${count} réservation${count > 1 ? 's' : ''}` : ''}`
}
</script>

<template>
  <div class="mini-cal">
    <div class="d-flex align-center justify-space-between mb-2">
      <IconBtn
        aria-label="Mois précédent"
        @click="month = addMonths(month, -1)"
      >
        <VIcon icon="ri-arrow-left-s-line" />
      </IconBtn>
      <span class="text-body-1 font-weight-semibold">{{ formatMonthYear(month) }}</span>
      <IconBtn
        aria-label="Mois suivant"
        @click="month = addMonths(month, 1)"
      >
        <VIcon icon="ri-arrow-right-s-line" />
      </IconBtn>
    </div>

    <div
      class="mini-cal__grid"
      role="grid"
      :aria-label="formatMonthYear(month)"
    >
      <span
        v-for="(weekday, index) in WEEKDAYS"
        :key="index"
        class="mini-cal__weekday text-caption text-medium-emphasis"
        aria-hidden="true"
      >{{ weekday }}</span>

      <button
        v-for="date in days"
        :key="dayKey(date)"
        type="button"
        class="mini-cal__day"
        :class="{
          'mini-cal__day--outside': date.getMonth() !== month.getMonth(),
          'mini-cal__day--today': sameDay(date, today),
          'mini-cal__day--selected': sameDay(date, selected),
        }"
        :aria-label="label(date)"
        :aria-pressed="sameDay(date, selected)"
        @click="selected = date"
      >
        {{ date.getDate() }}
        <span
          v-if="countOf(date)"
          class="mini-cal__dot"
        />
      </button>
    </div>
  </div>
</template>

<style scoped>
.mini-cal__grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}

.mini-cal__weekday {
  padding-block: 4px;
  text-align: center;
  font-weight: 600;
}

.mini-cal__day {
  position: relative;
  display: grid;
  aspect-ratio: 1;
  border-radius: 8px;
  color: rgb(var(--v-theme-on-surface));
  font-size: 0.8125rem;
  place-items: center;
  transition: background-color 0.12s ease;
}

.mini-cal__day:hover {
  background: rgba(var(--v-theme-on-surface), var(--v-hover-opacity));
}

.mini-cal__day:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 1px;
}

.mini-cal__day--outside {
  color: rgba(var(--v-theme-on-surface), var(--v-disabled-opacity));
}

.mini-cal__day--today {
  box-shadow: inset 0 0 0 1px rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-primary));
  font-weight: 600;
}

.mini-cal__day--selected,
.mini-cal__day--selected:hover {
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
  font-weight: 600;
}

.mini-cal__dot {
  position: absolute;
  inset-block-end: 4px;
  inline-size: 4px;
  block-size: 4px;
  border-radius: 50%;
  background: currentcolor;
  opacity: 0.7;
}
</style>
