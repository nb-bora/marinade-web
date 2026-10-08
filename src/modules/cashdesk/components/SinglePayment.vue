<!-- Encaissement avec un seul moyen : tuiles, montant au pavé numérique, rendu monnaie, téléphone. -->
<script setup lang="ts">
import { METHODS } from '../labels'
import { cashSuggestions } from '../money'
import type { PaymentMethod } from '../types'
import MethodTiles from './MethodTiles.vue'
import NumPad from './NumPad.vue'
import { formatMoney } from '@/lib/format'
import { isValidCameroonMobile, nationalDigits, operatorOf } from '@/lib/phone'

export interface SinglePayload {
  method: PaymentMethod

  /** Montant réellement encaissé sur la facture. */
  amount: number

  /** Téléphone du payeur (international) ou référence saisie, regroupés en une seule référence. */
  reference: string | null

  /** Espèces : montant remis par le client et monnaie rendue. */
  tendered: number | null
  change: number
}

const props = defineProps<{
  due: number
  loading?: boolean
  error?: string
}>()

const emit = defineEmits<{ submit: [payload: SinglePayload] }>()

const method = ref<PaymentMethod>('CASH')
const entered = ref(0)
const phone = ref('')
const reference = ref('')
const triedToSubmit = ref(false)

const kind = computed(() => METHODS[method.value].kind)
const isCash = computed(() => kind.value === 'cash')
const isMobile = computed(() => kind.value === 'mobile')

// Espèces : on saisit ce que le client remet. Autres moyens : on saisit ce que l'on débite, par défaut le reste dû.
watch(method, () => {
  entered.value = isCash.value ? 0 : props.due
  triedToSubmit.value = false
}, { immediate: true })

/** Le reste dû bouge quand quelqu'un d'autre encaisse : un montant qui le suivait continue de le suivre. */
watch(() => props.due, (next, previous) => {
  if (!isCash.value && entered.value === previous)
    entered.value = next
})

const amount = computed(() => Math.min(entered.value, props.due))
const change = computed(() => isCash.value ? Math.max(entered.value - props.due, 0) : 0)
const tooMuch = computed(() => !isCash.value && entered.value > props.due)
const remaining = computed(() => Math.max(props.due - amount.value, 0))

const suggestions = computed(() => cashSuggestions(props.due))

const national = computed(() => nationalDigits(phone.value))
const phoneValid = computed(() => isValidCameroonMobile(national.value))

const operatorHint = computed(() => {
  if (!isMobile.value || !phoneValid.value)
    return ''

  const operator = operatorOf(national.value)

  if (method.value === 'MTN_MOMO' && operator === 'Orange')
    return 'Ce numéro est un numéro Orange : choisissez plutôt Orange Money.'
  if (method.value === 'ORANGE_MONEY' && operator === 'MTN')
    return 'Ce numéro est un numéro MTN : choisissez plutôt MTN MoMo.'

  return ''
})

const phoneError = computed(() => triedToSubmit.value && isMobile.value && !phoneValid.value
  ? 'Saisissez le numéro à 9 chiffres du payeur.'
  : '')

const canSubmit = computed(() => amount.value > 0 && !tooMuch.value && props.due > 0)

function submit() {
  triedToSubmit.value = true

  if (!canSubmit.value || (isMobile.value && !phoneValid.value))
    return

  const note = reference.value.trim()
  const parts = [isMobile.value ? phone.value : '', note].filter(Boolean)

  emit('submit', {
    method: method.value,
    amount: amount.value,
    reference: parts.length ? parts.join(' · ') : null,
    tendered: isCash.value ? entered.value : null,
    change: change.value,
  })
}

/** Après un encaissement, la saisie repart à zéro. */
function reset() {
  entered.value = isCash.value ? 0 : props.due
  phone.value = ''
  reference.value = ''
  triedToSubmit.value = false
}

defineExpose({ reset })
</script>

<template>
  <form
    novalidate
    @submit.prevent="submit"
  >
    <MethodTiles v-model="method" />

    <VRow class="mt-4">
      <VCol
        cols="12"
        md="6"
        class="d-flex flex-column gap-3"
      >
        <div
          class="amount-display pa-4"
          :class="{ 'amount-display--error': tooMuch }"
        >
          <div class="text-body-2 text-medium-emphasis">
            {{ isCash ? 'Montant remis par le client' : 'Montant à encaisser' }}
          </div>
          <div
            class="amount-display__value tabular-nums text-no-wrap"
            aria-live="polite"
          >
            {{ formatMoney(entered) }}
          </div>
        </div>

        <div
          v-if="isCash"
          class="change-box pa-4"
          :class="{ 'change-box--due': entered > 0 && entered < due }"
        >
          <template v-if="entered === 0">
            <span class="text-body-1 text-medium-emphasis">Saisissez ce que le client vous remet.</span>
          </template>
          <template v-else-if="entered < due">
            <span class="text-body-1">Il restera à payer</span>
            <span class="text-h5 font-weight-bold tabular-nums">{{ formatMoney(remaining) }}</span>
          </template>
          <template v-else>
            <span class="text-body-1">Monnaie à rendre</span>
            <span class="text-h4 font-weight-bold tabular-nums text-success">{{ formatMoney(change) }}</span>
          </template>
        </div>

        <VAlert
          v-else-if="tooMuch"
          type="error"
          variant="tonal"
          density="compact"
        >
          Le montant dépasse le reste dû ({{ formatMoney(due) }}).
        </VAlert>

        <div class="d-flex flex-wrap gap-2">
          <template v-if="isCash">
            <VBtn
              v-for="value in suggestions"
              :key="value"
              size="large"
              variant="outlined"
              color="secondary"
              @click="entered = value"
            >
              {{ value === due ? 'Exact' : formatMoney(value) }}
            </VBtn>
          </template>
          <template v-else>
            <VBtn
              size="large"
              variant="outlined"
              color="secondary"
              @click="entered = due"
            >
              Tout le reste
            </VBtn>
            <VBtn
              size="large"
              variant="outlined"
              color="secondary"
              :disabled="due < 2"
              @click="entered = Math.floor(due / 2)"
            >
              Moitié
            </VBtn>
          </template>
          <VBtn
            size="large"
            variant="text"
            color="secondary"
            :disabled="entered === 0"
            @click="entered = 0"
          >
            Effacer
          </VBtn>
        </div>

        <AppPhoneField
          v-if="isMobile"
          v-model="phone"
          label="Téléphone du payeur"
          required
          :error-messages="phoneError"
        />
        <VAlert
          v-if="operatorHint"
          type="warning"
          variant="tonal"
          density="compact"
        >
          {{ operatorHint }}
        </VAlert>

        <VTextField
          v-if="!isCash"
          v-model="reference"
          :label="isMobile ? 'Référence de l\'opérateur (facultatif)' : 'Référence du paiement (facultatif)'"
          maxlength="120"
          autocomplete="off"
        />
      </VCol>

      <VCol
        cols="12"
        md="6"
      >
        <NumPad v-model="entered" />
      </VCol>
    </VRow>

    <VAlert
      v-if="error"
      type="error"
      variant="tonal"
      class="mt-4"
    >
      {{ error }}
    </VAlert>

    <VBtn
      type="submit"
      color="primary"
      size="x-large"
      block
      class="mt-4 submit-btn"
      prepend-icon="ri-check-double-line"
      :loading="loading"
      :disabled="!canSubmit"
    >
      Encaisser {{ formatMoney(amount) }}
    </VBtn>
  </form>
</template>

<style scoped>
.amount-display {
  border: 1.5px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 12px;
  background: rgba(var(--v-theme-on-surface), 0.03);
}

.amount-display--error {
  border-color: rgb(var(--v-theme-error));
}

.amount-display__value {
  font-size: 2.25rem;
  font-weight: 700;
  line-height: 1.2;
}

.change-box {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  border-radius: 12px;
  background: rgba(var(--v-theme-success), 0.1);
}

.change-box--due {
  background: rgba(var(--v-theme-warning), 0.14);
}

.submit-btn {
  block-size: 60px !important;
  font-size: 1.125rem;
}

@media (max-width: 599px) {
  .amount-display__value {
    font-size: 1.875rem;
  }
}
</style>
