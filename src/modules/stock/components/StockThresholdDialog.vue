<script setup lang="ts">
import { stockApi } from '../api'
import { formatQty, nonNegativeQty, parseQty, toInput } from '../labels'
import type { StockRow } from '../types'
import { useSubmit } from '@/composables/useSubmit'
import { useToast } from '@/stores/toast.store'

const props = defineProps<{ row: StockRow | null }>()
const emit = defineEmits<{ saved: [] }>()
const open = defineModel<boolean>({ required: true })

const toast = useToast()
const threshold = ref('')

const unit = computed(() => props.row?.composant.stock_unite ?? '')

// Un seuil au moins égal au disponible fait passer le composant sous le seuil tout de suite : on le dit avant.
const warning = computed(() => {
  const value = parseQty(threshold.value)

  if (!props.row || threshold.value.trim() === '' || nonNegativeQty(threshold.value) !== true || value <= 0)
    return null

  return value >= Number(props.row.stock.disponible)
    ? `Avec ce seuil, « ${props.row.composant.nom} » passera tout de suite sous le seuil : ${formatQty(props.row.stock.disponible)} ${unit.value} disponible${Number(props.row.stock.disponible) > 1 ? 's' : ''}.`
    : null
})

const save = useSubmit(async () => {
  if (!props.row)
    return

  await stockApi.setThreshold(props.row.composant.id, parseQty(threshold.value))
  toast.success(`Seuil de « ${props.row.composant.nom} » enregistré.`)
  open.value = false
  emit('saved')
})

watch(open, isOpen => {
  if (!isOpen)
    return

  threshold.value = props.row ? toInput(props.row.stock.seuil_alerte) : ''
  save.reset()
})
</script>

<template>
  <AppFormDialog
    v-model="open"
    title="Seuil d'alerte"
    :subtitle="row ? `${row.composant.nom} : ${formatQty(row.stock.quantite)} ${unit} en stock, dont ${formatQty(row.stock.disponible)} disponibles` : undefined"
    icon="ri-alarm-warning-line"
    :loading="save.pending.value"
    :error="save.message.value"
    @submit="save.submit()"
  >
    <p class="text-body-2 text-medium-emphasis mb-5">
      Quand le disponible (stock moins réservé) atteint ce niveau, le composant passe « sous le seuil » et il est
      proposé à l'approvisionnement. Un seuil à 0 désactive l'alerte.
    </p>
    <VTextField
      v-model="threshold"
      :label="`Seuil d'alerte (${unit})`"
      prepend-inner-icon="ri-alarm-warning-line"
      inputmode="decimal"
      autocomplete="off"
      autofocus
      :rules="[nonNegativeQty]"
      :error-messages="save.apiError.value?.fieldMessage('seuil_alerte')"
    />
    <VAlert
      v-if="warning"
      type="warning"
      variant="tonal"
      density="comfortable"
      class="mt-2"
    >
      {{ warning }}
    </VAlert>
  </AppFormDialog>
</template>
