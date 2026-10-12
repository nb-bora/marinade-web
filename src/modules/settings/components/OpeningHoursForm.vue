<script setup lang="ts">
import { useRestaurantUpdate } from '../composables/useRestaurantUpdate'
import { useSettingsDraft } from '../composables/useSettingsDraft'
import { DAYS, DEFAULT_RANGE, crossesMidnight, dayError, dayWarning, defaultWeek, parseWeek, serializeWeek, summarizeDay } from '../hours'
import type { DayKey } from '../hours'
import type { Restaurant } from '../types'
import SettingsActions from './SettingsActions.vue'
import { useConfirm } from '@/composables/useConfirm'

const props = defineProps<{
  restaurant: Restaurant
  canEdit: boolean
}>()

const emit = defineEmits<{ saved: [restaurant: Restaurant] }>()

const confirm = useConfirm()
const form = ref()

const draftOf = (restaurant: Restaurant) => parseWeek(restaurant.horaires_ouverture)

const { draft: week, dirty, changed, changedKeys, restored, discard } = useSettingsDraft(
  'hours',
  () => props.restaurant,
  draftOf,
  value => serializeWeek(value, props.restaurant.horaires_ouverture),
)

const { save, pending, errorMessage, reset } = useRestaurantUpdate(
  () => props.restaurant.id,
  restaurant => emit('saved', restaurant),
)

const SHORT: Record<DayKey, string> = {
  lundi: 'Lun',
  mardi: 'Mar',
  mercredi: 'Mer',
  jeudi: 'Jeu',
  vendredi: 'Ven',
  samedi: 'Sam',
  dimanche: 'Dim',
}

const labelOf = (key: DayKey) => DAYS.find(day => day.key === key)?.label ?? key

const errors = computed(() => Object.fromEntries(DAYS.map(({ key }) => [key, dayError(week.value[key])])) as Record<DayKey, string>)
const warnings = computed(() => Object.fromEntries(DAYS.map(({ key }) => [key, dayWarning(week.value[key])])) as Record<DayKey, string>)
const hasErrors = computed(() => Object.values(errors.value).some(Boolean))
const hasWarnings = computed(() => Object.values(warnings.value).some(Boolean))
const openDays = computed(() => DAYS.filter(({ key }) => week.value[key].actif).length)
const changes = computed(() => changedKeys.value.map(key => labelOf(key).toLowerCase()))

// Jours dont le détail (les plages) est déplié ; un jour en défaut s'ouvre tout seul.
const opened = ref<DayKey[]>([])

const isOpened = (key: DayKey) => opened.value.includes(key)

function toggleOpened(key: DayKey) {
  opened.value = isOpened(key) ? opened.value.filter(item => item !== key) : [...opened.value, key]
}

function reveal(key: DayKey) {
  if (!isOpened(key))
    opened.value = [...opened.value, key]
}

watch([errors, warnings], () => {
  for (const { key } of DAYS) {
    if (errors.value[key] || warnings.value[key])
      reveal(key)
  }
})

function addRange(key: DayKey) {
  const ranges = week.value[key].plages
  const last = ranges[ranges.length - 1]

  // Une nouvelle plage démarre là où la précédente s'arrête (service du soir après celui du midi).
  ranges.push(last && last.fermeture > last.ouverture && last.fermeture < '22:00'
    ? { ouverture: last.fermeture, fermeture: '23:00' }
    : { ...DEFAULT_RANGE })
}

async function removeRange(key: DayKey, index: number) {
  const day = week.value[key]
  const range = day.plages[index]

  const accepted = await confirm({
    title: 'Supprimer cette plage ?',
    text: `La plage ${range.ouverture} – ${range.fermeture} du ${labelOf(key).toLowerCase()} sera retirée${day.plages.length === 1 ? ' et ce jour passera en « Fermé »' : ''}. Rien n'est enregistré avant que vous cliquiez sur « Enregistrer ».`,
    confirmLabel: 'Supprimer la plage',
  })

  if (!accepted)
    return

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

const copyOf = (key: DayKey) => ({ actif: week.value[key].actif, plages: week.value[key].plages.map(range => ({ ...range })) })

/** Reprend les horaires du lundi pour un jour. */
function copyMondayTo(key: DayKey) {
  week.value[key] = copyOf('lundi')
}

/** Reprend les horaires du lundi pour toute la semaine. */
function copyMonday() {
  for (const { key } of DAYS) {
    if (key !== 'lundi')
      copyMondayTo(key)
  }
}

async function reset9to20() {
  const accepted = await confirm({
    title: 'Réinitialiser les horaires ?',
    text: 'Tous les jours seront ouverts de 09:00 à 12:00 et de 14:00 à 20:00. Vos saisies actuelles seront remplacées (rien n\'est enregistré avant « Enregistrer »).',
    confirmLabel: 'Réinitialiser',
  })

  if (accepted)
    week.value = defaultWeek()
}

const copyDisabled = computed(() => !week.value.lundi.actif || Boolean(errors.value.lundi))

/** Un changement est « significatif » quand des jours ouvrent ou ferment. */
function toggledDays() {
  const before = parseWeek(props.restaurant.horaires_ouverture)
  const opening = DAYS.filter(({ key }) => !before[key].actif && week.value[key].actif).map(({ label }) => label)
  const closing = DAYS.filter(({ key }) => before[key].actif && !week.value[key].actif).map(({ label }) => label)

  return { opening, closing }
}

async function submit() {
  if (!props.canEdit || !dirty.value || hasErrors.value)
    return

  const { opening, closing } = toggledDays()

  if (opening.length || closing.length) {
    const lines = [
      closing.length ? `Fermés : ${closing.join(', ')}.` : '',
      opening.length ? `Ouverts : ${opening.join(', ')}.` : '',
    ].filter(Boolean).join(' ')

    const accepted = await confirm({
      title: 'Modifier les jours d\'ouverture ?',
      text: `${lines} Ces horaires sont ceux que voient vos clients.`,
      confirmLabel: 'Enregistrer les horaires',
      danger: closing.length > 0,
    })

    if (!accepted)
      return
  }

  await save(
    { horaires_ouverture: serializeWeek(week.value, props.restaurant.horaires_ouverture) },
    'Horaires d\'ouverture enregistrés.',
  )
}

function cancel() {
  discard()
  reset()
}

defineExpose({
  dirty,
  pending,
  invalid: hasErrors,
  submit,
  cancel,
})
</script>

<template>
  <VForm
    ref="form"
    @submit.prevent="submit"
  >
    <VCard>
      <VCardItem>
        <template #prepend>
          <VAvatar
            variant="tonal"
            rounded
            color="primary"
          >
            <VIcon icon="ri-time-line" />
          </VAvatar>
        </template>
        <VCardTitle>Horaires d'ouverture</VCardTitle>
        <VCardSubtitle class="text-wrap">
          {{ openDays === 0 ? 'Aucun jour d\'ouverture défini.' : `Ouvert ${openDays} jour${openDays > 1 ? 's' : ''} sur 7.` }}
          Ajoutez deux plages pour un service du midi et un service du soir.
        </VCardSubtitle>
      </VCardItem>

      <div
        v-if="canEdit"
        class="d-flex flex-wrap gap-2 px-6 pb-4"
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
        <VBtn
          variant="tonal"
          size="small"
          color="secondary"
          prepend-icon="ri-restart-line"
          @click="reset9to20"
        >
          Réinitialiser (9 h – 12 h, 14 h – 20 h)
        </VBtn>
      </div>

      <VDivider />

      <div
        v-for="{ key, label } in DAYS"
        :key="key"
        class="day-row"
      >
        <div
          class="day-row__head d-flex align-center gap-3 px-4 px-sm-6 py-3"
          :class="{ 'settings-changed--static': changed(key) }"
        >
          <VAvatar
            size="40"
            rounded
            variant="tonal"
            :color="week[key].actif ? 'primary' : 'secondary'"
          >
            <span class="text-caption font-weight-bold">{{ SHORT[key] }}</span>
          </VAvatar>

          <button
            type="button"
            class="day-row__toggle min-w-0 flex-grow-1 text-start"
            :aria-expanded="isOpened(key)"
            :aria-label="`${isOpened(key) ? 'Replier' : 'Déplier'} le détail du ${label.toLowerCase()}`"
            @click="toggleOpened(key)"
          >
            <span class="text-subtitle-1 font-weight-medium d-block">{{ label }}</span>
            <span
              class="text-body-2 d-block"
              :class="week[key].actif ? 'text-medium-emphasis' : 'text-disabled'"
            >
              {{ summarizeDay(week[key]) }}
            </span>
          </button>

          <VIcon
            v-if="errors[key]"
            icon="ri-error-warning-line"
            color="error"
            :aria-label="errors[key]"
          />
          <VIcon
            v-else-if="warnings[key]"
            icon="ri-alert-line"
            color="warning"
            :aria-label="warnings[key]"
          />

          <VSwitch
            :model-value="week[key].actif"
            color="primary"
            hide-details
            density="compact"
            class="flex-grow-0"
            :aria-label="`${label} : ${week[key].actif ? 'ouvert' : 'fermé'}`"
            :readonly="!canEdit"
            @update:model-value="toggleDay(key, $event)"
          />
          <span class="text-body-2 d-none d-sm-inline day-row__state">{{ week[key].actif ? 'Ouvert' : 'Fermé' }}</span>

          <IconBtn
            :aria-label="`${isOpened(key) ? 'Replier' : 'Déplier'} le ${label.toLowerCase()}`"
            @click="toggleOpened(key)"
          >
            <VIcon :icon="isOpened(key) ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'" />
          </IconBtn>
        </div>

        <VExpandTransition>
          <div
            v-show="isOpened(key)"
            class="day-row__body px-4 px-sm-6 pb-4"
          >
            <template v-if="week[key].actif">
              <div
                v-for="(range, index) in week[key].plages"
                :key="index"
                class="d-flex align-start gap-2 mb-3"
              >
                <VTextField
                  v-model="range.ouverture"
                  type="time"
                  label="De"
                  prepend-inner-icon="ri-time-line"
                  density="compact"
                  hide-details
                  :readonly="!canEdit"
                  :error="Boolean(errors[key])"
                />
                <VTextField
                  v-model="range.fermeture"
                  type="time"
                  label="À"
                  prepend-inner-icon="ri-time-line"
                  density="compact"
                  :hint="crossesMidnight(range) ? 'Jusqu\'au lendemain' : undefined"
                  :persistent-hint="crossesMidnight(range)"
                  :hide-details="!crossesMidnight(range)"
                  :readonly="!canEdit"
                  :error="Boolean(errors[key])"
                />
                <IconBtn
                  v-if="canEdit"
                  :aria-label="`Supprimer la plage ${index + 1} du ${label.toLowerCase()}`"
                  @click="removeRange(key, index)"
                >
                  <VIcon icon="ri-close-line" />
                </IconBtn>
              </div>

              <div
                v-if="errors[key]"
                class="text-body-2 text-error mb-3"
                role="alert"
              >
                {{ errors[key] }}
              </div>
              <VAlert
                v-else-if="warnings[key]"
                type="warning"
                variant="tonal"
                density="compact"
                class="mb-3"
              >
                {{ warnings[key] }}
              </VAlert>

              <VBtn
                v-if="canEdit && week[key].plages.length < 3"
                variant="text"
                size="small"
                prepend-icon="ri-add-line"
                @click="addRange(key)"
              >
                Ajouter une plage
              </VBtn>
            </template>
            <div
              v-else
              class="d-flex align-center flex-wrap gap-3"
            >
              <span class="text-body-2 text-medium-emphasis">Le restaurant est fermé ce jour-là.</span>
              <VBtn
                v-if="canEdit"
                variant="text"
                size="small"
                @click="toggleDay(key, true)"
              >
                Ouvrir ce jour
              </VBtn>
            </div>

            <VBtn
              v-if="canEdit && key !== 'lundi'"
              variant="text"
              size="small"
              color="secondary"
              prepend-icon="ri-file-copy-line"
              :disabled="copyDisabled"
              @click="copyMondayTo(key)"
            >
              Copier lundi
            </VBtn>
          </div>
        </VExpandTransition>
      </div>

      <VAlert
        v-if="hasWarnings && !hasErrors"
        type="warning"
        variant="tonal"
        density="compact"
        class="mx-6 mb-4"
      >
        Des plages se chevauchent. Vous pouvez enregistrer, mais vérifiez qu'il s'agit bien de ce que vous voulez.
      </VAlert>
    </VCard>

    <SettingsActions
      :can-edit="canEdit"
      :dirty="dirty"
      :pending="pending"
      :restored="restored"
      :error-message="errorMessage"
      :changes="changes"
      @cancel="cancel"
    />
  </VForm>
</template>

<style scoped>
.day-row + .day-row {
  border-block-start: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.day-row__toggle {
  min-block-size: 44px;
  cursor: pointer;
  background: none;
  border: 0;
  color: inherit;
}

.day-row__state {
  min-inline-size: 3.5rem;
}

.day-row__body {
  padding-inline-start: 4.5rem;
}

@media (max-width: 599px) {
  .day-row__body {
    padding-inline-start: 1rem;
  }
}
</style>
