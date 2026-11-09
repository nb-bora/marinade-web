<!--
  Réservations : la journée (grille horaire), la semaine ou le mois (liste), avec le mini-calendrier, les
  indicateurs du jour et le détail en tiroir. Tout est lu et écrit dans le fuseau du restaurant. Import,
  export et feuille du jour à imprimer sont sur cet écran ; la liste d'attente a sa propre page.
-->
<script setup lang="ts">
import { useDisplay } from 'vuetify'
import { useNow } from '@vueuse/core'
import MiniCalendar from '../components/MiniCalendar.vue'
import PrintSheet from '../components/PrintSheet.vue'
import ReservationDetailDrawer from '../components/ReservationDetailDrawer.vue'
import ReservationFormDialog from '../components/ReservationFormDialog.vue'
import ReservationList from '../components/ReservationList.vue'
import TimeGrid from '../components/TimeGrid.vue'
import { reservationsApi } from '../api'
import {
  addDaysIn,
  addMonthsIn,
  dayKey,
  formatDayMonth,
  formatFullDate,
  formatMonthYear,
  fromInputs,
  startOfDayIn,
  startOfMonthIn,
  startOfWeekIn,
} from '../calendar'
import type { Booking } from '../composables/useReservationRange'
import { useReservationRange } from '../composables/useReservationRange'
import { useRestaurantZone } from '../composables/useRestaurantZone'
import { useTables } from '../composables/useTables'
import { exportReservations, reservationsImport } from '../imports'
import { isDead, isOpen, messageOf } from '../labels'
import type { Reservation } from '../types'
import { useAsyncData } from '@/composables/useAsyncData'
import { useLive } from '@/composables/useLive'
import { useSubmit } from '@/composables/useSubmit'
import { useTenantStore } from '@/stores/tenant.store'
import { useToast } from '@/stores/toast.store'
import type { ImportResult } from '@/lib/sheetImport'

type ViewId = 'day' | 'week' | 'list'

const VIEWS: { value: ViewId; title: string }[] = [
  { value: 'day', title: 'Jour' },
  { value: 'week', title: 'Semaine' },
  { value: 'list', title: 'Liste' },
]

const tenant = useTenantStore()
const toast = useToast()
const display = useDisplay()
const now = useNow({ interval: 30_000 })
const { zone, name: restaurantName } = useRestaurantZone()

const canManage = computed(() => tenant.can('management'))

const view = ref<ViewId>(display.smAndDown.value ? 'list' : 'day')

// Le jour affiché est une clé « AAAA-MM-JJ » dans le fuseau du restaurant, réglée dès que celui-ci est connu.
const anchorDay = ref(dayKey(new Date(), zone.value))

watch(zone, value => {
  anchorDay.value = dayKey(new Date(), value)
})

const anchor = computed(() => fromInputs(anchorDay.value, '12:00', zone.value))
const dayStart = computed(() => startOfDayIn(anchor.value, zone.value))
const dayEnd = computed(() => addDaysIn(dayStart.value, 1, zone.value))

const miniMonth = ref<Date>(anchor.value)

watch(anchor, value => {
  miniMonth.value = value
})

const viewRange = computed(() => {
  if (view.value === 'day')
    return { from: dayStart.value, to: dayEnd.value }

  if (view.value === 'week') {
    const monday = startOfWeekIn(anchor.value, zone.value)

    return { from: monday, to: addDaysIn(monday, 7, zone.value) }
  }

  const first = startOfMonthIn(anchor.value, zone.value)

  return { from: first, to: addMonthsIn(first, 1, zone.value) }
})

// On charge aussi le mois du mini-calendrier, pour y marquer les jours occupés.
const fetchRange = computed(() => {
  const first = startOfMonthIn(miniMonth.value, zone.value)
  const from = new Date(Math.min(viewRange.value.from.getTime(), first.getTime()))
  const to = new Date(Math.max(viewRange.value.to.getTime(), addMonthsIn(first, 1, zone.value).getTime()))

  return { from, to }
})

const { bookings, loadedOnce, loading, error, reload, refresh } = useReservationRange(fetchRange)
const { tables, labelOf, refresh: refreshTables } = useTables()

const waitlist = useAsyncData(signal => (tenant.currentId
  ? reservationsApi.waitlist(tenant.currentId, 'WAITING', signal)
  : Promise.resolve([])), { watch: [() => tenant.currentId] })

const waitingCount = computed(() => waitlist.data.value?.length ?? 0)

const { isLive } = useLive(() => {
  refresh()
  refreshTables()
  waitlist.refresh()
})

const inView = computed(() => bookings.value.filter(({ start }) => start >= viewRange.value.from && start < viewRange.value.to))
const dayBookings = computed(() => bookings.value.filter(({ start }) => start >= dayStart.value && start < dayEnd.value))

const dayLive = computed(() => dayBookings.value.filter(({ reservation }) => !isDead(reservation.status)))

// La synthèse suit la période affichée : le jour en vue Jour, la semaine ou le mois sinon.
const scopeLive = computed(() => (view.value === 'day'
  ? dayLive.value
  : inView.value.filter(({ reservation }) => !isDead(reservation.status))))

const dayMetrics = computed(() => ({
  total: scopeLive.value.length,
  covers: scopeLive.value.reduce((sum, { reservation }) => sum + reservation.party_size, 0),
  toConfirm: scopeLive.value.filter(({ reservation }) => reservation.status === 'pending').length,
  expected: scopeLive.value.filter(({ reservation }) => isOpen(reservation.status)).length,
}))

const counts = computed(() => {
  const result = new Map<string, number>()

  bookings.value
    .filter(({ reservation }) => !isDead(reservation.status))
    .forEach(({ start }) => result.set(dayKey(start, zone.value), (result.get(dayKey(start, zone.value)) ?? 0) + 1))

  return result
})

const search = ref('')

const listItems = computed(() => {
  const term = search.value.trim().toLowerCase()

  return inView.value
    .filter(({ reservation }) => !term
      || reservation.customer_name.toLowerCase().includes(term)
      || (reservation.customer_phone ?? '').includes(term))
    .sort((a, b) => a.start.getTime() - b.start.getTime())
})

const title = computed(() => {
  if (view.value === 'day')
    return formatFullDate(anchor.value, zone.value)

  if (view.value === 'week') {
    const monday = startOfWeekIn(anchor.value, zone.value)
    const sunday = addDaysIn(monday, 6, zone.value)

    return `Du ${formatDayMonth(monday, zone.value)} au ${formatDayMonth(sunday, zone.value)}`
  }

  return formatMonthYear(anchor.value, zone.value)
})

function step(direction: -1 | 1) {
  if (view.value === 'day')
    anchorDay.value = dayKey(addDaysIn(anchor.value, direction, zone.value), zone.value)
  else if (view.value === 'week')
    anchorDay.value = dayKey(addDaysIn(anchor.value, direction * 7, zone.value), zone.value)
  else
    anchorDay.value = dayKey(addMonthsIn(anchor.value, direction, zone.value), zone.value)
}

function goToday() {
  anchorDay.value = dayKey(new Date(), zone.value)
}

const dateMenu = ref(false)
const isToday = computed(() => anchorDay.value === dayKey(now.value, zone.value))

function pickDay(day: Date) {
  anchorDay.value = dayKey(day, zone.value)
  dateMenu.value = false
  if (view.value === 'list')
    view.value = 'day'
}

// Tiroir, formulaire, import, impression --------------------------------------------------------

const selectedId = ref<string | null>(null)
const selected = computed<Booking | null>(() => bookings.value.find(item => item.reservation.id === selectedId.value) ?? null)

const formOpen = ref(false)
const editing = ref<Reservation | null>(null)
const formInitial = ref(new Date())
const importOpen = ref(false)

/** Nouvelle réservation : à l'instant cliqué sur la grille, sinon à 19 h le jour affiché. */
function openNew(instant?: Date) {
  editing.value = null
  formInitial.value = instant instanceof Date ? instant : fromInputs(anchorDay.value, '19:00', zone.value)
  formOpen.value = true
}

function openEdit(reservation: Reservation) {
  editing.value = reservation
  formInitial.value = new Date(reservation.reservation_date)
  formOpen.value = true
}

/** Le tiroir lit la réservation dans la liste rechargée : il se met à jour seul. */
function onChanged() {
  refresh()
}

function onDeleted() {
  selectedId.value = null
  refresh()
}

const importDefinition = computed(() => reservationsImport({ restaurantId: tenant.currentId ?? '', zone: zone.value }))

const exporting = useSubmit(async () => {
  const list = view.value === 'day' ? dayLive.value : inView.value
  const label = view.value === 'day' ? anchorDay.value : view.value === 'week' ? `semaine-${anchorDay.value}` : anchorDay.value.slice(0, 7)

  exportReservations(list, zone.value, id => tables.value.find(table => table.id === id)?.numero ?? '', label)
  toast.success(`${list.length} réservation${list.length > 1 ? 's' : ''} exportée${list.length > 1 ? 's' : ''}.`)
})

function onImported(result: ImportResult) {
  const parts = [`${result.created} créée${result.created > 1 ? 's' : ''}`]

  if (result.issues.length)
    parts.push(`${result.issues.length} ligne${result.issues.length > 1 ? 's' : ''} refusée${result.issues.length > 1 ? 's' : ''}`)

  toast.success(`Import terminé : ${parts.join(', ')}.`)
  refresh()
}

function printSheet() {
  window.print()
}

// Repli si l'API tombe : on garde le message dans l'écran, pas dans une alerte.
const loadError = computed(() => (error.value && !loadedOnce.value ? messageOf(error.value) : ''))
</script>

<template>
  <div class="reservations-page">
    <AppHero
      eyebrow="Salle"
      title="Réservations"
      :subtitle="restaurantName || 'Votre restaurant'"
      :live="isLive"
    >
      <template #actions>
        <VBtn
          variant="tonal"
          prepend-icon="ri-time-line"
          to="/reservations/attente"
          data-tour="resa-waitlist-link"
        >
          Liste d'attente
          <VChip
            v-if="waitingCount"
            size="x-small"
            color="warning"
            class="ms-2"
          >
            {{ waitingCount }}
          </VChip>
        </VBtn>
        <VBtn
          color="primary"
          prepend-icon="ri-add-line"
          data-tour="resa-new"
          @click="openNew"
        >
          Nouvelle réservation
        </VBtn>
        <VMenu>
          <template #activator="{ props: menu }">
            <VBtn
              v-bind="menu"
              icon="ri-more-2-line"
              variant="text"
              aria-label="Autres actions"
            />
          </template>
          <VList density="compact">
            <VListItem
              prepend-icon="ri-printer-line"
              title="Imprimer la feuille du jour"
              @click="printSheet"
            />
            <VListItem
              prepend-icon="ri-download-2-line"
              title="Exporter (Excel)"
              :disabled="exporting.pending.value"
              @click="exporting.submit()"
            />
            <VListItem
              v-if="canManage"
              prepend-icon="ri-upload-2-line"
              title="Importer (Excel)"
              @click="importOpen = true"
            />
          </VList>
        </VMenu>
      </template>
    </AppHero>

    <!-- Navigation : une seule rangée. La date ouvre le mini-calendrier. -->
    <div
      class="toolbar mt-5"
      data-tour="resa-toolbar"
    >
      <div class="toolbar__nav">
        <VBtn
          icon="ri-arrow-left-s-line"
          variant="text"
          aria-label="Précédent"
          @click="step(-1)"
        />
        <VMenu
          v-model="dateMenu"
          location="bottom start"
          :close-on-content-click="false"
        >
          <template #activator="{ props: menu }">
            <button
              type="button"
              class="toolbar__date"
              v-bind="menu"
              :aria-label="`Choisir une date. Affichage : ${title}`"
            >
              <VIcon
                icon="ri-calendar-line"
                size="18"
              />
              <span>{{ title }}</span>
              <VIcon
                icon="ri-arrow-down-s-line"
                size="18"
              />
            </button>
          </template>
          <MiniCalendar
            :month="miniMonth"
            :selected="anchor"
            :zone="zone"
            :now="now"
            :counts="counts"
            @select="pickDay"
            @update:month="miniMonth = $event"
          />
        </VMenu>
        <VBtn
          icon="ri-arrow-right-s-line"
          variant="text"
          aria-label="Suivant"
          @click="step(1)"
        />
        <VBtn
          v-if="!isToday"
          variant="tonal"
          size="small"
          class="ms-1"
          @click="goToday"
        >
          Aujourd'hui
        </VBtn>
      </div>
      <AppSegmented
        v-model="view"
        :options="VIEWS"
        label="Vue des réservations"
      />
    </div>

    <!-- Synthèse du jour : une phrase, pas des cartes. -->
    <div
      class="summary mt-4"
      aria-live="polite"
    >
      <span class="summary__item">
        <strong>{{ dayMetrics.total }}</strong>
        réservation{{ dayMetrics.total > 1 ? 's' : '' }}
      </span>
      <span class="summary__dot" />
      <span class="summary__item">
        <strong>{{ dayMetrics.covers }}</strong>
        couvert{{ dayMetrics.covers > 1 ? 's' : '' }}
      </span>
      <template v-if="dayMetrics.toConfirm">
        <span class="summary__dot" />
        <span class="summary__item summary__item--warn">
          <strong>{{ dayMetrics.toConfirm }}</strong>
          à confirmer
        </span>
      </template>
      <template v-if="dayMetrics.expected">
        <span class="summary__dot" />
        <span class="summary__item">
          <strong>{{ dayMetrics.expected }}</strong>
          arrivée{{ dayMetrics.expected > 1 ? 's' : '' }} attendue{{ dayMetrics.expected > 1 ? 's' : '' }}
        </span>
      </template>
    </div>

    <AppErrorState
      v-if="loadError"
      class="mt-5"
      :error="error"
      @retry="reload"
    />

    <VCard
      class="board mt-4"
      flat
    >
      <div
        v-if="loading && !loadedOnce"
        class="pa-6 text-center text-medium-emphasis"
        role="status"
      >
        Chargement des réservations…
      </div>

      <TimeGrid
        v-else-if="view === 'day'"
        :day="anchor"
        :bookings="bookings"
        :zone="zone"
        :now="now"
        :table-label-of="labelOf"
        data-tour="resa-grid"
        @open="selectedId = $event.reservation.id"
        @create="openNew"
      />

      <div
        v-else
        class="pa-4"
      >
        <VTextField
          v-if="view === 'list'"
          v-model="search"
          label="Rechercher un client"
          prepend-inner-icon="ri-search-line"
          placeholder="Nom ou téléphone"
          clearable
          hide-details
          class="mb-4"
        />
        <ReservationList
          :bookings="listItems"
          :zone="zone"
          :table-label-of="labelOf"
          @open="selectedId = $event.reservation.id"
        />
      </div>
    </VCard>

    <ReservationDetailDrawer
      :booking="selected"
      :zone="zone"
      :table-label-of="labelOf"
      @changed="onChanged"
      @edit="openEdit"
      @deleted="onDeleted"
      @close="selectedId = null"
    />

    <ReservationFormDialog
      v-model="formOpen"
      :reservation="editing"
      :initial-date="formInitial"
      :tables="tables"
      :zone="zone"
      :can-force="canManage"
      @saved="refresh"
    />

    <AppImportDialog
      v-if="canManage"
      v-model="importOpen"
      v-bind="importDefinition"
      @imported="onImported"
    />

    <PrintSheet
      :day="anchor"
      :bookings="dayBookings"
      :zone="zone"
      :restaurant-name="restaurantName"
      :waiting-count="waitingCount"
      :table-label-of="labelOf"
    />
  </div>
</template>

<style scoped>
.toolbar {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 12px 16px;
  justify-content: space-between;
}

.toolbar__nav {
  align-items: center;
  display: flex;
  gap: 4px;
  min-inline-size: 0;
}

.toolbar__date {
  align-items: center;
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgba(var(--v-border-color), 0.16);
  border-radius: 12px;
  color: inherit;
  cursor: pointer;
  display: inline-flex;
  font: inherit;
  font-weight: 650;
  gap: 8px;
  padding: 8px 14px;
  transition: border-color 0.15s ease;

  &:hover {
    border-color: rgba(var(--v-theme-primary), 0.45);
  }

  &:focus-visible {
    outline: 2px solid rgb(var(--v-theme-primary));
    outline-offset: 2px;
  }
}

/* Majuscule à la première lettre seulement : « Lundi 9 novembre 2026 ». */
.toolbar__date span {
  display: inline-block;
}

.toolbar__date span::first-letter {
  text-transform: uppercase;
}

.summary {
  align-items: center;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  display: flex;
  flex-wrap: wrap;
  font-size: 0.95rem;
  gap: 6px 10px;
}

.summary strong {
  color: rgb(var(--v-theme-on-surface));
  font-weight: 700;
  margin-inline-end: 3px;
}

.summary__item--warn strong {
  color: rgb(var(--v-theme-warning));
}

.summary__dot {
  background: rgba(var(--v-theme-on-surface), 0.3);
  block-size: 4px;
  border-radius: 50%;
  inline-size: 4px;
}

.board {
  border: 1px solid rgba(var(--v-border-color), 0.14);
  border-radius: 16px;
  overflow: hidden;
}

@media (max-width: 599px) {
  .toolbar__date {
    font-size: 0.9rem;
    padding: 6px 10px;
  }
}
</style>
