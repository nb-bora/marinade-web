<!--
  Annulation d'une réservation avec son motif. Le client reçoit un e-mail seulement si son adresse
  est connue ; le texte le dit, sans promettre autre chose.
-->
<script setup lang="ts">
import { reservationsApi } from '../api'
import { messageOf } from '../labels'
import type { Reservation } from '../types'
import { useConfirm } from '@/composables/useConfirm'
import { useSubmit } from '@/composables/useSubmit'
import { useToast } from '@/stores/toast.store'

const props = defineProps<{ reservation: Reservation | null }>()
const emit = defineEmits<{ cancelled: [reservation: Reservation] }>()
const open = defineModel<boolean>({ required: true })

const toast = useToast()
const reason = ref('')

const askConfirm = useConfirm()

const { submit, pending, apiError, reset } = useSubmit(async () => {
  if (!props.reservation)
    return

  const accepted = await askConfirm({
    title: 'Annuler cette réservation ?',
    text: 'La réservation sera annulée. Cette action ne se défait pas d\'un clic.',
    confirmLabel: 'Annuler la réservation',
    danger: true,
  })

  if (!accepted)
    return

  const saved = await reservationsApi.cancel(props.reservation.id, reason.value.trim())

  toast.success('Réservation annulée.')
  open.value = false
  emit('cancelled', saved)
})

watch(open, isOpen => {
  if (isOpen) {
    reason.value = ''
    reset()
  }
})

const rules = {
  reason: [(value: string) => value.trim().length > 0 || 'Indiquez le motif de l\'annulation.'],
}

const errorMessage = computed(() => (apiError.value ? messageOf(apiError.value) : ''))
</script>

<template>
  <AppFormDialog
    v-model="open"
    title="Annuler la réservation ?"
    :subtitle="props.reservation ? `${props.reservation.customer_name}, ${props.reservation.party_size} couvert${props.reservation.party_size > 1 ? 's' : ''}` : ''"
    submit-label="Annuler la réservation"
    icon="ri-close-circle-line"
    :confirm="false"
    :loading="pending"
    :error="errorMessage"
    :max-width="560"
    @submit="submit"
  >
    <p class="text-body-2 mb-4">
      La table est libérée si rien d'autre ne la prend dans les quatre heures. Si l'adresse e-mail du client est connue, il reçoit un message d'annulation.
    </p>
    <VTextarea
      v-model="reason"
      label="Motif de l'annulation"
      prepend-inner-icon="ri-chat-1-line"
      placeholder="Client empêché, doublon, changement de date..."
      rows="2"
      auto-grow
      maxlength="500"
      :rules="rules.reason"
      autofocus
    />
  </AppFormDialog>
</template>
