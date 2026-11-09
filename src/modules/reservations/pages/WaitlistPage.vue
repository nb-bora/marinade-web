<!--
  Liste d'attente : les groupes qui attendent une table, dans l'ordre d'arrivée. Installer choisit une table
  libre (le serveur contrôle), prévenir envoie un e-mail si le groupe en a une adresse, retirer demande
  confirmation. Les changements de la file sont annoncés aux lecteurs d'écran.
-->
<script setup lang="ts">
import { useNow } from '@vueuse/core'
import { reservationsApi } from '../api'
import { exportWaitlist, waitlistImport } from '../imports'
import { coversLabel, formatWait, groupsLabel, messageOf } from '../labels'
import SeatDialog from '../components/SeatDialog.vue'
import WaitlistQuickAdd from '../components/WaitlistQuickAdd.vue'
import { useRestaurantZone } from '../composables/useRestaurantZone'
import { useTables } from '../composables/useTables'
import type { WaitlistEntry } from '../types'
import { useAsyncData } from '@/composables/useAsyncData'
import { useConfirm } from '@/composables/useConfirm'
import { useLive } from '@/composables/useLive'
import { useTenantStore } from '@/stores/tenant.store'
import { useToast } from '@/stores/toast.store'
import type { ImportResult } from '@/lib/sheetImport'

const tenant = useTenantStore()
const toast = useToast()
const askConfirm = useConfirm()
const now = useNow({ interval: 30_000 })
const { zone } = useRestaurantZone()
const { tables, refresh: refreshTables } = useTables()

const canManage = computed(() => tenant.can('management'))

const { data, loading, error, reload, refresh } = useAsyncData<WaitlistEntry[]>(signal => (tenant.currentId
  ? reservationsApi.waitlist(tenant.currentId, 'WAITING', signal)
  : Promise.resolve([])), { watch: [() => tenant.currentId] })

const { isLive } = useLive(() => {
  refresh()
  refreshTables()
})

const entries = computed(() => [...(data.value ?? [])].sort((a, b) => a.position - b.position))

const minutesWaiting = (entry: WaitlistEntry) => (now.value.getTime() - new Date(entry.joined_at).getTime()) / 60_000

// Indicateurs -------------------------------------------------------------------------------------

const totals = computed(() => ({
  groups: entries.value.length,
  covers: entries.value.reduce((sum, entry) => sum + entry.party_size, 0),
  longest: entries.value.length ? Math.max(...entries.value.map(minutesWaiting)) : null,
}))

const seatedToday = ref<WaitlistEntry[]>([])

const averageWait = computed(() => {
  if (!seatedToday.value.length)
    return null

  const minutes = seatedToday.value.map(entry => (new Date(entry.seated_at ?? entry.joined_at).getTime() - new Date(entry.joined_at).getTime()) / 60_000)

  return minutes.reduce((sum, value) => sum + value, 0) / minutes.length
})

async function loadSeated() {
  if (!tenant.currentId)
    return

  const list = await reservationsApi.waitlist(tenant.currentId, 'SEATED').catch(() => [])
  const startOfToday = new Date()

  startOfToday.setHours(0, 0, 0, 0)
  seatedToday.value = list.filter(entry => entry.seated_at && new Date(entry.seated_at) >= startOfToday)
}

watch(() => tenant.currentId, () => {
  loadSeated()
}, { immediate: true })

// Actions -------------------------------------------------------------------------------------------

const seatOpen = ref(false)
const seating = ref<WaitlistEntry | null>(null)

function openSeat(entry: WaitlistEntry) {
  seating.value = entry
  seatOpen.value = true
}

async function onSeated() {
  await Promise.all([refresh(), loadSeated()])
}

const notifying = ref<string | null>(null)

async function notify(entry: WaitlistEntry) {
  notifying.value = entry.id

  try {
    const result = await reservationsApi.notify(entry.id)

    toast.success(`${entry.customer_name} a été prévenu à ${result.destinataire}.`)
  }
  catch (cause) {
    toast.error(messageOf(cause))
  }
  finally {
    notifying.value = null
  }
}

async function remove(entry: WaitlistEntry) {
  const accepted = await askConfirm({
    title: `Retirer ${entry.customer_name} de la liste ?`,
    text: 'Le groupe quitte la file. Les groupes suivants avancent d\'un rang.',
    confirmLabel: 'Retirer de la liste',
    danger: true,
  })

  if (!accepted)
    return

  try {
    await reservationsApi.removeFromWaitlist(entry.id, 'Retiré de la liste')
    toast.success(`${entry.customer_name} retiré de la liste.`)
    await refresh()
  }
  catch (cause) {
    toast.error(messageOf(cause))
  }
}

// Import et export -------------------------------------------------------------------------------

const importOpen = ref(false)
const importDefinition = computed(() => waitlistImport(tenant.currentId ?? ''))

function onImported(result: ImportResult) {
  toast.success(`Import terminé : ${result.created} ajouté${result.created > 1 ? 's' : ''}${result.issues.length ? `, ${result.issues.length} ligne${result.issues.length > 1 ? 's' : ''} refusée${result.issues.length > 1 ? 's' : ''}` : ''}.`)
  refresh()
}

function exportList() {
  exportWaitlist(entries.value, zone.value, new Date().toISOString().slice(0, 10))
}

const summary = computed(() => (totals.value.groups
  ? `${groupsLabel(totals.value.groups)} en attente, ${coversLabel(totals.value.covers)}`
  : 'Personne n\'attend pour le moment'))
</script>

<template>
  <div class="waitlist-page">
    <AppHero
      eyebrow="Salle"
      title="Liste d'attente"
      subtitle="Les groupes qui attendent une table, dans l'ordre d'arrivée."
      :live="isLive"
    >
      <template #actions>
        <VBtn
          variant="text"
          prepend-icon="ri-calendar-event-line"
          to="/reservations"
        >
          Réservations
        </VBtn>
        <VBtn
          variant="text"
          prepend-icon="ri-download-2-line"
          :disabled="!entries.length"
          @click="exportList"
        >
          Exporter
        </VBtn>
        <VBtn
          v-if="canManage"
          variant="text"
          prepend-icon="ri-upload-2-line"
          @click="importOpen = true"
        >
          Importer
        </VBtn>
      </template>
    </AppHero>

    <AppMetricGrid class="mt-5">
      <AppMetricTile
        hero
        label="Groupes en attente"
        icon="ri-time-line"
        color="warning"
        :hint="summary"
      >
        <AppAnimatedNumber
          v-slot="{ current }"
          :value="totals.groups"
        >
          {{ Math.round(current) }}
        </AppAnimatedNumber>
      </AppMetricTile>
      <AppMetricTile
        label="Couverts en attente"
        icon="ri-group-line"
        color="info"
      >
        <AppAnimatedNumber
          v-slot="{ current }"
          :value="totals.covers"
        >
          {{ Math.round(current) }}
        </AppAnimatedNumber>
      </AppMetricTile>
      <AppMetricTile
        label="Plus longue attente"
        icon="ri-hourglass-line"
        :hint="totals.longest === null ? 'Aucun groupe en attente' : 'Depuis son arrivée'"
      >
        <span class="text-h4">{{ totals.longest === null ? '—' : formatWait(totals.longest) }}</span>
      </AppMetricTile>
      <AppMetricTile
        label="Attente moyenne"
        icon="ri-speed-line"
        color="success"
        :hint="averageWait === null ? 'Aucune installation aujourd\'hui' : 'Constatée sur les groupes installés aujourd\'hui'"
      >
        <span class="text-h4">{{ averageWait === null ? '—' : formatWait(averageWait) }}</span>
      </AppMetricTile>
    </AppMetricGrid>

    <div class="mt-5">
      <WaitlistQuickAdd @added="refresh" />
    </div>

    <div class="d-flex align-center justify-space-between mt-6 mb-2">
      <h2 class="text-h6 ma-0">
        File d'attente
      </h2>
      <span
        class="text-body-2 text-medium-emphasis"
        aria-live="polite"
        role="status"
      >{{ summary }}</span>
    </div>

    <AppErrorState
      v-if="error && !data"
      :error="error"
      @retry="reload"
    />

    <div
      v-else-if="loading && !data"
      class="pa-6 text-center text-medium-emphasis"
      role="status"
    >
      Chargement de la file…
    </div>

    <AppEmptyState
      v-else-if="!entries.length"
      icon="ri-time-line"
      title="Personne n'attend"
      text="Les groupes ajoutés apparaissent ici, dans l'ordre d'arrivée."
    />

    <ol
      v-else
      class="queue"
      aria-label="Groupes en attente, par position"
    >
      <li
        v-for="entry in entries"
        :key="entry.id"
        class="queue__item"
      >
        <div
          class="queue__rank"
          :aria-label="`Position ${entry.position}`"
        >
          {{ entry.position }}
        </div>
        <div class="queue__main">
          <div class="queue__name">
            {{ entry.customer_name }}
          </div>
          <div class="queue__meta">
            {{ coversLabel(entry.party_size) }}
            · attend depuis {{ formatWait(minutesWaiting(entry)) }}
            <template v-if="entry.customer_phone">
              · {{ entry.customer_phone }}
            </template>
          </div>
          <div
            v-if="entry.notes"
            class="queue__notes"
          >
            {{ entry.notes }}
          </div>
        </div>
        <div class="queue__actions">
          <VBtn
            color="primary"
            prepend-icon="ri-restaurant-line"
            size="large"
            @click="openSeat(entry)"
          >
            Installer
          </VBtn>
          <VBtn
            v-if="entry.customer_email"
            variant="outlined"
            prepend-icon="ri-notification-3-line"
            :loading="notifying === entry.id"
            size="large"
            @click="notify(entry)"
          >
            Prévenir
          </VBtn>
          <VBtn
            variant="text"
            color="error"
            prepend-icon="ri-user-unfollow-line"
            size="large"
            @click="remove(entry)"
          >
            Retirer
          </VBtn>
        </div>
      </li>
    </ol>

    <SeatDialog
      v-model="seatOpen"
      :entry="seating"
      :tables="tables"
      :can-force="canManage"
      @seated="onSeated"
    />

    <AppImportDialog
      v-if="canManage"
      v-model="importOpen"
      v-bind="importDefinition"
      @imported="onImported"
    />
  </div>
</template>

<style scoped>
.queue {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 10px;
}

.queue__item {
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr) auto;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  border: 1px solid rgb(var(--v-theme-outline, 128 128 128) / 0.25);
  border-radius: 16px;
  background: rgb(var(--v-theme-surface));
}

.queue__rank {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: rgb(var(--v-theme-warning) / 0.16);
  color: rgb(var(--v-theme-on-surface));
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.queue__main {
  min-width: 0;
}

.queue__name {
  font-weight: 600;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.queue__meta,
.queue__notes {
  font-size: 0.875rem;
  color: rgb(var(--v-theme-on-surface) / 0.75);
}

.queue__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}

.queue__actions :deep(.v-btn) {
  min-height: 44px;
}

@media (max-width: 600px) {
  .queue__item {
    grid-template-columns: 44px minmax(0, 1fr);
  }

  .queue__actions {
    grid-column: 1 / -1;
    justify-content: stretch;
  }

  .queue__actions :deep(.v-btn) {
    flex: 1 1 auto;
  }
}
</style>
