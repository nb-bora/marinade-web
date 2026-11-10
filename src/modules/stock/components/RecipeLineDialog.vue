<!-- Ajoute un composant à la fiche technique d'un plat, ou modifie sa quantité. -->
<script setup lang="ts">
import { stockApi } from '../api'
import { UNITS, compatibleUnits, componentTypeLabel, normalizeUnit, parseQty, positiveQty, required, toInput } from '../labels'
import type { Composant, Plat, PlatComposant } from '../types'
import { useSubmit } from '@/composables/useSubmit'
import { useToast } from '@/stores/toast.store'

const props = defineProps<{
  plat: Plat | null

  /** Ligne à modifier ; `null` pour en ajouter une. */
  line: PlatComposant | null

  /** Composants du restaurant (le menu déroulant exclut ceux déjà dans la fiche). */
  composants: Composant[]
  usedIds: string[]
}>()

const emit = defineEmits<{ saved: [] }>()
const open = defineModel<boolean>({ required: true })

const toast = useToast()
const composantId = ref<string | null>(null)
const quantity = ref('1')
const unit = ref<string | null>('portion')

const isEdit = computed(() => props.line !== null)

const options = computed(() => props.composants
  .filter(item => !props.usedIds.includes(item.id))
  .map(item => ({ value: item.id, title: item.nom, subtitle: `${componentTypeLabel(item.type)} · en ${item.stock_unite}` }))
  .sort((a, b) => a.title.localeCompare(b.title, 'fr')))

const selected = computed(() => props.composants.find(item => item.id === (props.line?.composant_id ?? composantId.value)) ?? null)
const currentName = computed(() => props.composants.find(item => item.id === props.line?.composant_id)?.nom ?? 'Composant')

// Les unités qui se convertissent en unité de stock (kg → g, L → cl...) ; sinon, la liste habituelle.
const unitChoices = computed(() => selected.value ? compatibleUnits(selected.value.stock_unite) : UNITS)

const unitHint = computed(() => {
  if (!selected.value)
    return undefined

  const stockUnit = selected.value.stock_unite

  return unitChoices.value.length > 1
    ? `Le stock se compte en ${stockUnit} : ${unitChoices.value.join(', ')} sont convertis.`
    : `Le stock se compte en ${stockUnit}.`
})

// Une unité hors de la grandeur du stock (grammes pour un stock en pièces) est le plus souvent une erreur ; le
// serveur reste juge, car un composant peut avoir sa propre conversion.
const unitWarning = computed(() => {
  const stockUnit = selected.value?.stock_unite
  const wanted = normalizeUnit(unit.value)

  if (!stockUnit || !wanted || normalizeUnit(stockUnit) === wanted || compatibleUnits(stockUnit).some(item => normalizeUnit(item) === wanted))
    return null

  return `« ${unit.value} » n'est pas une unité de ${stockUnit} : l'enregistrement sera refusé sans conversion propre à ce composant.`
})

const save = useSubmit(async () => {
  if (!props.plat)
    return

  const body = { quantite: parseQty(quantity.value), unite: (unit.value ?? '').trim() }

  if (props.line)
    await stockApi.updateRecipeLine(props.plat.id, props.line.composant_id, body)
  else if (composantId.value)
    await stockApi.addRecipeLine(props.plat.id, { ...body, composant_id: composantId.value })

  toast.success(props.line ? 'Quantité modifiée.' : 'Composant ajouté à la fiche.')
  open.value = false
  emit('saved')
})

watch(open, isOpen => {
  if (!isOpen)
    return

  composantId.value = props.line?.composant_id ?? null
  quantity.value = props.line ? toInput(props.line.quantite) : '1'
  unit.value = props.line?.unite ?? 'portion'
  save.reset()
})

// Choisir un composant propose son unité de stock.
watch(composantId, id => {
  if (!props.line && id)
    unit.value = props.composants.find(item => item.id === id)?.stock_unite ?? 'portion'
})
</script>

<template>
  <AppFormDialog
    v-model="open"
    :title="isEdit ? 'Modifier la quantité' : 'Ajouter un composant'"
    :subtitle="plat ? (isEdit ? `${currentName} dans « ${plat.nom} »` : `Fiche technique de « ${plat.nom} »`) : undefined"
    icon="ri-list-check-2"
    :loading="save.pending.value"
    :error="save.message.value"
    @submit="save.submit()"
  >
    <VAutocomplete
      v-if="!isEdit"
      v-model="composantId"
      :items="options"
      label="Composant"
      prepend-inner-icon="ri-flask-line"
      no-data-text="Tous les composants sont déjà dans la fiche."
      :rules="[required('Choisissez un composant.')]"
      :error-messages="save.apiError.value?.fieldMessage('composant_id')"
      class="mb-2"
    />
    <VRow>
      <VCol
        cols="12"
        sm="6"
      >
        <VTextField
          v-model="quantity"
          label="Quantité par plat"
          prepend-inner-icon="ri-hashtag"
          inputmode="decimal"
          autocomplete="off"
          :autofocus="isEdit"
          :rules="[positiveQty]"
          :error-messages="save.apiError.value?.fieldMessage('quantite')"
        />
      </VCol>
      <VCol
        cols="12"
        sm="6"
      >
        <VCombobox
          v-model="unit"
          :items="unitChoices"
          label="Unité"
          prepend-inner-icon="ri-scales-line"
          :hint="unitHint"
          :persistent-hint="!!unitHint"
          :rules="[required('Indiquez l\'unité.')]"
          :error-messages="save.apiError.value?.fieldMessage('unite')"
        />
      </VCol>
    </VRow>
    <VAlert
      v-if="unitWarning"
      type="warning"
      variant="tonal"
      density="comfortable"
      class="mt-2"
    >
      {{ unitWarning }}
    </VAlert>
  </AppFormDialog>
</template>
