<script setup lang="ts">
import { stockApi } from '../api'
import { formatQty, nonNegativeQty, parseQty } from '../labels'
import type { StockRow } from '../types'
import { useSubmit } from '@/composables/useSubmit'
import { useToast } from '@/stores/toast.store'

const props = defineProps<{ row: StockRow | null }>()
const emit = defineEmits<{ saved: [] }>()
const open = defineModel<boolean>({ required: true })

const toast = useToast()
const threshold = ref('')

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

  threshold.value = props.row ? String(Number(props.row.stock.seuil_alerte)).replace('.', ',') : ''
  save.reset()
})
</script>

<template>
  <AppFormDialog
    v-model="open"
    title="Seuil d'alerte"
    :subtitle="row ? `${row.composant.nom} : ${formatQty(row.stock.quantite)} ${row.composant.stock_unite} en stock` : undefined"
    icon="ri-alarm-warning-line"
    :loading="save.pending.value"
    :error="save.message.value"
    @submit="save.submit()"
  >
    <p class="text-body-2 text-medium-emphasis mb-5">
      Sous ce niveau, le composant passe « sous le seuil » et il est proposé à l'approvisionnement.
      Un seuil à 0 désactive l'alerte.
    </p>
    <VTextField
      v-model="threshold"
      :label="`Seuil d'alerte (${row?.composant.stock_unite ?? ''})`"
      inputmode="decimal"
      autocomplete="off"
      autofocus
      :rules="[nonNegativeQty]"
      :error-messages="save.apiError.value?.fieldMessage('seuil_alerte')"
    />
  </AppFormDialog>
</template>
