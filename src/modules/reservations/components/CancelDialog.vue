<!-- Confirmation d'annulation d'une réservation : le serveur exige un motif. -->
<script setup lang="ts">
import { reservationsApi } from '../api'
import type { Reservation } from '../types'
import { useSubmit } from '@/composables/useSubmit'
import { useToast } from '@/stores/toast.store'

const props = defineProps<{ reservation: Reservation | null }>()
const emit = defineEmits<{ cancelled: [] }>()
const open = defineModel<boolean>({ required: true })

const toast = useToast()
const reason = ref('')

const { submit, pending, message, reset } = useSubmit(async () => {
  if (!props.reservation)
    return

  await reservationsApi.cancel(props.reservation.id, reason.value.trim())
  toast.success('Réservation annulée.')
  open.value = false
  emit('cancelled')
})

watch(open, isOpen => {
  if (isOpen) {
    reset()
    reason.value = ''
  }
})

const rules = [(value: string) => value.trim().length > 0 || 'Indiquez le motif de l\'annulation.']
</script>

<template>
  <AppFormDialog
    v-model="open"
    title="Annuler la réservation ?"
    :subtitle="reservation ? `Réservation de ${reservation.customer_name}. Le client n'est pas prévenu automatiquement.` : undefined"
    submit-label="Annuler la réservation"
    icon="ri-calendar-close-line"
    danger
    :max-width="480"
    :loading="pending"
    :error="message"
    @submit="submit"
  >
    <VTextField
      v-model="reason"
      label="Motif"
      placeholder="Le client a prévenu, changement de programme..."
      :rules="rules"
      maxlength="500"
      autofocus
    />
  </AppFormDialog>
</template>
