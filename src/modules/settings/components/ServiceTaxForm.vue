<script setup lang="ts">
import { useRestaurantUpdate } from '../composables/useRestaurantUpdate'
import { useSettingsDraft } from '../composables/useSettingsDraft'
import { CURRENCIES, DEFAULT_VAT_RATE, MAX_RATE, SERVICE_RATE_PRESETS, parseDecimal, ratePercent } from '../labels'
import type { Restaurant, RestaurantUpdate } from '../types'
import SettingsActions from './SettingsActions.vue'

const props = defineProps<{
  restaurant: Restaurant
  canEdit: boolean
}>()

const emit = defineEmits<{ saved: [restaurant: Restaurant] }>()

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** TVA définie par le restaurant, ou celle que le serveur applique par défaut. */
function vatOf(restaurant: Restaurant): string {
  const taxes = restaurant.config_jsonb?.taxes
  const configured = isRecord(taxes) ? taxes.tva : undefined

  return String(Number(configured ?? DEFAULT_VAT_RATE))
}

const draftOf = (restaurant: Restaurant) => ({
  service: String(Number(restaurant.taux_service)),
  vat: vatOf(restaurant),
  currency: restaurant.currency,
})

const { draft, dirty, changed, changedKeys, restored, discard } = useSettingsDraft('service', () => props.restaurant, draftOf)

const form = ref()

const { save, pending, errorMessage, fieldMessage, reset } = useRestaurantUpdate(
  () => props.restaurant.id,
  restaurant => emit('saved', restaurant),
)

const FIELD_LABELS = { service: 'taux de service', vat: 'TVA', currency: 'devise' } as const

const changes = computed(() => changedKeys.value.map(key => FIELD_LABELS[key]))

const currencies = computed(() =>
  CURRENCIES.some(item => item.value === draft.value.currency)
    ? CURRENCIES
    : [...CURRENCIES, { value: draft.value.currency, title: draft.value.currency }],
)

const rateOf = (text: string) => parseDecimal(text) ?? 0
const clamp = (value: number) => Math.min(MAX_RATE, Math.max(0, value))

const serviceRate = computed(() => rateOf(draft.value.service))
const vatRate = computed(() => rateOf(draft.value.vat))

// Exemple chiffré : le plat à 10 000, avec service puis TVA.
const SAMPLE = 10000
const serviceAmount = computed(() => Math.round(SAMPLE * serviceRate.value) / 100)
const vatAmount = computed(() => Math.round((SAMPLE + serviceAmount.value) * vatRate.value) / 100)
const total = computed(() => SAMPLE + serviceAmount.value + vatAmount.value)
const percentText = (value: number) => `${value.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} %`

const rules = {
  service: ratePercent('Taux de service'),
  vat: ratePercent('TVA'),
}

async function submit() {
  if (!props.canEdit || !dirty.value)
    return

  if (!(await form.value?.validate())?.valid)
    return

  const patch: RestaurantUpdate = {}

  if (changed('service'))
    patch.taux_service = rateOf(draft.value.service)

  if (changed('currency'))
    patch.currency = draft.value.currency.trim().toUpperCase()

  if (changed('vat')) {
    // Les autres réglages avancés du restaurant sont conservés tels quels.
    const existing = props.restaurant.config_jsonb ?? {}
    const taxes = isRecord(existing.taxes) ? existing.taxes : {}

    patch.config_jsonb = { ...existing, taxes: { ...taxes, tva: rateOf(draft.value.vat) } }
  }

  await save(patch, 'Service et taxes enregistrés.')
}

function cancel() {
  discard()
  reset()
  form.value?.resetValidation()
}

defineExpose({
  dirty,
  pending,
  invalid: computed(() => form.value?.isValid === false),
  submit,
  cancel,
})
</script>

<template>
  <VForm
    ref="form"
    validate-on="input"
    @submit.prevent="submit"
  >
    <VRow>
      <VCol
        cols="12"
        lg="7"
      >
        <VCard>
          <VCardItem>
            <template #prepend>
              <VAvatar
                variant="tonal"
                rounded
                color="primary"
              >
                <VIcon icon="ri-percent-line" />
              </VAvatar>
            </template>
            <VCardTitle>Service, TVA et devise</VCardTitle>
            <VCardSubtitle class="text-wrap">
              Appliqués automatiquement aux additions de ce restaurant.
            </VCardSubtitle>
          </VCardItem>
          <VCardText>
            <!-- Taux de service -->
            <div
              class="rate-block mb-6"
              :class="{ 'settings-changed--static': changed('service') }"
            >
              <div class="d-flex align-center justify-space-between gap-3 mb-1">
                <div>
                  <div class="text-subtitle-1 font-weight-medium">
                    Taux de service
                  </div>
                  <div class="text-body-2 text-medium-emphasis">
                    Pourboire ajouté à l'addition.
                  </div>
                </div>
                <VChip
                  color="primary"
                  variant="tonal"
                  label
                >
                  {{ percentText(serviceRate) }}
                </VChip>
              </div>
              <VSlider
                :model-value="clamp(serviceRate)"
                :min="0"
                :max="MAX_RATE"
                :step="0.5"
                color="primary"
                :readonly="!canEdit"
                :thumb-label="false"
                aria-label="Taux de service"
                @update:model-value="(value: number) => draft.service = String(value)"
              />
              <div class="d-flex flex-wrap align-center gap-3">
                <VTextField
                  v-model="draft.service"
                  label="Taux exact"
                  prepend-inner-icon="ri-percent-line"
                  suffix="%"
                  inputmode="decimal"
                  class="rate-input"
                  :rules="[rules.service]"
                  :error-messages="fieldMessage('taux_service')"
                  :readonly="!canEdit"
                />
                <div
                  v-if="canEdit"
                  class="d-flex flex-wrap gap-2"
                >
                  <VChip
                    v-for="preset in SERVICE_RATE_PRESETS"
                    :key="preset"
                    size="small"
                    :color="serviceRate === preset ? 'primary' : undefined"
                    :variant="serviceRate === preset ? 'flat' : 'outlined'"
                    @click="draft.service = String(preset)"
                  >
                    {{ preset }} %
                  </VChip>
                </div>
              </div>
            </div>

            <!-- TVA -->
            <div
              class="rate-block mb-6"
              :class="{ 'settings-changed--static': changed('vat') }"
            >
              <div class="d-flex align-center justify-space-between gap-3 mb-1">
                <div>
                  <div class="text-subtitle-1 font-weight-medium">
                    TVA
                  </div>
                  <div class="text-body-2 text-medium-emphasis">
                    Par défaut {{ percentText(DEFAULT_VAT_RATE) }} (Cameroun).
                  </div>
                </div>
                <VChip
                  color="primary"
                  variant="tonal"
                  label
                >
                  {{ percentText(vatRate) }}
                </VChip>
              </div>
              <VSlider
                :model-value="clamp(vatRate)"
                :min="0"
                :max="MAX_RATE"
                :step="0.25"
                color="primary"
                :readonly="!canEdit"
                :thumb-label="false"
                aria-label="TVA"
                @update:model-value="(value: number) => draft.vat = String(value)"
              />
              <VTextField
                v-model="draft.vat"
                label="Taux exact"
                prepend-inner-icon="ri-percent-line"
                suffix="%"
                inputmode="decimal"
                class="rate-input"
                :rules="[rules.vat]"
                :readonly="!canEdit"
              />
            </div>

            <VSelect
              v-model="draft.currency"
              :items="currencies"
              label="Devise"
              prepend-inner-icon="ri-money-dollar-circle-line"
              :readonly="!canEdit"
              :error-messages="fieldMessage('currency')"
              :class="{ 'settings-changed': changed('currency') }"
            />
          </VCardText>
        </VCard>
      </VCol>

      <VCol
        cols="12"
        lg="5"
      >
        <VCard class="preview-card">
          <VCardItem>
            <template #prepend>
              <VAvatar
                variant="tonal"
                rounded
                color="primary"
              >
                <VIcon icon="ri-receipt-line" />
              </VAvatar>
            </template>
            <VCardTitle>Prévisualisation</VCardTitle>
            <VCardSubtitle class="text-wrap">
              Un plat à <AppMoney
                :amount="SAMPLE"
                :currency="draft.currency"
              />, avec vos réglages.
            </VCardSubtitle>
          </VCardItem>
          <VCardText>
            <dl class="preview-lines">
              <div class="preview-line">
                <dt class="text-medium-emphasis">
                  Plat
                </dt>
                <dd>
                  <AppMoney
                    :amount="SAMPLE"
                    :currency="draft.currency"
                  />
                </dd>
              </div>
              <div class="preview-line">
                <dt class="text-medium-emphasis">
                  Service ({{ percentText(serviceRate) }})
                </dt>
                <dd>
                  <AppMoney
                    :amount="serviceAmount"
                    :currency="draft.currency"
                  />
                </dd>
              </div>
              <div class="preview-line">
                <dt class="text-medium-emphasis">
                  TVA ({{ percentText(vatRate) }})
                </dt>
                <dd>
                  <AppMoney
                    :amount="vatAmount"
                    :currency="draft.currency"
                  />
                </dd>
              </div>
            </dl>
            <VDivider class="my-3" />
            <div class="preview-line text-h6 font-weight-semibold">
              <span>Total</span>
              <AppMoney
                :amount="total"
                :currency="draft.currency"
              />
            </div>
            <p class="text-caption text-medium-emphasis mt-3 mb-0">
              Estimation : le service s'ajoute au prix du plat, puis la TVA s'applique sur le tout.
              Le calcul réel suit les articles de chaque commande.
            </p>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <SettingsActions
      :can-edit="canEdit"
      :dirty="dirty"
      :pending="pending"
      :restored="restored"
      :error-message="errorMessage"
      :changes="changes"
      @cancel="cancel"
    />
  </VForm>
</template>

<style scoped>
.rate-block {
  padding: 0.75rem;
  margin-inline: -0.75rem;
}

.rate-input {
  max-inline-size: 180px;
}

.preview-card {
  position: sticky;
  inset-block-start: 1rem;
}

.preview-lines {
  margin: 0;
}

.preview-line {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  margin-block-end: 0.5rem;
}

.preview-line dd {
  margin: 0;
}

@media (max-width: 1279px) {
  .preview-card {
    position: static;
  }
}
</style>
