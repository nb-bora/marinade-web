<script setup lang="ts">
import { useDisplay } from 'vuetify'
import {
  addMonths,
  dayKey,
  formatDayMonth,
  formatFullDate,
  formatMonthYear,
  monthGrid,
  startOfMonth,
  startOfWeek,
  weekDays,
} from '../calendar'
import MiniCalendar from '../components/MiniCalendar.vue'
import ReservationDetailDrawer from '../components/ReservationDetailDrawer.vue'
import ReservationFormDialog from '../components/ReservationFormDialog.vue'
import ReservationList from '../components/ReservationList.vue'
import TimeGrid from '../components/TimeGrid.vue'
import { useReservationRange } from '../composables/useReservationRange'
import { useTables } from '../composables/useTables'
import { RESERVATION_STATUSES, isDead, presentStatus } from '../labels'
import type { Reservation } from '../types'
import { useLive } from '@/composables/useLive'
import { addDays, startOfDay } from '@/lib/format'

type ViewId = 'day' | 'week' | 'list'

const VIEWS: { value: ViewId; title: string }[] = [
  { value: 'day', title: 'Jour' },
  { value: 'week', title: 'Semaine' },
  { value: 'list', title: 'Liste' },
]

const display = useDisplay()

const view = ref<ViewId>('day')
const anchor = ref(startOfDay())
const miniMonth = ref(startOfMonth(anchor.value))
const visibleStatuses = ref<string[]>([...RESERVATION_STATUSES])
const search = ref('')

watch(anchor, day => {
  miniMonth.value = startOfMonth(day)
})

// Plage de la vue active : le jour, la semaine (du lundi) ou le mois.
const viewRange = computed(() => {
  if (view.value === 'day')
    return { from: anchor.value, to: addDays(anchor.value, 1) }

  if (view.value === 'week') {
    const monday = startOfWeek(anchor.value)

    return { from: monday, to: addDays(monday, 7) }
  }

  const first = startOfMonth(anchor.value)

  return { from: first, to: addMonths(first, 1) }
})

// On charge aussi tout le mois du mini-calendrier pour y marquer les jours occupés.
const fetchRange = computed(() => {
  const grid = monthGrid(miniMonth.value)
  const from = Math.min(viewRange.value.from.getTime(), grid[0].getTime())
  const to = Math.max(viewRange.value.to.getTime(), addDays(grid[grid.length - 1], 1).getTime())

  return { from: new Date(from), to: new Date(to) }
})

const { bookings, loadedOnce, loading, error, reload, refresh } = useReservationRange(fetchRange)
const { tables, labelOf, refresh: refreshTables } = useTables()

const { isLive } = useLive(() => {
  refresh()
  refreshTables()
})

const inView = computed(() => bookings.value.filter(({ start }) =>
  start >= viewRange.value.from && start < viewRange.value.to))

const statusCounts = computed(() => {
  const counts = new Map<string, number>()

  inView.value.forEach(({ reservation }) => counts.set(reservation.status, (counts.get(reservation.status) ?? 0) + 1))

  return counts
})

const dayCounts = computed(() => {
  const counts = new Map<string, number>()

  bookings.value
    .filter(({ reservation }) => !isDead(reservation.status))
    .forEach(({ start }) => counts.set(dayKey(start), (counts.get(dayKey(start)) ?? 0) + 1))

  return counts
})

const shown = computed(() => {
  const term = search.value.trim().toLowerCase()

  return inView.value.filter(({ reservation }) =>
    visibleStatuses.value.includes(reservation.status)
    && (view.value !== 'list' || !term
      || reservation.customer_name.toLowerCase().includes(term)
      || (reservation.customer_phone ?? '').includes(term)))
})

const hasStatusFilter = computed(() => visibleStatuses.value.length < RESERVATION_STATUSES.length)

const title = computed(() => {
  if (view.value === 'day')
    return formatFullDate(anchor.value)

  if (view.value === 'list')
    return formatMonthYear(anchor.value)

  const days = weekDays(anchor.value)

  return `${formatDayMonth(days[0])} – ${formatDayMonth(days[6])} ${days[6].getFullYear()}`
})

function step(direction: -1 | 1) {
  if (view.value === 'day')
    anchor.value = addDays(anchor.value, direction)
  else if (view.value === 'week')
    anchor.value = addDays(anchor.value, direction * 7)
  else
    anchor.value = addMonths(anchor.value, direction)
}

const goToday = () => {
  anchor.value = startOfDay()
}

// Formulaire ---------------------------------------------------------------------------

const formOpen = ref(false)
const editing = ref<Reservation | null>(null)
const formDate = ref(new Date())

/** Heure proposée : le prochain créneau d'aujourd'hui, ou 19 h pour un autre jour. */
function suggested(day: Date): Date {
  const now = new Date()

  if (startOfDay(day).getTime() === startOfDay(now).getTime())
    return new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.min(now.getHours() + 1, 22), 0)

  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), 19, 0)
}

function openCreate(at?: Date) {
  editing.value = null
  formDate.value = at ?? suggested(anchor.value)
  formOpen.value = true
}

function openEdit(reservation: Reservation) {
  editing.value = reservation
  formOpen.value = true
}

// Détail --------------------------------------------------------------------------------

const selectedId = ref<string | null>(null)
const selected = computed(() => bookings.value.find(({ reservation }) => reservation.id === selectedId.value)?.reservation ?? null)

function onSaved(saved: Reservation) {
  anchor.value = startOfDay(new Date(saved.reservation_date))
  selectedId.value = saved.id
  refresh()
}

function pickDay(day: Date) {
  anchor.value = day
  view.value = 'day'
}

function resetFilters() {
  visibleStatuses.value = [...RESERVATION_STATUSES]
  search.value = ''
}
</script>

<template>
  <div>
    <AppPageHeader
      title="Réservations"
      subtitle="Le calendrier des tables réservées : confirmez, accueillez et suivez vos clients."
    >
      <template #actions>
        <VChip
          :color="isLive ? 'success' : 'secondary'"
          variant="tonal"
          size="small"
          label
        >
          <span
            class="live-dot me-2"
            :class="{ 'live-dot--on': isLive }"
          />
          {{ isLive ? 'En direct' : 'En pause' }}
        </VChip>
        <VBtn
          variant="tonal"
          color="secondary"
          prepend-icon="ri-time-line"
          to="/reservations/attente"
        >
          Liste d'attente
        </VBtn>
        <VBtn
          class="d-md-none"
          prepend-icon="ri-add-line"
          @click="openCreate()"
        >
          Nouvelle réservation
        </VBtn>
      </template>
    </AppPageHeader>

    <VRow>
      <VCol
        cols="12"
        md="4"
        lg="3"
        class="order-2 order-md-1"
      >
        <VCard>
          <VCardText>
            <VBtn
              block
              size="large"
              prepend-icon="ri-add-line"
              class="d-none d-md-flex mb-5"
              @click="openCreate()"
            >
              Nouvelle réservation
            </VBtn>

            <MiniCalendar
              v-model="anchor"
              v-model:month="miniMonth"
              :counts="dayCounts"
            />
          </VCardText>

          <VDivider />

          <VCardText>
            <div class="text-overline mb-1">
              Filtrer par statut
            </div>
            <VCheckbox
              v-for="status in RESERVATION_STATUSES"
              :key="status"
              v-model="visibleStatuses"
              :value="status"
              :color="presentStatus(status).color"
              density="compact"
              hide-details
            >
              <template #label>
                <span class="d-flex align-center justify-space-between w-100">
                  <span>{{ presentStatus(status).label }}</span>
                  <span class="text-medium-emphasis">{{ statusCounts.get(status) ?? 0 }}</span>
                </span>
              </template>
            </VCheckbox>
            <VBtn
              v-if="hasStatusFilter"
              variant="text"
              size="small"
              class="mt-2 ms-n2"
              prepend-icon="ri-filter-off-line"
              @click="resetFilters"
            >
              Tout afficher
            </VBtn>
          </VCardText>
        </VCard>
      </VCol>

      <VCol
        cols="12"
        md="8"
        lg="9"
        class="order-1 order-md-2"
      >
        <VCard>
          <VCardText class="d-flex flex-wrap align-center gap-3">
            <div class="d-flex align-center gap-1">
              <IconBtn
                aria-label="Période précédente"
                @click="step(-1)"
              >
                <VIcon icon="ri-arrow-left-s-line" />
              </IconBtn>
              <IconBtn
                aria-label="Période suivante"
                @click="step(1)"
              >
                <VIcon icon="ri-arrow-right-s-line" />
              </IconBtn>
            </div>
            <VBtn
              variant="outlined"
              color="secondary"
              @click="goToday"
            >
              Aujourd'hui
            </VBtn>
            <h2 class="text-h6 flex-grow-1 text-no-wrap">
              {{ title }}
            </h2>
            <AppSegmented
              v-model="view"
              :options="VIEWS"
              label="Affichage"
            />
          </VCardText>

          <VDivider />

          <div
            v-if="view === 'list'"
            class="px-5 py-4"
          >
            <VTextField
              v-model="search"
              label="Client ou téléphone"
              prepend-inner-icon="ri-search-line"
              clearable
              hide-details
              autocomplete="off"
            />
          </div>

          <AppErrorState
            v-if="error && !loadedOnce"
            class="ma-4"
            :error="error"
            @retry="reload"
          />

          <VSkeletonLoader
            v-else-if="!loadedOnce"
            type="table-thead, table-tbody"
          />

          <template v-else>
            <AppEmptyState
              v-if="view === 'list' && shown.length === 0"
              icon="ri-calendar-line"
              :title="inView.length ? 'Aucune réservation ne correspond' : 'Aucune réservation ce mois-ci'"
              :text="inView.length ? 'Essayez d\'autres statuts ou un autre nom.' : 'Enregistrez la première réservation du mois en un clic.'"
            >
              <VBtn
                v-if="inView.length"
                variant="outlined"
                @click="resetFilters"
              >
                Effacer les filtres
              </VBtn>
              <VBtn
                v-else
                prepend-icon="ri-add-line"
                @click="openCreate()"
              >
                Nouvelle réservation
              </VBtn>
            </AppEmptyState>

            <ReservationList
              v-else-if="view === 'list' || (view === 'week' && display.smAndDown.value)"
              :bookings="shown"
              :table-label-of="labelOf"
              @select="selectedId = $event.reservation.id"
            />

            <template v-else>
              <p
                v-if="shown.length === 0"
                class="text-body-2 text-medium-emphasis px-5 pt-4 mb-0"
              >
                {{ inView.length ? 'Aucune réservation avec ces statuts.' : 'Aucune réservation sur cette période. Cliquez sur un créneau pour en ajouter une.' }}
              </p>
              <TimeGrid
                :days="view === 'day' ? [anchor] : weekDays(anchor)"
                :bookings="shown"
                :table-label-of="labelOf"
                :can-create="true"
                @select="selectedId = $event.reservation.id"
                @create="openCreate($event)"
                @pick-day="pickDay"
              />
            </template>
          </template>

          <VProgressLinear
            v-if="loading && loadedOnce"
            indeterminate
            height="2"
          />
        </VCard>
      </VCol>
    </VRow>

    <ReservationDetailDrawer
      :reservation="selected"
      :table-label="labelOf(selected?.table_id)"
      @close="selectedId = null"
      @changed="refresh()"
      @edit="openEdit"
    />

    <ReservationFormDialog
      v-model="formOpen"
      :reservation="editing"
      :initial-date="formDate"
      :tables="tables"
      @saved="onSaved"
    />
  </div>
</template>

<style scoped>
.live-dot {
  display: inline-block;
  inline-size: 8px;
  block-size: 8px;
  border-radius: 50%;
  background: currentcolor;
}

.live-dot--on {
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  50% {
    opacity: 0.3;
  }
}

@media (prefers-reduced-motion: reduce) {
  .live-dot--on {
    animation: none;
  }
}
</style>
