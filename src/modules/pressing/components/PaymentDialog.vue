<!--
  Encaissement d'un paiement (partiel ou total) sur une commande : montant pré-rempli au reste à
  payer et refusé au-delà, moyen de paiement en tuiles, référence facultative.
-->
<script setup lang="ts">
import { pressingApi } from '../api'
import { MODES_PAIEMENT, MODE_PAIEMENT_INFO } from '../commandes'
import { pressingError, toInt } from '../labels'
import type { Commande, PaiementMode } from '../types'
import { useSubmit } from '@/composables/useSubmit'
import { formatMoney } from '@/lib/format'
import { useTenantStore } from '@/stores/tenant.store'
import { useToast } from '@/stores/toast.store'

const props = defineProps<{ commande: Commande }>()
const emit = defineEmits<{ paid: [] }>()

const open = defineModel<boolean>({ required: true })

const tenant = useTenantStore()
const toast = useToast()

const amountText = ref('')
const mode = ref<PaiementMode>('especes')
const reference = ref('')
const received = ref('')

const amount = computed(() => toInt(amountText.value))

/** Espèces : la monnaie à rendre est calculée à l'affichage seulement, elle n'est pas enregistrée. */
const change = computed(() => {
  const given = toInt(received.value)

  if (mode.value !== 'especes' || given === null || amount.value === null)
    return null

  return given - amount.value
})

const amountRules = [
  (value: string) => (toInt(value) !== null && Number(value) > 0) || 'Saisissez un montant entier en FCFA, supérieur à 0.',
  (value: string) => Number(value) <= props.commande.reste_a_payer || `Le montant dépasse le reste à payer de ${formatMoney(props.commande.reste_a_payer)}.`,
]

const submission = useSubmit(async () => {
  if (!tenant.currentId || amount.value === null)
    throw new Error('no amount')

  return pressingApi.pay(tenant.currentId, props.commande.id, {
    montant: amount.value,
    mode: mode.value,
    reference: reference.value.trim() || null,
  })
})

watch(open, isOpen => {
  if (isOpen) {
    amountText.value = String(props.commande.reste_a_payer)
    mode.value = 'especes'
    reference.value = ''
    received.value = ''
    submission.reset()
  }
})

/** Le dialogue est la confirmation : un seul bouton « Encaisser », verrouillé pendant l'envoi. */
async function save() {
  const done = await submission.submit()

  if (done) {
    toast.success(`Paiement de ${formatMoney(done.montant)} enregistré.`)
    open.value = false
    emit('paid')
  }
}

const partial = computed(() => amount.value !== null && amount.value > 0 && amount.value < props.commande.reste_a_payer)
</script>

<template>
  <AppFormDialog
    v-model="open"
    title="Encaisser un paiement"
    :subtitle="`${commande.numero} · ${commande.client_nom}`"
    icon="ri-hand-coin-line"
    submit-label="Encaisser"
    :loading="submission.pending.value"
    :error="submission.error.value ? pressingError(submission.error.value) : ''"
    :confirm="false"
    @submit="save"
  >
    <div class="d-flex flex-wrap justify-space-between gap-2 mb-5 pa-3 balance">
      <span>Total de la commande : <strong><AppMoney :amount="commande.montant_total" /></strong></span>
      <span>Déjà payé : <strong><AppMoney :amount="commande.montant_paye" /></strong></span>
      <span class="text-warning">Reste à payer : <strong><AppMoney :amount="commande.reste_a_payer" /></strong></span>
    </div>

    <VTextField
      v-model="amountText"
      label="Montant encaissé (FCFA)"
      prepend-inner-icon="ri-money-dollar-circle-line"
      suffix="FCFA"
      inputmode="numeric"
      autocomplete="off"
      :rules="amountRules"
      :hint="partial ? `Paiement partiel : il restera ${formatMoney(commande.reste_a_payer - (amount ?? 0))} à payer.` : 'Le reste à payer est proposé ; vous pouvez le réduire pour un acompte.'"
      persistent-hint
      data-testid="pay-montant"
    />

    <div class="text-subtitle-2 mt-5 mb-2">
      Moyen de paiement
    </div>
    <div
      class="modes"
      role="radiogroup"
      aria-label="Moyen de paiement"
    >
      <button
        v-for="item in MODES_PAIEMENT"
        :key="item"
        type="button"
        role="radio"
        class="mode pa-3"
        :class="{ 'mode--on': mode === item }"
        :aria-checked="mode === item"
        :data-testid="`pay-mode-${item}`"
        @click="mode = item"
      >
        <VIcon
          :icon="MODE_PAIEMENT_INFO[item].icon"
          size="26"
        />
        <span class="text-body-2 font-weight-medium">{{ MODE_PAIEMENT_INFO[item].label }}</span>
      </button>
    </div>

    <VTextField
      v-if="mode === 'especes'"
      v-model="received"
      label="Montant reçu (facultatif)"
      prepend-inner-icon="ri-hand-coin-line"
      suffix="FCFA"
      inputmode="numeric"
      autocomplete="off"
      class="mt-5"
      :hint="change === null ? 'Saisissez le montant remis par le client pour afficher la monnaie à rendre.' : ''"
      persistent-hint
      data-testid="pay-recu"
    />
    <div
      v-if="change !== null"
      class="change mt-2 pa-3"
      :class="{ 'change--short': change < 0 }"
      data-testid="pay-monnaie"
    >
      <template v-if="change >= 0">
        Monnaie à rendre : <strong><AppMoney :amount="change" /></strong>
      </template>
      <template v-else>
        Montant reçu insuffisant : il manque <strong><AppMoney :amount="-change" /></strong>
      </template>
    </div>

    <VTextField
      v-model="reference"
      label="Référence (facultative)"
      prepend-inner-icon="ri-hashtag"
      placeholder="Numéro de transaction Mobile Money, reçu…"
      autocomplete="off"
      class="mt-5"
      maxlength="100"
      data-testid="pay-reference"
    />
  </AppFormDialog>
</template>

<style scoped>
.balance {
  border-radius: 10px;
  background: rgba(var(--v-theme-on-surface), 0.04);
}

.modes {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
  gap: 10px;
}

.mode {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 12px;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  transition: border-color 0.12s ease, background-color 0.12s ease;
}

.mode:hover {
  background: rgba(var(--v-theme-on-surface), var(--v-hover-opacity));
}

.mode--on,
.mode--on:hover {
  border-color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.1);
  color: rgb(var(--v-theme-primary));
}

.change {
  border-radius: 10px;
  background: rgba(var(--v-theme-success), 0.1);
}

.change--short {
  background: rgba(var(--v-theme-error), 0.1);
}

.mode:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 1px;
}
</style>
