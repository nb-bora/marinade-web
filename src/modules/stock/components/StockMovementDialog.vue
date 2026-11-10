<script setup lang="ts">
import { stockApi } from '../api'
import {
  MOVEMENTS,
  MOVEMENT_CHOICES,
  amountRule,
  formatQty,
  maxLength,
  motifOptions,
  motifRequired,
  movementQuantityRule,
  parseQty,
  stockAfterMovement,
} from '../labels'
import type { StockMovementType, StockRow } from '../types'
import { useSubmit } from '@/composables/useSubmit'
import { useToast } from '@/stores/toast.store'

const props = defineProps<{
  row: StockRow | null
  initialType?: StockMovementType
}>()

const emit = defineEmits<{ saved: [] }>()
const open = defineModel<boolean>({ required: true })

const toast = useToast()
const type = ref<StockMovementType>('entree')
const quantity = ref('')
const motif = ref<string | null>(null)
const notes = ref('')
const unitCost = ref('')
const lotNumber = ref('')
const expiry = ref('')

const option = computed(() => MOVEMENTS.find(item => item.value === type.value) ?? MOVEMENTS[0])
const unit = computed(() => props.row?.composant.stock_unite ?? '')
const isEntry = computed(() => type.value === 'entree')
const needsMotif = computed(() => motifRequired(type.value))
const motifChoices = computed(() => motifOptions(type.value))
const commentRequired = computed(() => motif.value === 'autre')

// Même contrôle que le serveur : une sortie ne dépasse pas le disponible, un ajustement ne passe pas sous le réservé.
const quantityRule = computed(() => movementQuantityRule(type.value, props.row?.stock))

// Aperçu : ce que vaudra le stock une fois le mouvement enregistré.
const after = computed(() => {
  if (!props.row || quantity.value.trim() === '' || quantityRule.value(quantity.value) !== true)
    return null

  return stockAfterMovement(props.row.stock, type.value, parseQty(quantity.value))
})

const delta = computed(() => (after.value === null || !props.row ? null : after.value - Number(props.row.stock.quantite)))

// Une quantité réellement saisie : un champ vide n'est pas envoyé (le serveur applique ses défauts).
const optionalNumber = (input: string) => (input.trim() === '' ? undefined : parseQty(input))

const save = useSubmit(async () => {
  if (!props.row)
    return

  const entryDetails = {
    cout_unitaire: optionalNumber(unitCost.value),
    lot_numero: lotNumber.value.trim() || undefined,
    date_peremption: expiry.value || undefined,
  }

  const body = {
    type: type.value,
    quantite: parseQty(quantity.value),
    motif: needsMotif.value ? motif.value : null,
    notes: notes.value.trim() || undefined,
    ...(isEntry.value ? entryDetails : {}),
  }

  await stockApi.addMovement(props.row.composant.id, body)
  toast.success(`Stock de « ${props.row.composant.nom} » mis à jour.`)
  open.value = false
  emit('saved')
})

// Les champs de formulaire viennent du serveur (`errors[].field`) : chaque message reste sous son champ.
const fieldError = (field: string) => save.apiError.value?.fieldMessage(field)

// Le type de mouvement change le motif attendu : on repart d'un choix vide.
watch(type, () => {
  motif.value = null
})

watch(open, isOpen => {
  if (!isOpen)
    return

  type.value = props.initialType ?? 'entree'
  quantity.value = ''
  motif.value = null
  notes.value = ''
  unitCost.value = ''
  lotNumber.value = ''
  expiry.value = ''
  save.reset()
})
</script>

<template>
  <AppFormDialog
    v-model="open"
    title="Mouvement de stock"
    :subtitle="row ? `${row.composant.nom} : ${formatQty(row.stock.quantite)} ${unit} en stock, dont ${formatQty(row.stock.reservee)} réservés` : undefined"
    icon="ri-arrow-left-right-line"
    submit-label="Enregistrer le mouvement"
    :loading="save.pending.value"
    :error="save.message.value"
    @submit="save.submit()"
  >
    <AppSegmented
      v-model="type"
      :options="MOVEMENT_CHOICES"
      label="Type de mouvement"
      class="mb-2"
    />
    <p class="text-body-2 text-medium-emphasis mt-2 mb-5">
      {{ option.help }}
    </p>

    <VTextField
      v-model="quantity"
      :label="`${option.quantityLabel} (${unit})`"
      prepend-inner-icon="ri-hashtag"
      inputmode="decimal"
      autocomplete="off"
      autofocus
      :rules="[quantityRule]"
      :error-messages="fieldError('quantite')"
    />

    <!-- Aperçu du résultat : le gestionnaire voit le nouveau niveau avant d'enregistrer. -->
    <div
      v-if="after !== null && delta !== null"
      class="movement-preview mb-2"
      aria-live="polite"
    >
      <span class="text-body-2 text-medium-emphasis">Stock après le mouvement</span>
      <span class="text-body-1 font-weight-semibold tabular-nums">
        {{ formatQty(after) }} {{ unit }}
      </span>
      <VChip
        v-if="delta !== 0"
        size="small"
        label
        :color="delta > 0 ? 'success' : 'error'"
        variant="tonal"
        class="tabular-nums"
      >
        {{ delta > 0 ? '+' : '−' }}{{ formatQty(Math.abs(delta)) }}
      </VChip>
      <VChip
        v-else
        size="small"
        label
        variant="tonal"
      >
        Aucun changement
      </VChip>
    </div>

    <VSelect
      v-if="needsMotif"
      v-model="motif"
      :items="motifChoices"
      item-title="title"
      item-value="value"
      label="Motif"
      prepend-inner-icon="ri-price-tag-3-line"
      :rules="[(value: unknown) => !!value || 'Choisissez un motif.']"
      :error-messages="fieldError('motif')"
      class="mt-2"
    />

    <VTextField
      v-if="isEntry"
      v-model="unitCost"
      :label="`Coût d'achat par ${unit || 'unité'}, en FCFA (facultatif)`"
      prepend-inner-icon="ri-money-dollar-circle-line"
      inputmode="decimal"
      autocomplete="off"
      :rules="[amountRule(4)]"
      :error-messages="fieldError('cout_unitaire')"
      class="mt-2"
    />
    <div
      v-if="isEntry"
      class="d-flex ga-3 flex-wrap"
    >
      <VTextField
        v-model="lotNumber"
        label="Numéro de lot (facultatif)"
        prepend-inner-icon="ri-barcode-line"
        autocomplete="off"
        class="flex-1-1"
        :rules="[maxLength(60, 'Numéro de lot')]"
        :error-messages="fieldError('lot_numero')"
      />
      <VTextField
        v-model="expiry"
        type="date"
        label="Date limite de consommation (facultatif)"
        prepend-inner-icon="ri-calendar-event-line"
        class="flex-1-1"
        :error-messages="fieldError('date_peremption')"
      />
    </div>

    <VTextarea
      v-model="notes"
      :label="commentRequired ? 'Commentaire (obligatoire)' : 'Commentaire (facultatif)'"
      prepend-inner-icon="ri-file-text-line"
      :placeholder="needsMotif ? 'Précisez ce qui s\'est passé…' : 'Ex. livraison du marché…'"
      :rules="[
        ...(commentRequired ? [(value: unknown) => !!String(value ?? '').trim() || 'Précisez le motif dans le commentaire.'] : []),
        maxLength(1000, 'Commentaire'),
      ]"
      :error-messages="fieldError('notes')"
      rows="2"
      auto-grow
      class="mt-2"
    />
  </AppFormDialog>
</template>

<style scoped>
.movement-preview {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 12px;
  padding: 10px 14px;
  border: 1px solid rgba(var(--v-theme-primary), 0.22);
  border-radius: 12px;
  background: rgba(var(--v-theme-primary), 0.06);
}

.movement-preview > :first-child {
  flex: 1 1 auto;
}
</style>
