<!-- Détail d'une réservation : le client, l'horaire, la table, et les actions possibles selon son statut. -->
<script setup lang="ts">
import { onKeyStroke } from '@vueuse/core'
import { reservationsApi } from '../api'
import { formatFullDate } from '../calendar'
import { coversLabel, isOpen, presentStatus, sourceLabel } from '../labels'
import type { Reservation } from '../types'
import CancelDialog from './CancelDialog.vue'
import ReservationStatusChip from './ReservationStatusChip.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useSubmit } from '@/composables/useSubmit'
import { formatDateTime, formatTime } from '@/lib/format'
import { formatNational, nationalDigits } from '@/lib/phone'
import { useToast } from '@/stores/toast.store'

const props = defineProps<{
  reservation: Reservation | null
  tableLabel: string
}>()

const emit = defineEmits<{
  changed: []
  edit: [reservation: Reservation]
  close: []
}>()

const toast = useToast()
const confirm = useConfirm()
const cancelOpen = ref(false)

const isShown = computed({
  get: () => props.reservation !== null,
  set: shown => {
    if (!shown)
      emit('close')
  },
})

onKeyStroke('Escape', () => {
  if (isShown.value && !cancelOpen.value)
    emit('close')
})

const start = computed(() => props.reservation ? new Date(props.reservation.reservation_date) : null)
const end = computed(() => props.reservation && start.value ? new Date(start.value.getTime() + props.reservation.duration_minutes * 60_000) : null)

const open = computed(() => props.reservation ? isOpen(props.reservation.status) : false)
const canCheckIn = computed(() => open.value)
const canEdit = computed(() => props.reservation ? !['cancelled', 'no_show', 'completed'].includes(props.reservation.status) : false)

const phone = computed(() => {
  const value = props.reservation?.customer_phone

  if (!value)
    return null

  const digits = nationalDigits(value)

  return digits.length === 9 ? { text: `+237 ${formatNational(digits)}`, href: `tel:+237${digits}` } : { text: value, href: `tel:${value}` }
})

const { submit: confirmReservation, pending: confirming } = useSubmit(async () => {
  if (!props.reservation)
    return

  await reservationsApi.confirm(props.reservation.id)
  toast.success('Réservation confirmée.')
  emit('changed')
})

const { submit: checkIn, pending: checkingIn } = useSubmit(async () => {
  if (!props.reservation)
    return

  await reservationsApi.checkIn(props.reservation.id)
  toast.success(`${props.reservation.customer_name} est arrivé.`)
  emit('changed')
})

const { submit: removeReservation, pending: removing, message: removeError } = useSubmit(async () => {
  const reservation = props.reservation

  if (!reservation)
    return

  const accepted = await confirm({
    title: 'Supprimer cette réservation ?',
    text: `La réservation de ${reservation.customer_name} sera définitivement effacée. Pour garder une trace, préférez l'annulation.`,
    confirmLabel: 'Supprimer',
    danger: true,
  })

  if (!accepted)
    return

  await reservationsApi.remove(reservation.id)
  toast.success('Réservation supprimée.')
  emit('close')
  emit('changed')
})

const busy = computed(() => confirming.value || checkingIn.value || removing.value)
</script>

<template>
  <VNavigationDrawer
    v-model="isShown"
    location="end"
    temporary
    width="440"
    aria-label="Détail de la réservation"
  >
    <div class="d-flex align-center justify-space-between pa-4 pb-2">
      <h2 class="text-h6">
        Réservation
      </h2>
      <IconBtn
        aria-label="Fermer"
        @click="emit('close')"
      >
        <VIcon icon="ri-close-line" />
      </IconBtn>
    </div>

    <div
      v-if="reservation && start && end"
      class="px-4 pb-6"
    >
      <div class="d-flex align-center justify-space-between gap-3 mb-3">
        <ReservationStatusChip :status="reservation.status" />
        <span class="text-body-2 text-medium-emphasis">{{ sourceLabel(reservation.source) }}</span>
      </div>

      <div class="text-h5 font-weight-semibold">
        {{ reservation.customer_name }}
      </div>
      <div class="text-body-1 mt-1">
        {{ formatFullDate(start) }}
      </div>
      <div class="text-body-1 text-medium-emphasis">
        de {{ formatTime(start) }} à {{ formatTime(end) }}
      </div>

      <VAlert
        v-if="removeError"
        type="error"
        variant="tonal"
        density="compact"
        class="mt-4"
      >
        {{ removeError }}
      </VAlert>

      <VAlert
        v-if="reservation.status === 'cancelled' && reservation.cancel_reason"
        type="error"
        variant="tonal"
        density="compact"
        class="mt-4"
      >
        Annulée : {{ reservation.cancel_reason }}
      </VAlert>

      <VList
        density="compact"
        class="pa-0 mt-4 bg-transparent"
      >
        <VListItem class="px-0">
          <template #prepend>
            <VIcon
              icon="ri-group-line"
              class="me-3"
            />
          </template>
          <VListItemSubtitle>Couverts</VListItemSubtitle>
          <VListItemTitle>{{ coversLabel(reservation.party_size) }}</VListItemTitle>
        </VListItem>
        <VListItem class="px-0">
          <template #prepend>
            <VIcon
              icon="ri-layout-grid-line"
              class="me-3"
            />
          </template>
          <VListItemSubtitle>Table</VListItemSubtitle>
          <VListItemTitle>{{ tableLabel }}</VListItemTitle>
        </VListItem>
        <VListItem class="px-0">
          <template #prepend>
            <VIcon
              icon="ri-phone-line"
              class="me-3"
            />
          </template>
          <VListItemSubtitle>Téléphone</VListItemSubtitle>
          <VListItemTitle>
            <a
              v-if="phone"
              :href="phone.href"
              class="text-primary text-decoration-none"
            >{{ phone.text }}</a>
            <span v-else>Non renseigné</span>
          </VListItemTitle>
        </VListItem>
        <VListItem
          v-if="reservation.customer_email"
          class="px-0"
        >
          <template #prepend>
            <VIcon
              icon="ri-mail-line"
              class="me-3"
            />
          </template>
          <VListItemSubtitle>E-mail</VListItemSubtitle>
          <VListItemTitle class="text-wrap">
            {{ reservation.customer_email }}
          </VListItemTitle>
        </VListItem>
        <VListItem
          v-if="reservation.notes"
          class="px-0"
        >
          <template #prepend>
            <VIcon
              icon="ri-sticky-note-line"
              class="me-3"
            />
          </template>
          <VListItemSubtitle>Notes</VListItemSubtitle>
          <VListItemTitle class="text-wrap notes">
            {{ reservation.notes }}
          </VListItemTitle>
        </VListItem>
      </VList>

      <template v-if="reservation.invites.length">
        <h3 class="text-subtitle-1 font-weight-medium mt-5 mb-1">
          Invités
        </h3>
        <ul class="pa-0 ma-0 text-body-2">
          <li
            v-for="guest in reservation.invites"
            :key="guest.id"
            class="py-1"
          >
            {{ guest.name || 'Invité' }}<span
              v-if="guest.is_vegetarian"
              class="text-medium-emphasis"
            > · végétarien</span>
          </li>
        </ul>
      </template>

      <h3 class="text-subtitle-1 font-weight-medium mt-5 mb-2">
        Suivi
      </h3>
      <VTimeline
        density="compact"
        side="end"
        align="start"
        truncate-line="both"
      >
        <VTimelineItem
          dot-color="secondary"
          size="x-small"
        >
          <div class="font-weight-medium">
            Réservation enregistrée
          </div>
          <div class="text-caption text-medium-emphasis">
            {{ formatDateTime(reservation.created_at) }}
          </div>
        </VTimelineItem>
        <VTimelineItem
          v-if="reservation.confirmed_at"
          :dot-color="presentStatus('confirmed').color"
          size="x-small"
        >
          <div class="font-weight-medium">
            Confirmée
          </div>
          <div class="text-caption text-medium-emphasis">
            {{ formatDateTime(reservation.confirmed_at) }}
          </div>
        </VTimelineItem>
        <VTimelineItem
          v-if="reservation.checked_in_at"
          :dot-color="presentStatus('checked_in').color"
          size="x-small"
        >
          <div class="font-weight-medium">
            Arrivée du client
          </div>
          <div class="text-caption text-medium-emphasis">
            {{ formatDateTime(reservation.checked_in_at) }}
          </div>
        </VTimelineItem>
        <VTimelineItem
          v-if="reservation.cancelled_at"
          :dot-color="presentStatus('cancelled').color"
          size="x-small"
        >
          <div class="font-weight-medium">
            Annulée
          </div>
          <div class="text-caption text-medium-emphasis">
            {{ formatDateTime(reservation.cancelled_at) }}
          </div>
        </VTimelineItem>
      </VTimeline>

      <div class="d-flex flex-wrap gap-2 mt-6">
        <VBtn
          v-if="reservation.status === 'pending'"
          color="primary"
          prepend-icon="ri-checkbox-circle-line"
          :loading="confirming"
          :disabled="busy && !confirming"
          @click="confirmReservation()"
        >
          Confirmer
        </VBtn>
        <VBtn
          v-if="canCheckIn"
          :color="reservation.status === 'pending' ? undefined : 'primary'"
          :variant="reservation.status === 'pending' ? 'tonal' : 'flat'"
          prepend-icon="ri-user-received-line"
          :loading="checkingIn"
          :disabled="busy && !checkingIn"
          @click="checkIn()"
        >
          Arrivée
        </VBtn>
        <VBtn
          v-if="canEdit"
          variant="outlined"
          color="secondary"
          prepend-icon="ri-edit-line"
          :disabled="busy"
          @click="emit('edit', reservation)"
        >
          Modifier
        </VBtn>
        <VBtn
          v-if="open"
          variant="outlined"
          color="warning"
          prepend-icon="ri-calendar-close-line"
          :disabled="busy"
          @click="cancelOpen = true"
        >
          Annuler
        </VBtn>
        <VSpacer />
        <VBtn
          variant="text"
          color="error"
          prepend-icon="ri-delete-bin-line"
          :loading="removing"
          :disabled="busy && !removing"
          @click="removeReservation()"
        >
          Supprimer
        </VBtn>
      </div>
    </div>
  </VNavigationDrawer>

  <CancelDialog
    v-model="cancelOpen"
    :reservation="reservation"
    @cancelled="emit('changed')"
  />
</template>

<style scoped>
.notes {
  white-space: pre-line;
}
</style>
