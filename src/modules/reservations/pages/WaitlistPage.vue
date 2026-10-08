<script setup lang="ts">
import { reservationsApi } from '../api'
import SeatDialog from '../components/SeatDialog.vue'
import WaitlistQuickAdd from '../components/WaitlistQuickAdd.vue'
import { coversLabel, formatWait } from '../labels'
import type { WaitlistEntry } from '../types'
import { useAsyncData } from '@/composables/useAsyncData'
import { useConfirm } from '@/composables/useConfirm'
import { useLive } from '@/composables/useLive'
import { useSubmit } from '@/composables/useSubmit'
import { formatNational, nationalDigits } from '@/lib/phone'
import { useTenantStore } from '@/stores/tenant.store'
import { useToast } from '@/stores/toast.store'
import type { StatStripItem } from '@/ui/AppStatStrip.vue'

const tenant = useTenantStore()
const toast = useToast()
const confirm = useConfirm()

const { data, loading, error, reload, refresh } = useAsyncData(
  signal => tenant.currentId ? reservationsApi.waitlist(tenant.currentId, signal) : Promise.resolve([] as WaitlistEntry[]),
  { watch: [() => tenant.currentId] },
)

const { isLive } = useLive(refresh)
const now = useNow({ interval: 30_000 })

// Le serveur garde aussi les groupes déjà installés ou retirés : seule la file active compte.
const waiting = computed(() => (data.value ?? [])
  .filter(entry => entry.status === 'WAITING')
  .sort((a, b) => a.position - b.position))

const minutesSince = (entry: WaitlistEntry) => (now.value.getTime() - new Date(entry.joined_at).getTime()) / 60_000

const stats = computed<StatStripItem[]>(() => {
  const list = waiting.value
  const covers = list.reduce((sum, entry) => sum + entry.party_size, 0)
  const longest = list.length ? Math.max(...list.map(minutesSince)) : 0

  return [
    { label: 'Groupes en attente', value: String(list.length), icon: 'ri-group-line' },
    { label: 'Couverts en attente', value: String(covers), icon: 'ri-restaurant-line' },
    { label: 'Plus longue attente', value: list.length ? formatWait(longest) : '—', icon: 'ri-hourglass-line' },
  ]
})

/** « Attend depuis 12 min » ; « Vient d'arriver » sous la minute. */
function sinceText(entry: WaitlistEntry) {
  const minutes = minutesSince(entry)

  return minutes < 1 ? 'Vient d\'arriver' : `Attend depuis ${formatWait(minutes)}`
}

function phoneText(value: string | null | undefined) {
  if (!value)
    return ''

  const digits = nationalDigits(value)

  return digits.length === 9 ? `+237 ${formatNational(digits)}` : value
}

/** Où en est l'attente par rapport à l'estimation donnée au client. */
function estimateOf(entry: WaitlistEntry) {
  if (entry.estimated_wait_minutes === null || entry.estimated_wait_minutes === undefined)
    return null

  const left = entry.estimated_wait_minutes - minutesSince(entry)

  return left >= 1
    ? { text: `Encore ${formatWait(left)}`, late: false }
    : { text: `Dépassée de ${formatWait(-left)}`, late: true }
}

// Installer --------------------------------------------------------------------------------

const seatOpen = ref(false)
const seating = ref<WaitlistEntry | null>(null)

function openSeat(entry: WaitlistEntry) {
  seating.value = entry
  seatOpen.value = true
}

// Retirer ----------------------------------------------------------------------------------

const { submit: remove, pending: removing, message: removeError } = useSubmit(async (entry: WaitlistEntry) => {
  const accepted = await confirm({
    title: 'Retirer de la liste d\'attente ?',
    text: `${entry.customer_name} (${coversLabel(entry.party_size)}) quittera la file. Les autres gardent leur rang.`,
    confirmLabel: 'Supprimer',
    danger: true,
  })

  if (!accepted)
    return

  await reservationsApi.removeFromWaitlist(entry.id)
  toast.success(`${entry.customer_name} a été retiré de la liste.`)
  await refresh()
})
</script>

<template>
  <div>
    <AppPageHeader
      title="Liste d'attente"
      subtitle="Les clients sans réservation qui attendent une table, dans l'ordre d'arrivée."
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
          prepend-icon="ri-calendar-line"
          to="/reservations"
        >
          Réservations
        </VBtn>
      </template>
    </AppPageHeader>

    <AppStatStrip
      :items="stats"
      :loading="loading && !data"
    />

    <WaitlistQuickAdd
      class="mt-6"
      @added="refresh"
    />

    <VCard class="mt-6">
      <VCardItem>
        <VCardTitle>File d'attente</VCardTitle>
      </VCardItem>

      <VAlert
        v-if="removeError"
        type="error"
        variant="tonal"
        density="compact"
        class="mx-4 mb-4"
      >
        {{ removeError }}
      </VAlert>

      <AppErrorState
        v-if="error && !data"
        class="ma-4"
        :error="error"
        @retry="reload"
      />

      <VSkeletonLoader
        v-else-if="!data"
        type="table-thead, table-tbody"
      />

      <AppEmptyState
        v-else-if="waiting.length === 0"
        icon="ri-time-line"
        title="Personne n'attend"
        text="Quand la salle est complète, ajoutez les clients ici : ils seront installés dans l'ordre."
      />

      <VTable
        v-else
        hover
      >
        <thead>
          <tr>
            <th>Client</th>
            <th class="d-none d-sm-table-cell">
              Couverts
            </th>
            <th class="d-none d-md-table-cell">
              Attente
            </th>
            <th class="text-end">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(entry, index) in waiting"
            :key="entry.id"
          >
            <td class="fill-cell">
              <div class="d-flex align-center gap-3 py-2">
                <VAvatar
                  color="primary"
                  :variant="index === 0 ? 'flat' : 'tonal'"
                  rounded
                  size="38"
                >
                  <span class="text-body-1 font-weight-semibold">{{ index + 1 }}</span>
                </VAvatar>
                <div class="min-w-0">
                  <div class="text-body-1 font-weight-medium text-high-emphasis text-truncate">
                    {{ entry.customer_name }}
                  </div>
                  <div class="text-body-2 text-medium-emphasis text-truncate">
                    <span class="d-sm-none">{{ coversLabel(entry.party_size) }} · </span>{{ phoneText(entry.customer_phone) || 'Sans téléphone' }}
                  </div>
                  <div class="text-body-2 text-medium-emphasis d-md-none">
                    {{ sinceText(entry) }}
                  </div>
                </div>
              </div>
            </td>
            <td class="d-none d-sm-table-cell">
              {{ coversLabel(entry.party_size) }}
            </td>
            <td class="d-none d-md-table-cell">
              <div class="text-body-1">
                {{ sinceText(entry) }}
              </div>
              <div
                v-if="estimateOf(entry)"
                class="text-body-2"
                :class="estimateOf(entry)?.late ? 'text-error' : 'text-medium-emphasis'"
              >
                {{ estimateOf(entry)?.text }}
              </div>
            </td>
            <td class="text-end">
              <div class="d-flex flex-column flex-sm-row justify-end gap-2">
                <VBtn
                  size="small"
                  prepend-icon="ri-layout-grid-line"
                  :aria-label="`Installer ${entry.customer_name}`"
                  @click="openSeat(entry)"
                >
                  Installer
                </VBtn>
                <VBtn
                  size="small"
                  variant="outlined"
                  color="secondary"
                  :loading="removing"
                  :aria-label="`Retirer ${entry.customer_name}`"
                  @click="remove(entry)"
                >
                  Retirer
                </VBtn>
              </div>
            </td>
          </tr>
        </tbody>
      </VTable>
    </VCard>

    <SeatDialog
      v-model="seatOpen"
      :entry="seating"
      @seated="refresh"
    />
  </div>
</template>

<style scoped>
.fill-cell {
  inline-size: 100%;
  max-inline-size: 0;
}

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
