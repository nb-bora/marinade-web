<!-- Création du solde d'une journée pour un abonnement. -->
<script setup lang="ts">
import { platformApi } from '../api'
import type { Subscription, Tier } from '../types'
import { useSubmit } from '@/composables/useSubmit'
import { useToast } from '@/stores/toast.store'

const props = defineProps<{ subscription: Subscription | null; tier: Tier | null }>()
const emit = defineEmits<{ saved: [] }>()
const open = defineModel<boolean>({ required: true })

const toast = useToast()

const day = ref('')
const initial = ref('')
const used = ref('0')

const { submit, pending, message, apiError, reset } = useSubmit(async () => {
  if (!props.subscription)
    return

  await platformApi.createBalance(props.subscription.id, {
    subscription_id: props.subscription.id,
    balance_date: day.value,
    initial_balance_fcfa: Number(initial.value),
    used_balance_fcfa: Number(used.value),
  })

  toast.success('Solde créé.')
  open.value = false
  emit('saved')
})

watch(open, isOpen => {
  if (!isOpen)
    return

  reset()
  day.value = new Date().toISOString().slice(0, 10)
  initial.value = props.tier ? String(props.tier.daily_limit_fcfa) : ''
  used.value = '0'
})

const dayRules = [(value: string) => !!value || 'Indiquez la date du solde.']

const amountRules = (text: string) => [
  (value: string) => value.trim() !== '' || text,
  (value: string) => /^\d+$/.test(value.trim()) || 'Saisissez un montant entier, sans décimales.',
]
</script>

<template>
  <AppFormDialog
    v-model="open"
    title="Nouveau solde"
    subtitle="Le montant de l'offre encaissable ce jour-là, et ce qui est déjà consommé."
    icon="ri-wallet-3-line"
    :loading="pending"
    :error="message"
    @submit="submit"
  >
    <VRow>
      <VCol cols="12">
        <VTextField
          v-model="day"
          type="date"
          label="Date"
          prepend-inner-icon="ri-calendar-line"
          :rules="dayRules"
          :error-messages="apiError?.fieldMessage('balance_date')"
        />
      </VCol>
      <VCol
        cols="12"
        sm="6"
      >
        <VTextField
          v-model="initial"
          label="Solde de départ"
          prepend-inner-icon="ri-money-dollar-circle-line"
          suffix="FCFA"
          inputmode="numeric"
          :rules="amountRules('Saisissez le solde de départ.')"
          :error-messages="apiError?.fieldMessage('initial_balance_fcfa')"
        />
      </VCol>
      <VCol
        cols="12"
        sm="6"
      >
        <VTextField
          v-model="used"
          label="Déjà consommé"
          prepend-inner-icon="ri-money-dollar-circle-line"
          suffix="FCFA"
          inputmode="numeric"
          :rules="amountRules('Saisissez le montant consommé.')"
          :error-messages="apiError?.fieldMessage('used_balance_fcfa')"
        />
      </VCol>
    </VRow>
  </AppFormDialog>
</template>
