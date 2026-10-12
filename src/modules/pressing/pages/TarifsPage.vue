<script setup lang="ts">
import { pressingApi } from '../api'
import {
  DEFAULT_KILO_PRICE,
  MODE_HINTS,
  MODE_LABELS,
  PREVIEW_WEIGHTS,
  STEP_LABELS,
  billableGrams,
  formatKg,
  pressingError,
  toInt,
  washAmount,
} from '../labels'
import type { RoundingMode, RoundingStep, Tarifs } from '../types'
import { useAsyncData } from '@/composables/useAsyncData'
import { useConfirm } from '@/composables/useConfirm'
import { useSubmit } from '@/composables/useSubmit'
import { formatMoney } from '@/lib/format'
import { useTenantStore } from '@/stores/tenant.store'
import { useToast } from '@/stores/toast.store'

const tenant = useTenantStore()
const toast = useToast()
const confirm = useConfirm()
const canWrite = computed(() => tenant.can('management'))

const { data, error, reload } = useAsyncData(
  signal => tenant.currentId ? pressingApi.tarifs(tenant.currentId, signal) : Promise.resolve(null),
  { watch: [() => tenant.currentId] },
)

// Brouillon du formulaire
const kiloPrice = ref(String(DEFAULT_KILO_PRICE))
const dryingOn = ref(false)
const dryingPrice = ref('')
const step = ref<RoundingStep>(1000)
const mode = ref<RoundingMode>('superieur')
const form = ref()

function load(tarifs: Tarifs) {
  kiloPrice.value = String(tarifs.prix_kg)
  dryingOn.value = tarifs.prix_sechage_kg !== null
  dryingPrice.value = tarifs.prix_sechage_kg === null ? '' : String(tarifs.prix_sechage_kg)
  step.value = tarifs.arrondi.pas_grammes
  mode.value = tarifs.arrondi.mode
}

watch(data, tarifs => {
  if (tarifs)
    load(tarifs)
}, { immediate: true })

const stepItems = computed(() => {
  const steps: RoundingStep[] = [100, 500, 1000]

  // Un pas au gramme défini ailleurs reste affiché et modifiable.
  if (step.value === 1)
    steps.unshift(1)

  return steps.map(value => ({ value, title: STEP_LABELS[value] }))
})

const modeItems = (Object.keys(MODE_LABELS) as RoundingMode[]).map(value => ({ value, title: MODE_LABELS[value] }))

const draft = computed(() => ({
  prix_kg: toInt(kiloPrice.value),
  prix_sechage_kg: dryingOn.value ? toInt(dryingPrice.value) : null,
}))

const dirty = computed(() => {
  const saved = data.value

  if (!saved)
    return false

  return draft.value.prix_kg !== saved.prix_kg
    || draft.value.prix_sechage_kg !== saved.prix_sechage_kg
    || step.value !== saved.arrondi.pas_grammes
    || mode.value !== saved.arrondi.mode
})

// Aperçu en direct de l'arrondi (calcul indicatif : le serveur reste l'autorité).
const preview = computed(() => PREVIEW_WEIGHTS.map(grams => {
  const billable = billableGrams(grams, step.value, mode.value)

  return { grams, billable, amount: washAmount(billable, draft.value.prix_kg ?? 0) }
}))

const { submit, pending, error: saveError, reset } = useSubmit(async () => {
  const restaurantId = tenant.currentId

  if (!restaurantId)
    return

  const saved = await pressingApi.updateTarifs(restaurantId, {
    prix_kg: Number(kiloPrice.value),
    prix_sechage_kg: dryingOn.value ? Number(dryingPrice.value) : null,
    arrondi: { pas_grammes: step.value, mode: mode.value },
  })

  data.value = saved
  load(saved)
  toast.success('Les tarifs du pressing sont enregistrés.')
})

const saveMessage = computed(() => saveError.value ? pressingError(saveError.value) : '')

async function save() {
  if (!canWrite.value || !dirty.value || !data.value)
    return

  if (!(await form.value?.validate())?.valid)
    return

  const before = data.value.prix_kg
  const after = Number(kiloPrice.value)

  const recap = before === after
    ? `Le prix du kilo reste à ${formatMoney(after, 'XAF')}. Seuls le séchage ou l'arrondi changent.`
    : `Le prix du kilo passe de ${formatMoney(before, 'XAF')} à ${formatMoney(after, 'XAF')}.`

  const accepted = await confirm({
    title: 'Enregistrer les nouveaux tarifs ?',
    text: `${recap} Les prochains calculs utiliseront ces tarifs.`,
    confirmLabel: 'Enregistrer',
  })

  if (!accepted)
    return

  if ((await submit()) === undefined && saveMessage.value)
    toast.error(saveMessage.value)
}

function cancel() {
  if (data.value)
    load(data.value)

  reset()
  form.value?.resetValidation()
}

const kiloRules = [(value: string) => {
  const price = toInt(value)

  return (price !== null && price >= 1) || 'Indiquez le prix du kilo en FCFA, nombre entier d\'au moins 1.'
}]

const dryingRules = [(value: string) => {
  const price = toInt(value)

  return (price !== null && price >= 1) || 'Indiquez le prix du kilo de séchage en FCFA, nombre entier d\'au moins 1.'
}]
</script>

<template>
  <div>
    <AppPageHeader
      title="Tarifs du pressing"
      subtitle="Le prix du kilo de linge, le séchage et la règle d'arrondi des fractions de kilo."
    />

    <AppErrorState
      v-if="error && !data"
      :error="error"
      @retry="reload"
    />

    <VRow v-else-if="!data">
      <VCol
        v-for="n in 3"
        :key="n"
        cols="12"
        md="4"
      >
        <VSkeletonLoader type="article" />
      </VCol>
    </VRow>

    <VForm
      v-else
      ref="form"
      validate-on="submit"
      @submit.prevent="save"
    >
      <VAlert
        v-if="!canWrite"
        type="info"
        variant="tonal"
        class="mb-6"
      >
        Seule la direction peut modifier les tarifs. Vous les consultez en lecture seule.
      </VAlert>

      <VRow>
        <VCol
          cols="12"
          md="6"
        >
          <VCard class="h-100">
            <VCardItem>
              <template #prepend>
                <VAvatar
                  color="primary"
                  variant="tonal"
                  rounded
                >
                  <VIcon icon="ri-scales-3-line" />
                </VAvatar>
              </template>
              <VCardTitle>Lavage au kilo</VCardTitle>
              <VCardSubtitle class="text-wrap">
                Le linge est pesé puis facturé au kilo.
              </VCardSubtitle>
            </VCardItem>
            <VCardText>
              <VTextField
                v-model="kiloPrice"
                label="Prix du kilo (FCFA)"
                prepend-inner-icon="ri-money-dollar-circle-line"
                :placeholder="String(DEFAULT_KILO_PRICE)"
                inputmode="numeric"
                :rules="kiloRules"
                :readonly="!canWrite"
                data-testid="tarif-kilo"
              />
            </VCardText>
          </VCard>
        </VCol>

        <VCol
          cols="12"
          md="6"
        >
          <VCard class="h-100">
            <VCardItem>
              <template #prepend>
                <VAvatar
                  color="warning"
                  variant="tonal"
                  rounded
                >
                  <VIcon icon="ri-sun-line" />
                </VAvatar>
              </template>
              <VCardTitle>Séchage</VCardTitle>
              <VCardSubtitle class="text-wrap">
                Un service en plus du lavage, facturé lui aussi au kilo.
              </VCardSubtitle>
            </VCardItem>
            <VCardText>
              <VSwitch
                v-model="dryingOn"
                label="Proposer le séchage"
                color="primary"
                hide-details
                :readonly="!canWrite"
                class="mb-4"
                data-testid="tarif-sechage-switch"
              />
              <VTextField
                v-model="dryingPrice"
                label="Prix du kilo de séchage (FCFA)"
                prepend-inner-icon="ri-money-dollar-circle-line"
                placeholder="300"
                inputmode="numeric"
                :disabled="!dryingOn"
                :rules="dryingOn ? dryingRules : []"
                :readonly="!canWrite"
                :hint="dryingOn ? undefined : 'Le séchage n\'est pas proposé : aucun prix n\'est enregistré.'"
                persistent-hint
                data-testid="tarif-sechage-prix"
              />
            </VCardText>
          </VCard>
        </VCol>

        <VCol cols="12">
          <VCard>
            <VCardItem>
              <template #prepend>
                <VAvatar
                  color="info"
                  variant="tonal"
                  rounded
                >
                  <VIcon icon="ri-percent-line" />
                </VAvatar>
              </template>
              <VCardTitle>Arrondi des fractions de kilo</VCardTitle>
              <VCardSubtitle class="text-wrap">
                Comment un poids qui ne tombe pas juste est converti en poids facturable.
              </VCardSubtitle>
            </VCardItem>
            <VCardText>
              <VRow>
                <VCol
                  cols="12"
                  md="6"
                >
                  <VSelect
                    v-model="step"
                    :items="stepItems"
                    label="Palier d'arrondi"
                    prepend-inner-icon="ri-scales-3-line"
                    :readonly="!canWrite"
                    data-testid="tarif-pas"
                  />
                  <VSelect
                    v-model="mode"
                    :items="modeItems"
                    label="Règle d'arrondi"
                    prepend-inner-icon="ri-percent-line"
                    :hint="MODE_HINTS[mode]"
                    persistent-hint
                    :readonly="!canWrite"
                    class="mt-4"
                    data-testid="tarif-mode"
                  />
                </VCol>
                <VCol
                  cols="12"
                  md="6"
                >
                  <div class="text-subtitle-1 font-weight-medium mb-2">
                    Aperçu avec vos réglages
                  </div>
                  <VList
                    density="comfortable"
                    class="rounded border pa-0"
                    data-testid="tarif-apercu"
                  >
                    <template
                      v-for="(item, index) in preview"
                      :key="item.grams"
                    >
                      <VDivider v-if="index > 0" />
                      <VListItem>
                        <div class="d-flex flex-wrap align-center justify-space-between gap-2">
                          <span>
                            <strong>{{ formatKg(item.grams) }}</strong> pesés
                            <VIcon
                              icon="ri-arrow-right-line"
                              size="16"
                              class="mx-1"
                            />
                            {{ formatKg(item.billable) }} facturés
                          </span>
                          <strong class="text-primary tabular-nums text-no-wrap">{{ formatMoney(item.amount, 'XAF') }}</strong>
                        </div>
                      </VListItem>
                    </template>
                  </VList>
                  <p class="text-caption text-medium-emphasis mt-2 mb-0">
                    Montant du lavage seul, calculé d'après les valeurs saisies. Le calculateur donne le montant définitif.
                  </p>
                </VCol>
              </VRow>
            </VCardText>
          </VCard>
        </VCol>
      </VRow>

      <VAlert
        v-if="saveMessage"
        type="error"
        variant="tonal"
        class="mt-6"
      >
        {{ saveMessage }}
      </VAlert>

      <div
        v-if="canWrite"
        class="d-flex flex-wrap justify-end gap-3 mt-6"
      >
        <VBtn
          variant="outlined"
          color="secondary"
          :disabled="!dirty || pending"
          @click="cancel"
        >
          Annuler les changements
        </VBtn>
        <VBtn
          type="submit"
          :disabled="!dirty"
          :loading="pending"
          prepend-icon="ri-save-line"
          data-testid="tarif-save"
        >
          Enregistrer
        </VBtn>
      </div>
    </VForm>
  </div>
</template>
