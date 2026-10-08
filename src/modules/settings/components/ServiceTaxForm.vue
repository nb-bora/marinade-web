<script setup lang="ts">
import { useRestaurantUpdate } from '../composables/useRestaurantUpdate'
import { CURRENCIES, DEFAULT_VAT_RATE, SERVICE_RATE_PRESETS, parseDecimal } from '../labels'
import type { Restaurant } from '../types'
import { useConfirm } from '@/composables/useConfirm'
import { formatMoney } from '@/lib/format'

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

  return String(configured ?? DEFAULT_VAT_RATE)
}

const draftOf = (restaurant: Restaurant) => ({
  service: String(Number(restaurant.taux_service)),
  currency: restaurant.currency,
  vat: vatOf(restaurant),
})

const draft = ref(draftOf(props.restaurant))
const form = ref()

watch(() => props.restaurant, restaurant => {
  draft.value = draftOf(restaurant)
})

const dirty = computed(() => JSON.stringify(draft.value) !== JSON.stringify(draftOf(props.restaurant)))

const percent = (label: string) => (value: unknown) => {
  const parsed = parseDecimal(value as string)

  return (parsed !== null && parsed >= 0 && parsed <= 100) || `${label} : un pourcentage entre 0 et 100.`
}

const currencies = computed(() =>
  CURRENCIES.some(item => item.value === draft.value.currency)
    ? CURRENCIES
    : [...CURRENCIES, { value: draft.value.currency, title: draft.value.currency }],
)

const confirm = useConfirm()

const { save, pending, errorMessage, reset } = useRestaurantUpdate(
  () => props.restaurant.id,
  restaurant => emit('saved', restaurant),
)

// Exemple chiffré : l'addition type que le gérant a en tête.
const SAMPLE = 10000
const serviceRate = computed(() => parseDecimal(draft.value.service) ?? 0)
const vatRate = computed(() => parseDecimal(draft.value.vat) ?? 0)
const serviceAmount = computed(() => Math.round(SAMPLE * serviceRate.value) / 100)

async function submit() {
  if (!(await form.value?.validate())?.valid)
    return

  if (!await confirm({
    title: 'Enregistrer le service et les taxes ?',
    text: 'Le taux de service, la TVA et la devise seront appliqués aux prochaines additions.',
    confirmLabel: 'Enregistrer',
  }))
    return

  const existing = props.restaurant.config_jsonb ?? {}
  const taxes = isRecord(existing.taxes) ? existing.taxes : {}

  await save({
    taux_service: parseDecimal(draft.value.service) ?? 0,
    currency: draft.value.currency.trim().toUpperCase(),

    // Les autres réglages avancés du restaurant sont conservés tels quels.
    config_jsonb: { ...existing, taxes: { ...taxes, tva: parseDecimal(draft.value.vat) ?? DEFAULT_VAT_RATE } },
  }, 'Service et taxes enregistrés.')
}

function cancel() {
  draft.value = draftOf(props.restaurant)
  reset()
  form.value?.resetValidation()
}
</script>

<template>
  <VForm
    ref="form"
    validate-on="submit"
    @submit.prevent="submit"
  >
    <VRow>
      <VCol
        cols="12"
        lg="7"
      >
        <VCard>
          <VCardItem>
            <VCardTitle>Service, TVA et devise</VCardTitle>
            <VCardSubtitle class="text-wrap">
              Appliqués automatiquement aux additions de ce restaurant.
            </VCardSubtitle>
          </VCardItem>
          <VCardText>
            <VRow>
              <VCol
                cols="12"
                md="6"
              >
                <VTextField
                  v-model="draft.service"
                  label="Taux de service"
                  prepend-inner-icon="ri-percent-line"
                  suffix="%"
                  inputmode="decimal"
                  hide-details="auto"
                  :rules="[percent('Taux de service')]"
                  :readonly="!canEdit"
                />
                <div
                  v-if="canEdit"
                  class="d-flex flex-wrap gap-2 mt-2"
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
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <VTextField
                  v-model="draft.vat"
                  label="TVA sur le catalogue"
                  prepend-inner-icon="ri-percent-line"
                  suffix="%"
                  inputmode="decimal"
                  :hint="`Par défaut ${DEFAULT_VAT_RATE.toLocaleString('fr-FR')} % (Cameroun).`"
                  persistent-hint
                  :rules="[percent('TVA')]"
                  :readonly="!canEdit"
                />
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <VSelect
                  v-model="draft.currency"
                  :items="currencies"
                  label="Devise"
                  prepend-inner-icon="ri-money-dollar-circle-line"
                  :readonly="!canEdit"
                />
              </VCol>
            </VRow>
          </VCardText>
        </VCard>
      </VCol>

      <VCol
        cols="12"
        lg="5"
      >
        <VCard>
          <VCardItem>
            <VCardTitle>Exemple d'addition</VCardTitle>
            <VCardSubtitle class="text-wrap">
              Pour des plats à {{ formatMoney(SAMPLE, draft.currency) }}.
            </VCardSubtitle>
          </VCardItem>
          <VCardText>
            <div class="d-flex justify-space-between mb-2">
              <span class="text-medium-emphasis">Plats et boissons</span>
              <span>{{ formatMoney(SAMPLE, draft.currency) }}</span>
            </div>
            <div class="d-flex justify-space-between mb-2">
              <span class="text-medium-emphasis">Service ({{ serviceRate.toLocaleString('fr-FR') }} %)</span>
              <span>{{ formatMoney(serviceAmount, draft.currency) }}</span>
            </div>
            <VDivider class="my-3" />
            <div class="d-flex justify-space-between text-subtitle-1 font-weight-medium">
              <span>Total avec service</span>
              <span>{{ formatMoney(SAMPLE + serviceAmount, draft.currency) }}</span>
            </div>
            <p class="text-caption text-medium-emphasis mt-3 mb-0">
              La TVA de {{ vatRate.toLocaleString('fr-FR') }} % s'applique aux articles du catalogue lors de la prise de commande.
            </p>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <VAlert
      v-if="errorMessage"
      type="error"
      variant="tonal"
      class="mt-6"
    >
      {{ errorMessage }}
    </VAlert>

    <div
      v-if="canEdit"
      class="d-flex flex-wrap justify-end gap-3 mt-6"
    >
      <VBtn
        variant="outlined"
        color="secondary"
        :disabled="!dirty || pending"
        @click="cancel"
      >
        Annuler les modifications
      </VBtn>
      <VBtn
        type="submit"
        :loading="pending"
        :disabled="!dirty"
      >
        Enregistrer
      </VBtn>
    </div>
  </VForm>
</template>
