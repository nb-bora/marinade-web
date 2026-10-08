<script setup lang="ts">
import { useRestaurantUpdate } from '../composables/useRestaurantUpdate'
import { DAYS, DEFAULT_RANGE, dayError, parseWeek, serializeWeek, summarizeDay } from '../hours'
import type { DayKey, WeekSchedule } from '../hours'
import type { Restaurant } from '../types'

const props = defineProps<{
  restaurant: Restaurant
  canEdit: boolean
}>()

const emit = defineEmits<{ saved: [restaurant: Restaurant] }>()

const week = ref<WeekSchedule>(parseWeek(props.restaurant.horaires_ouverture))

watch(() => props.restaurant, restaurant => {
  week.value = parseWeek(restaurant.horaires_ouverture)
})

const serialized = (value: WeekSchedule) => JSON.stringify(serializeWeek(value, props.restaurant.horaires_ouverture))

const dirty = computed(() => serialized(week.value) !== serialized(parseWeek(props.restaurant.horaires_ouverture)))
const errors = computed(() => Object.fromEntries(DAYS.map(({ key }) => [key, dayError(week.value[key])])) as Record<DayKey, string>)
const hasErrors = computed(() => Object.values(errors.value).some(Boolean))
const openDays = computed(() => DAYS.filter(({ key }) => week.value[key].actif).length)

const { save, pending, errorMessage, reset } = useRestaurantUpdate(
  () => props.restaurant.id,
  restaurant => emit('saved', restaurant),
)

function addRange(key: DayKey) {
  const ranges = week.value[key].plages
  const last = ranges[ranges.length - 1]

  // Une nouvelle plage démarre là où la précédente s'arrête (service du soir après celui du midi).
  ranges.push(last && last.fermeture > last.ouverture && last.fermeture < '22:00'
    ? { ouverture: last.fermeture, fermeture: '23:00' }
    : { ...DEFAULT_RANGE })
}

function removeRange(key: DayKey, index: number) {
  const day = week.value[key]

  day.plages.splice(index, 1)

  if (day.plages.length === 0)
    day.actif = false
}

function toggleDay(key: DayKey, open: boolean | null) {
  const day = week.value[key]

  day.actif = open === true

  if (day.actif && day.plages.length === 0)
    day.plages.push({ ...DEFAULT_RANGE })
}

/** Reprend les horaires du lundi pour toute la semaine. */
function copyMonday() {
  const monday = week.value.lundi

  for (const { key } of DAYS) {
    if (key !== 'lundi')
      week.value[key] = { actif: monday.actif, plages: monday.plages.map(range => ({ ...range })) }
  }
}

const copyDisabled = computed(() => !week.value.lundi.actif || Boolean(errors.value.lundi))

function submit() {
  if (hasErrors.value)
    return

  return save(
    { horaires_ouverture: serializeWeek(week.value, props.restaurant.horaires_ouverture) },
    'Horaires d\'ouverture enregistrés.',
  )
}

function cancel() {
  week.value = parseWeek(props.restaurant.horaires_ouverture)
  reset()
}
</script>

<template>
  <VCard>
    <VCardItem>
      <VCardTitle>Horaires d'ouverture</VCardTitle>
      <VCardSubtitle class="text-wrap">
        {{ openDays === 0 ? 'Aucun jour d\'ouverture défini.' : `Ouvert ${openDays} jour${openDays > 1 ? 's' : ''} sur 7.` }}
        Ajoutez deux plages pour un service du midi et un service du soir.
      </VCardSubtitle>
    </VCardItem>

    <div
      v-if="canEdit"
      class="px-6 pb-4"
    >
      <VBtn
        variant="tonal"
        size="small"
        prepend-icon="ri-file-copy-line"
        :disabled="copyDisabled"
        @click="copyMonday"
      >
        Copier le lundi partout
      </VBtn>
    </div>

    <VDivider />

    <VCardText class="pa-0">
      <div
        v-for="{ key, label } in DAYS"
        :key="key"
        class="day-row px-6 py-4"
      >
        <div class="day-row__head d-flex align-center justify-space-between">
          <div>
            <div class="text-subtitle-1 font-weight-medium">
              {{ label }}
            </div>
            <div
              v-if="week[key].actif"
              class="text-body-2 text-medium-emphasis"
            >
              {{ summarizeDay(week[key]) }}
            </div>
          </div>
          <VSwitch
            :model-value="week[key].actif"
            color="primary"
            hide-details
            density="compact"
            :label="week[key].actif ? 'Ouvert' : 'Fermé'"
            :aria-label="`${label} : ouvert`"
            :readonly="!canEdit"
            @update:model-value="toggleDay(key, $event)"
          />
        </div>

        <div
          v-if="week[key].actif"
          class="day-row__ranges"
        >
          <div
            v-for="(range, index) in week[key].plages"
            :key="index"
            class="d-flex align-center gap-2 mb-2"
          >
            <VTextField
              v-model="range.ouverture"
              type="time"
              label="De"
              density="compact"
              hide-details
              :readonly="!canEdit"
              :error="Boolean(errors[key])"
            />
            <VTextField
              v-model="range.fermeture"
              type="time"
              label="À"
              density="compact"
              hide-details
              :readonly="!canEdit"
              :error="Boolean(errors[key])"
            />
            <IconBtn
              v-if="canEdit"
              :aria-label="`Supprimer la plage ${index + 1} du ${label.toLowerCase()}`"
              @click="removeRange(key, index)"
            >
              <VIcon icon="ri-delete-bin-line" />
            </IconBtn>
          </div>

          <div
            v-if="errors[key]"
            class="text-caption text-error mb-2"
            role="alert"
          >
            {{ errors[key] }}
          </div>

          <VBtn
            v-if="canEdit && week[key].plages.length < 3"
            variant="text"
            size="small"
            prepend-icon="ri-add-line"
            @click="addRange(key)"
          >
            Ajouter une plage
          </VBtn>
        </div>
      </div>
    </VCardText>

    <VAlert
      v-if="errorMessage"
      type="error"
      variant="tonal"
      class="mx-6 mb-4"
    >
      {{ errorMessage }}
    </VAlert>

    <template v-if="canEdit">
      <VDivider />
      <VCardActions class="px-6 py-4 justify-end flex-wrap gap-2">
        <VBtn
          variant="outlined"
          color="secondary"
          :disabled="!dirty || pending"
          @click="cancel"
        >
          Annuler les modifications
        </VBtn>
        <VBtn
          variant="flat"
          :loading="pending"
          :disabled="!dirty || hasErrors"
          @click="submit"
        >
          Enregistrer
        </VBtn>
      </VCardActions>
    </template>
  </VCard>
</template>

<style scoped>
.day-row + .day-row {
  border-block-start: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.day-row__ranges {
  margin-block-start: 0.75rem;
  max-inline-size: 420px;
}

@media (min-width: 960px) {
  .day-row {
    display: grid;
    grid-template-columns: minmax(220px, 280px) 1fr;
    gap: 1.5rem;
    align-items: start;
  }

  .day-row__ranges {
    margin-block-start: 0;
  }
}
</style>
