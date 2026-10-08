<script setup lang="ts">
import { subscriptionApi } from '../api'
import { explainError } from '../labels'
import type { Subscription } from '../types'
import { useSubmit } from '@/composables/useSubmit'
import { formatMoney } from '@/lib/format'
import { useToast } from '@/stores/toast.store'

const props = defineProps<{
  subscription: Subscription

  /** Ce qu'il reste du plafond du jour. */
  remaining: number | null
}>()

const emit = defineEmits<{ recorded: [] }>()

const open = defineModel<boolean>({ required: true })

const toast = useToast()
const amount = ref<number | null>(null)
const description = ref('')
const posId = ref('')

/** Une clé par ouverture : si la réponse se perd, renvoyer le formulaire ne débite pas deux fois. */
let idempotencyKey = crypto.randomUUID()

watch(open, isOpen => {
  if (isOpen) {
    idempotencyKey = crypto.randomUUID()
    amount.value = null
    description.value = ''
    posId.value = ''
  }
})

const { submit, pending, error } = useSubmit(async () => {
  await subscriptionApi.record({
    subscription_id: props.subscription.id,
    restaurant_id: props.subscription.restaurant_id,
    amount_fcfa: Math.round(Number(amount.value)),
    description: description.value.trim() || null,
    pos_transaction_id: posId.value.trim() || null,
    idempotency_key: idempotencyKey,
  })

  toast.success('Achat imputé sur le plafond du jour.')
  open.value = false
  emit('recorded')
})

const message = computed(() => error.value ? explainError(error.value) : '')

const amountRule = (value: number | null) => {
  const number = Number(value)

  if (!(number > 0))
    return 'Indiquez un montant supérieur à 0.'

  return props.remaining === null || number <= props.remaining ? true : `Au plus ${formatMoney(props.remaining)} aujourd'hui.`
}
</script>

<template>
  <AppFormDialog
    v-model="open"
    title="Imputer un achat"
    :subtitle="remaining !== null ? `Il reste ${formatMoney(remaining)} sur le plafond du jour.` : 'Retire le montant du plafond du jour.'"
    icon="ri-shopping-bag-3-line"
    submit-label="Imputer l'achat"
    :loading="pending"
    :error="message"
    @submit="submit"
  >
    <VTextField
      v-model.number="amount"
      label="Montant"
      prepend-inner-icon="ri-money-dollar-circle-line"
      type="number"
      min="1"
      suffix="FCFA"
      :rules="[amountRule]"
      class="mb-3"
    />
    <VTextField
      v-model="description"
      label="Description (facultatif)"
      prepend-inner-icon="ri-file-text-line"
      placeholder="Approvisionnement du marché…"
      maxlength="500"
      class="mb-3"
    />
    <VTextField
      v-model="posId"
      label="Identifiant du terminal de paiement (facultatif)"
      prepend-inner-icon="ri-code-line"
      maxlength="100"
      hint="Permet de retrouver l'achat plus tard depuis la recherche."
      persistent-hint
    />
  </AppFormDialog>
</template>
