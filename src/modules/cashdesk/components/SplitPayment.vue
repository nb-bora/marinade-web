<!-- Paiement partagé : plusieurs moyens (et plusieurs payeurs) pour une même addition, tout ou rien. -->
<script setup lang="ts">
import { METHODS, METHOD_OPTIONS } from '../labels'
import { parseAmount, round2, wholeDue } from '../money'
import type { PaymentMethod } from '../types'
import { newUuid } from '../composables/useIdempotencyKey'
import { formatMoney } from '@/lib/format'
import { isValidCameroonMobile, nationalDigits } from '@/lib/phone'

export interface SplitPayload {
  items: { method: PaymentMethod; amount: number; reference: string | null }[]
  total: number
}

interface Part {
  id: string
  method: PaymentMethod
  amount: string
  phone: string
  reference: string
}

const props = defineProps<{
  due: number
  loading?: boolean
  error?: string
}>()

const emit = defineEmits<{ submit: [payload: SplitPayload] }>()

const MAX_PARTS = 8

const blank = (method: PaymentMethod): Part => ({ id: newUuid(), method, amount: '', phone: '', reference: '' })

const parts = ref<Part[]>([blank('CASH'), blank('MTN_MOMO')])
const triedToSubmit = ref(false)

const amountOf = (part: Part) => parseAmount(part.amount)
const isMobile = (part: Part) => METHODS[part.method].kind === 'mobile'
const phoneValid = (part: Part) => isValidCameroonMobile(nationalDigits(part.phone))

/** Ce que le client doit en francs entiers : les lignes se saisissent en francs entiers (voir `wholeDue`). */
const whole = computed(() => wholeDue(props.due))

const total = computed(() => parts.value.reduce((sum, part) => sum + amountOf(part), 0))
const left = computed(() => whole.value - total.value)

const phoneError = (part: Part) => triedToSubmit.value && isMobile(part) && !phoneValid(part)
  ? 'Numéro à 9 chiffres obligatoire.'
  : ''

const problem = computed(() => {
  if (total.value > whole.value)
    return `Le total dépasse le reste dû de ${formatMoney(total.value - whole.value)}.`

  return ''
})

const canSubmit = computed(() => props.due > 0 && total.value > 0 && total.value <= whole.value)

function addPart() {
  if (parts.value.length < MAX_PARTS)
    parts.value.push(blank('CASH'))
}

function removePart(id: string) {
  if (parts.value.length > 2)
    parts.value = parts.value.filter(part => part.id !== id)
}

/** Met ce qu'il reste à payer sur cette ligne (en tenant compte des autres). */
function fillRest(part: Part) {
  const others = total.value - amountOf(part)

  part.amount = String(Math.max(whole.value - others, 0))
}

/** Répartit le reste dû à parts égales (le reliquat va à la première ligne). */
function splitEvenly() {
  const count = parts.value.length
  const share = Math.floor(whole.value / count)

  parts.value.forEach((part, index) => {
    part.amount = String(index === 0 ? whole.value - share * (count - 1) : share)
  })
}

function submit() {
  triedToSubmit.value = true

  const filled = parts.value.filter(part => amountOf(part) > 0)

  if (!canSubmit.value)
    return

  // Une ligne sans montant est ignorée ; une ligne Mobile Money sans numéro valide bloque.
  if (filled.some(part => isMobile(part) && !phoneValid(part)))
    return

  const items = filled.map(part => {
    const reference = [isMobile(part) ? part.phone : '', part.reference.trim()].filter(Boolean).join(' · ')

    return { method: part.method, amount: amountOf(part), reference: reference || null }
  })

  // Le total atteint le reste dû en francs entiers : la fraction de franc est absorbée par la
  // dernière ligne, pour que l'addition soit réellement soldée.
  if (total.value === whole.value)
    items[items.length - 1].amount = round2(items[items.length - 1].amount + props.due - total.value)

  emit('submit', { total: round2(items.reduce((sum, item) => sum + item.amount, 0)), items })
}

function reset() {
  parts.value = [blank('CASH'), blank('MTN_MOMO')]
  triedToSubmit.value = false
}

defineExpose({ reset })
</script>

<template>
  <form
    novalidate
    @submit.prevent="submit"
  >
    <p class="text-body-1 text-medium-emphasis mb-4">
      Répartissez l'addition entre plusieurs moyens de paiement. Tout est enregistré en une seule fois : si l'un des règlements échoue, aucun n'est pris.
    </p>

    <div class="d-flex flex-column gap-3">
      <div
        v-for="(part, index) in parts"
        :key="part.id"
        class="part pa-3"
      >
        <div class="d-flex align-center justify-space-between mb-3">
          <span class="text-body-1 font-weight-medium">Paiement {{ index + 1 }}</span>
          <IconBtn
            v-if="parts.length > 2"
            :aria-label="`Retirer le paiement ${index + 1}`"
            @click="removePart(part.id)"
          >
            <VIcon icon="ri-delete-bin-line" />
          </IconBtn>
        </div>

        <VRow dense>
          <VCol
            cols="12"
            sm="6"
          >
            <VSelect
              v-model="part.method"
              :items="METHOD_OPTIONS"
              label="Moyen"
              :prepend-inner-icon="METHODS[part.method].icon"
              hide-details
            />
          </VCol>
          <VCol
            cols="12"
            sm="6"
          >
            <VTextField
              v-model="part.amount"
              label="Montant (FCFA)"
              inputmode="numeric"
              autocomplete="off"
              hide-details
              @update:model-value="part.amount = String(parseAmount($event) || '')"
            >
              <template #append-inner>
                <VBtn
                  size="small"
                  variant="text"
                  color="primary"
                  @click="fillRest(part)"
                >
                  Le reste
                </VBtn>
              </template>
            </VTextField>
          </VCol>
          <VCol
            v-if="isMobile(part)"
            cols="12"
          >
            <AppPhoneField
              v-model="part.phone"
              label="Téléphone du payeur"
              required
              :error-messages="phoneError(part)"
            />
          </VCol>
          <VCol
            v-if="METHODS[part.method].kind !== 'cash'"
            cols="12"
          >
            <VTextField
              v-model="part.reference"
              label="Référence (facultatif)"
              maxlength="120"
              autocomplete="off"
              hide-details
            />
          </VCol>
        </VRow>
      </div>
    </div>

    <div class="d-flex flex-wrap gap-2 mt-3">
      <VBtn
        variant="outlined"
        color="secondary"
        prepend-icon="ri-add-line"
        :disabled="parts.length >= MAX_PARTS"
        @click="addPart"
      >
        Ajouter un paiement
      </VBtn>
      <VBtn
        variant="outlined"
        color="secondary"
        prepend-icon="ri-equalizer-line"
        :disabled="due <= 0"
        @click="splitEvenly"
      >
        Parts égales
      </VBtn>
    </div>

    <div
      class="recap d-flex flex-wrap justify-space-between align-center gap-2 mt-4 pa-4"
      :class="{ 'recap--error': problem }"
    >
      <div>
        <div class="text-body-2 text-medium-emphasis">
          Total réparti
        </div>
        <div class="text-h5 font-weight-bold tabular-nums">
          {{ formatMoney(total) }}
        </div>
      </div>
      <div class="text-end">
        <div class="text-body-2 text-medium-emphasis">
          {{ left < 0 ? 'En trop' : 'Reste à répartir' }}
        </div>
        <div
          class="text-h5 font-weight-bold tabular-nums"
          :class="left < 0 ? 'text-error' : left === 0 ? 'text-success' : ''"
        >
          {{ formatMoney(Math.abs(left)) }}
        </div>
      </div>
    </div>

    <VAlert
      v-if="problem"
      type="error"
      variant="tonal"
      density="compact"
      class="mt-3"
    >
      {{ problem }}
    </VAlert>

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
      Encaisser {{ formatMoney(total) }}
    </VBtn>
  </form>
</template>

<style scoped>
.part {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 12px;
}

.recap {
  border-radius: 12px;
  background: rgba(var(--v-theme-on-surface), 0.04);
}

.recap--error {
  background: rgba(var(--v-theme-error), 0.1);
}

.submit-btn {
  block-size: 60px !important;
  font-size: 1.125rem;
}
</style>
