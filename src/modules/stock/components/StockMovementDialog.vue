<script setup lang="ts">
import { MOVEMENTS, formatQty, parseQty, positiveQty } from '../labels'
import { stockApi } from '../api'
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
const notes = ref('')

const option = computed(() => MOVEMENTS.find(item => item.value === type.value) ?? MOVEMENTS[0])

const unit = computed(() => props.row?.composant.stock_unite ?? '')

const save = useSubmit(async () => {
  if (!props.row)
    return

  await stockApi.addMovement(props.row.composant.id, {
    type: type.value,
    quantite: parseQty(quantity.value),
    notes: notes.value.trim() || undefined,
  })
  toast.success(`Stock de « ${props.row.composant.nom} » mis à jour.`)
  open.value = false
  emit('saved')
})

// Le serveur répond 400 sans message exploitable : on explique la cause la plus probable.
const errorText = computed(() => {
  if (save.apiError.value?.status !== 400)
    return save.message.value

  return type.value === 'ajustement'
    ? 'La quantité ne peut pas être inférieure à la quantité déjà réservée par des commandes.'
    : 'Le stock disponible est insuffisant pour cette sortie (le stock réservé par des commandes est exclu).'
})

watch(open, isOpen => {
  if (!isOpen)
    return

  type.value = props.initialType ?? 'entree'
  quantity.value = ''
  notes.value = ''
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
    :error="errorText"
    @submit="save.submit()"
  >
    <AppSegmented
      v-model="type"
      :options="MOVEMENTS.map(item => ({ value: item.value, title: item.title }))"
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
      :rules="[positiveQty]"
      :error-messages="save.apiError.value?.fieldMessage('quantite')"
    />
    <VTextarea
      v-model="notes"
      label="Note (facultatif)"
      prepend-inner-icon="ri-file-text-line"
      placeholder="Ex. livraison du marché, casse en cuisine…"
      rows="2"
      auto-grow
      class="mt-2"
    />
  </AppFormDialog>
</template>
