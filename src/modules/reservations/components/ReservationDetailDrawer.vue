<!--
  Détail d'une réservation dans un tiroir. Les actions suivent l'état : la principale d'abord, puis
  les autres, « Absent » seulement après l'heure prévue. Annuler demande un motif ; absent et
  supprimer demandent une confirmation.
-->
<script setup lang="ts">
import { useNow } from '@vueuse/core'
import { reservationsApi } from '../api'
import { formatClock, formatFullDate } from '../calendar'
import type { Booking } from '../composables/useReservationRange'
import { ACTION_LABELS, actionsFor, coversLabel, formatWait, messageOf, presentStatus, primaryActionFor, sourceLabel } from '../labels'
import type { ReservationAction } from '../labels'
import type { ClientSummary, Reservation } from '../types'
import ReservationStatusChip from './ReservationStatusChip.vue'
import CancelDialog from './CancelDialog.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useTenantStore } from '@/stores/tenant.store'
import { useToast } from '@/stores/toast.store'

const props = defineProps<{
  booking: Booking | null
  zone: string
  tableLabelOf: (id: string | null | undefined) => string
}>()

const emit = defineEmits<{
  changed: [reservation: Reservation]
  edit: [reservation: Reservation]
  deleted: [id: string]
  close: []
}>()

const tenant = useTenantStore()
const toast = useToast()
const askConfirm = useConfirm()
const now = useNow({ interval: 30_000 })

const cancelOpen = ref(false)
const busy = ref(false)
const summary = ref<ClientSummary | null>(null)

const reservation = computed(() => props.booking?.reservation ?? null)
const view = computed(() => (reservation.value ? presentStatus(reservation.value.status) : null))

const ICONS: Record<ReservationAction, string> = {
  confirm: 'ri-checkbox-circle-line',
  checkin: 'ri-user-received-line',
  noshow: 'ri-user-unfollow-line',
  complete: 'ri-flag-line',
  edit: 'ri-edit-line',
  cancel: 'ri-close-circle-line',
}

const actions = computed(() => {
  if (!props.booking || !reservation.value)
    return []

  return actionsFor(reservation.value.status, { starts: props.booking.start, now: now.value })
})

const primary = computed(() => (reservation.value ? primaryActionFor(reservation.value.status) : null))

const waitText = computed(() => {
  if (!props.booking || !reservation.value || reservation.value.status !== 'pending')
    return ''

  const minutes = (props.booking.start.getTime() - now.value.getTime()) / 60_000

  return minutes > 0 ? `Dans ${formatWait(minutes)}` : ''
})

// Historique du client -----------------------------------------------------------------------

watch(() => reservation.value?.customer_id ?? null, async customerId => {
  summary.value = null

  if (!customerId || !tenant.currentId)
    return

  try {
    summary.value = await reservationsApi.customerSummary(tenant.currentId, customerId)
  }
  catch {
    summary.value = null
  }
}, { immediate: true })

const historyLine = computed(() => {
  const s = summary.value

  if (!s)
    return ''

  const parts = [`${s.visites} visite${s.visites > 1 ? 's' : ''}`]

  if (s.absences)
    parts.push(`${s.absences} absence${s.absences > 1 ? 's' : ''}`)
  if (s.derniere_visite)
    parts.push(`dernière visite le ${new Date(s.derniere_visite).toLocaleDateString('fr-FR', { timeZone: props.zone })}`)

  return parts.join(' · ')
})

// Actions --------------------------------------------------------------------------------------

const ACTION_CALLS: Partial<Record<ReservationAction, (r: Reservation) => Promise<Reservation>>> = {
  confirm: r => reservationsApi.confirm(r.id),
  checkin: r => reservationsApi.checkIn(r.id),
  complete: r => reservationsApi.complete(r.id),
}

/** Message de réussite par action directe (confirmer, arrivée, terminer). */
const ACTION_SUCCESS: Partial<Record<ReservationAction, string>> = {
  confirm: 'Réservation confirmée.',
  checkin: 'Client installé : table occupée, session ouverte.',
  complete: 'Réservation terminée.',
}

async function run(action: ReservationAction) {
  const current = reservation.value

  if (!current)
    return

  if (action === 'edit') {
    emit('edit', current)

    return
  }

  if (action === 'cancel') {
    cancelOpen.value = true

    return
  }

  if (action === 'noshow') {
    const accepted = await askConfirm({
      title: 'Marquer le client absent ?',
      text: 'La réservation est close. La table est libérée si rien d\'autre ne la prend dans les quatre heures.',
      confirmLabel: 'Marquer absent',
      danger: true,
    })

    if (!accepted)
      return

    await perform(() => reservationsApi.noShow(current.id), 'Client marqué absent.')

    return
  }

  const call = ACTION_CALLS[action]
  const success = ACTION_SUCCESS[action]

  if (call && success)
    await perform(() => call(current), success)
}

async function perform(call: () => Promise<Reservation>, success: string) {
  busy.value = true

  try {
    const saved = await call()

    toast.success(success)
    emit('changed', saved)
  }
  catch (error) {
    toast.error(messageOf(error))
  }
  finally {
    busy.value = false
  }
}

async function remove() {
  const current = reservation.value

  if (!current)
    return

  const accepted = await askConfirm({
    title: 'Supprimer la réservation ?',
    text: 'Elle disparaît de l\'agenda. L\'historique du client est conservé.',
    confirmLabel: 'Supprimer',
    danger: true,
  })

  if (!accepted)
    return

  busy.value = true

  try {
    await reservationsApi.remove(current.id)
    toast.success('Réservation supprimée.')
    emit('deleted', current.id)
  }
  catch (error) {
    toast.error(messageOf(error))
  }
  finally {
    busy.value = false
  }
}

function onCancelled(saved: Reservation) {
  emit('changed', saved)
}

const phoneHref = computed(() => (reservation.value?.customer_phone ? `tel:${reservation.value.customer_phone.replace(/\s/g, '')}` : ''))
</script>

<template>
  <VNavigationDrawer
    :model-value="booking !== null"
    location="end"
    temporary
    width="440"
    class="reservation-drawer"
    aria-label="Détail de la réservation"
    @update:model-value="value => { if (!value) emit('close') }"
  >
    <div
      v-if="reservation && view && booking"
      class="pa-5 reservation-drawer__body"
    >
      <div class="d-flex align-start justify-space-between ga-3">
        <div class="min-w-0">
          <div class="text-caption text-medium-emphasis">
            {{ formatFullDate(booking.start, zone) }}
          </div>
          <h2
            class="text-h5 mt-1 reservation-drawer__name"
            :class="{ 'reservation-drawer__name--closed': view.closed }"
          >
            {{ reservation.customer_name }}
          </h2>
          <div class="mt-2">
            <ReservationStatusChip :status="reservation.status" />
          </div>
        </div>
        <VBtn
          icon="ri-close-line"
          variant="text"
          aria-label="Fermer le détail"
          @click="emit('close')"
        />
      </div>

      <VList
        density="compact"
        class="mt-4 pa-0 reservation-drawer__facts"
      >
        <VListItem
          prepend-icon="ri-time-line"
          title="Heure"
          :subtitle="`${formatClock(booking.start, zone)} · ${reservation.duration_minutes} min`"
        />
        <VListItem
          prepend-icon="ri-group-line"
          title="Couverts"
          :subtitle="coversLabel(reservation.party_size)"
        />
        <VListItem
          prepend-icon="ri-layout-grid-line"
          title="Table"
          :subtitle="reservation.table_id ? tableLabelOf(reservation.table_id) : 'Pas encore choisie'"
        />
        <VListItem
          v-if="reservation.customer_phone"
          prepend-icon="ri-phone-line"
          title="Téléphone"
        >
          <a
            :href="phoneHref"
            class="reservation-drawer__link"
          >{{ reservation.customer_phone }}</a>
        </VListItem>
        <VListItem
          v-if="reservation.customer_email"
          prepend-icon="ri-mail-line"
          title="E-mail"
          :subtitle="reservation.customer_email"
        />
        <VListItem
          prepend-icon="ri-store-2-line"
          title="Réservé"
          :subtitle="sourceLabel(reservation.source)"
        />
      </VList>

      <div
        v-if="reservation.notes"
        class="reservation-drawer__note mt-4"
      >
        <div class="text-caption text-medium-emphasis mb-1">
          Notes
        </div>
        <div class="text-body-2">
          {{ reservation.notes }}
        </div>
      </div>

      <div
        class="reservation-drawer__history mt-4"
        aria-live="polite"
      >
        <div class="text-caption text-medium-emphasis mb-1">
          Historique client
        </div>
        <div
          v-if="historyLine"
          class="text-body-2"
        >
          {{ historyLine }}
        </div>
        <div
          v-else-if="reservation.customer_id"
          class="text-body-2 text-medium-emphasis"
        >
          Pas encore de visite enregistrée.
        </div>
        <div
          v-else
          class="text-body-2 text-medium-emphasis"
        >
          Client non enregistré dans la fiche clients.
        </div>
      </div>

      <div
        v-if="waitText"
        class="text-body-2 text-medium-emphasis mt-3"
      >
        {{ waitText }}
      </div>

      <div
        v-if="reservation.status === 'checked_in'"
        class="text-body-2 mt-4"
      >
        Installé à {{ reservation.checked_in_at ? formatClock(new Date(reservation.checked_in_at), zone) : '—' }}.
        <span v-if="!reservation.table_id">Aucune table : choisissez-la sur le plan.</span>
      </div>

      <div
        v-if="actions.length"
        class="reservation-drawer__actions mt-5"
      >
        <VBtn
          v-for="action in actions"
          :key="action"
          :color="action === 'cancel' ? 'error' : action === primary ? 'primary' : undefined"
          :variant="action === primary ? 'flat' : action === 'cancel' ? 'text' : 'outlined'"
          :prepend-icon="ICONS[action]"
          :loading="busy && action !== 'edit' && action !== 'cancel'"
          :disabled="busy"
          block
          class="mb-2"
          @click="run(action)"
        >
          {{ ACTION_LABELS[action] }}
        </VBtn>
      </div>

      <div class="mt-4 text-right">
        <VBtn
          variant="text"
          color="error"
          size="small"
          prepend-icon="ri-delete-bin-line"
          :disabled="busy"
          @click="remove"
        >
          Supprimer la réservation
        </VBtn>
      </div>
    </div>

    <CancelDialog
      v-model="cancelOpen"
      :reservation="reservation"
      @cancelled="onCancelled"
    />
  </VNavigationDrawer>
</template>

<style scoped>
.reservation-drawer__name--closed {
  text-decoration: line-through;
  text-decoration-thickness: 1px;
  color: rgb(var(--v-theme-on-surface) / 0.7);
}

.reservation-drawer__link {
  color: rgb(var(--v-theme-primary));
  font-variant-numeric: tabular-nums;
}

.reservation-drawer__note,
.reservation-drawer__history {
  padding: 12px 14px;
  border: 1px solid rgb(var(--v-theme-outline, 128 128 128) / 0.25);
  border-radius: 16px;
}

.reservation-drawer__actions .v-btn {
  min-height: 44px;
}

.min-w-0 {
  min-width: 0;
}
</style>
