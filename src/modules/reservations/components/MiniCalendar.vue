<!--
  Mini-calendrier mensuel : un clic choisit le jour, les flèches changent de mois. Chaque jour
  porte le nombre de réservations actives ; le jour affiché est souligné, aujourd'hui marqué.
-->
<script setup lang="ts">
import { addMonthsIn, dayKey, formatFullDate, formatMonthYear, monthGridIn, sameDay, zonedParts } from '../calendar'

const props = defineProps<{
  month: Date
  selected: Date
  zone: string
  now: Date
  counts: Map<string, number>
}>()

const emit = defineEmits<{
  select: [day: Date]
  'update:month': [month: Date]
}>()

const WEEK_HEADERS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

const cells = computed(() => monthGridIn(props.month, props.zone))
const currentMonth = computed(() => zonedParts(props.month, props.zone).month)
const title = computed(() => formatMonthYear(props.month, props.zone))

function countOf(day: Date): number {
  return props.counts.get(dayKey(day, props.zone)) ?? 0
}

function labelOf(day: Date): string {
  const count = countOf(day)
  const suffix = count ? `, ${count} réservation${count > 1 ? 's' : ''}` : ''

  return `${formatFullDate(day, props.zone)}${suffix}`
}
</script>

<template>
  <div class="mini">
    <div class="mini__head">
      <VBtn
        icon="ri-arrow-left-s-line"
        variant="text"
        size="small"
        aria-label="Mois précédent"
        @click="emit('update:month', addMonthsIn(month, -1, zone))"
      />
      <div
        class="mini__title"
        aria-live="polite"
      >
        {{ title }}
      </div>
      <VBtn
        icon="ri-arrow-right-s-line"
        variant="text"
        size="small"
        aria-label="Mois suivant"
        @click="emit('update:month', addMonthsIn(month, 1, zone))"
      />
    </div>

    <div
      class="mini__grid"
      role="grid"
      :aria-label="`Calendrier : ${title}`"
    >
      <div
        v-for="header in WEEK_HEADERS"
        :key="header"
        class="mini__weekday"
        role="columnheader"
        aria-hidden="true"
      >
        {{ header }}
      </div>
      <button
        v-for="day in cells"
        :key="dayKey(day, zone)"
        type="button"
        class="mini__day"
        :class="{
          'mini__day--outside': zonedParts(day, zone).month !== currentMonth,
          'mini__day--today': sameDay(day, now, zone),
          'mini__day--selected': sameDay(day, selected, zone),
          'mini__day--busy': countOf(day) > 0,
        }"
        :aria-label="labelOf(day)"
        :aria-pressed="sameDay(day, selected, zone)"
        @click="emit('select', day)"
      >
        <span class="mini__number">{{ zonedParts(day, zone).day }}</span>
        <span
          v-if="countOf(day) > 0"
          class="mini__count"
        >{{ countOf(day) }}</span>
      </button>
    </div>

    <p class="mini__hint text-caption text-medium-emphasis">
      Jour affiché : {{ formatFullDate(selected, zone) }}
    </p>
  </div>
</template>

<style scoped>
.mini {
  padding: 12px;
  border: 1px solid rgb(var(--v-theme-outline, 128 128 128) / 0.25);
  border-radius: 16px;
  background: rgb(var(--v-theme-surface));
}

.mini__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
}

.mini__title {
  font-weight: 600;
  text-align: center;
}

.mini__grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 2px;
  margin-top: 8px;
}

.mini__weekday {
  padding: 4px 0;
  font-size: 0.6875rem;
  text-align: center;
  color: rgb(var(--v-theme-on-surface) / 0.6);
}

.mini__day {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: transparent;
  color: rgb(var(--v-theme-on-surface));
  font-variant-numeric: tabular-nums;
  cursor: pointer;
}

.mini__day:hover {
  background: rgb(var(--v-theme-on-surface) / 0.06);
}

.mini__day:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 1px;
}

.mini__day--outside {
  color: rgb(var(--v-theme-on-surface) / 0.35);
}

.mini__day--today .mini__number {
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.mini__day--selected {
  border-color: rgb(var(--v-theme-primary));
  background: rgb(var(--v-theme-primary) / 0.12);
}

.mini__count {
  position: absolute;
  bottom: 3px;
  min-width: 16px;
  padding: 0 4px;
  border-radius: 999px;
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
  font-size: 0.625rem;
  line-height: 16px;
}

.mini__hint {
  margin: 8px 0 0;
}
</style>
