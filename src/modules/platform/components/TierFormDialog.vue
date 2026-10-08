<!-- Création et modification d'une offre d'abonnement. -->
<script setup lang="ts">
import { platformApi } from '../api'
import type { Tier } from '../types'
import { useSubmit } from '@/composables/useSubmit'
import { useToast } from '@/stores/toast.store'

const props = defineProps<{ tier: Tier | null }>()
const emit = defineEmits<{ saved: [] }>()
const open = defineModel<boolean>({ required: true })

const toast = useToast()

const name = ref('')
const dailyLimit = ref('')
const monthly = ref('')
const annual = ref('')
const active = ref(true)

const isEdit = computed(() => props.tier !== null)

const { submit, pending, message, apiError, reset } = useSubmit(async () => {
  const body = {
    name: name.value.trim(),
    daily_limit_fcfa: Number(dailyLimit.value),
    monthly_price_fcfa: Number(monthly.value),
    annual_price_fcfa: Number(annual.value),
  }

  if (props.tier)
    await platformApi.updateTier(props.tier.id, { ...body, is_active: active.value })
  else
    await platformApi.createTier(body)

  toast.success(isEdit.value ? 'Offre modifiée.' : 'Offre créée.')
  open.value = false
  emit('saved')
})

watch(open, isOpen => {
  if (!isOpen)
    return

  reset()
  name.value = props.tier?.name ?? ''
  dailyLimit.value = props.tier ? String(props.tier.daily_limit_fcfa) : ''
  monthly.value = props.tier ? String(props.tier.monthly_price_fcfa) : ''
  annual.value = props.tier ? String(props.tier.annual_price_fcfa) : ''
  active.value = props.tier?.is_active ?? true
})

const nameRules = [(value: string) => value.trim().length > 0 || 'Donnez un nom à l\'offre.']

const amountRules = (text: string) => [
  (value: string) => value.trim() !== '' || text,
  (value: string) => /^\d+$/.test(value.trim()) || 'Saisissez un montant entier, sans décimales.',
]
</script>

<template>
  <AppFormDialog
    v-model="open"
    :title="isEdit ? 'Modifier l\'offre' : 'Nouvelle offre'"
    subtitle="Les montants sont en FCFA."
    icon="ri-price-tag-3-line"
    :loading="pending"
    :error="message"
    @submit="submit"
  >
    <VRow>
      <VCol cols="12">
        <VTextField
          v-model="name"
          label="Nom de l'offre"
          prepend-inner-icon="ri-vip-crown-line"
          placeholder="Essentiel"
          :rules="nameRules"
          :error-messages="apiError?.fieldMessage('name')"
          maxlength="100"
          autofocus
        />
      </VCol>
      <VCol cols="12">
        <VTextField
          v-model="dailyLimit"
          label="Plafond journalier"
          prepend-inner-icon="ri-money-dollar-circle-line"
          suffix="FCFA"
          inputmode="numeric"
          hint="Montant maximal encaissable par jour avec cette offre."
          :rules="amountRules('Saisissez le plafond journalier.')"
          :error-messages="apiError?.fieldMessage('daily_limit_fcfa')"
        />
      </VCol>
      <VCol
        cols="12"
        sm="6"
      >
        <VTextField
          v-model="monthly"
          label="Prix mensuel"
          prepend-inner-icon="ri-money-dollar-circle-line"
          suffix="FCFA"
          inputmode="numeric"
          :rules="amountRules('Saisissez le prix mensuel.')"
          :error-messages="apiError?.fieldMessage('monthly_price_fcfa')"
        />
      </VCol>
      <VCol
        cols="12"
        sm="6"
      >
        <VTextField
          v-model="annual"
          label="Prix annuel"
          prepend-inner-icon="ri-money-dollar-circle-line"
          suffix="FCFA"
          inputmode="numeric"
          :rules="amountRules('Saisissez le prix annuel.')"
          :error-messages="apiError?.fieldMessage('annual_price_fcfa')"
        />
      </VCol>
      <VCol
        v-if="isEdit"
        cols="12"
      >
        <VSwitch
          v-model="active"
          label="Offre active"
          hint="Une offre désactivée n'est plus proposée pour de nouveaux abonnements."
          persistent-hint
          color="primary"
        />
      </VCol>
    </VRow>
  </AppFormDialog>
</template>
