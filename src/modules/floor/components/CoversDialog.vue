<!--
  Modifier le nombre de couverts d'une table servie (un convive arrive ou part) : l'aperçu montre
  tout de suite combien de places restent libres.
-->
<script setup lang="ts">
import { floorApi } from '../api'
import { contextFor, locationOf, occupy } from '../service'
import type { ServiceSession, Table } from '../types'
import { useSubmit } from '@/composables/useSubmit'
import { useTenantStore } from '@/stores/tenant.store'
import { useToast } from '@/stores/toast.store'

const props = defineProps<{
  session: ServiceSession | null
  table: Table | null

  /** Couverts actuels (peut être inconnu). */
  covers: number | null
}>()

const emit = defineEmits<{ saved: [covers: number] }>()

const open = defineModel<boolean>({ required: true })

const tenant = useTenantStore()
const toast = useToast()

const value = ref<number | string>(1)

watch(open, isOpen => {
  if (isOpen)
    value.value = props.covers ?? 1
})

const capacity = computed(() => props.table?.capacite ?? null)
const count = computed(() => Number(value.value))
const valid = computed(() => Number.isInteger(count.value) && count.value >= 1 && count.value <= 99)
const free = computed(() => capacity.value === null || !valid.value ? null : capacity.value - count.value)

const preview = computed(() => {
  if (free.value === null)
    return ''

  if (free.value > 0)
    return `${free.value} place${free.value > 1 ? 's' : ''} libre${free.value > 1 ? 's' : ''} sur ${capacity.value}`

  return free.value === 0 ? 'Table complète' : `${-free.value} couvert${-free.value > 1 ? 's' : ''} de plus que les places de la table`
})

const { submit, pending, message, reset } = useSubmit(async () => {
  const restaurantId = tenant.currentId

  if (!restaurantId || !props.session || !valid.value)
    return

  const zone = props.table ? locationOf(props.table) : props.session.table_context?.split('·')[1]?.trim()

  await floorApi.updateSession(restaurantId, props.session.id, { table_context: contextFor(count.value, zone) })

  // La table garde le même compte (second poste, session soldée) : un échec ici n'annule pas le principal.
  if (props.table) {
    try {
      await floorApi.updateTable(props.table.id, occupy(props.table, props.session.id, count.value))
    }
    catch {
      toast.warning('Couverts enregistrés, mais la fiche de la table n\'a pas pu être mise à jour.')
    }
  }

  toast.success(`${count.value} couvert${count.value > 1 ? 's' : ''} enregistré${count.value > 1 ? 's' : ''}.`)
  open.value = false
  emit('saved', count.value)
})

watch(open, isOpen => {
  if (!isOpen)
    reset()
})

const between = (input: unknown) => (Number.isInteger(Number(input)) && Number(input) >= 1 && Number(input) <= 99) || 'Saisissez un entier entre 1 et 99.'
</script>

<template>
  <AppFormDialog
    v-model="open"
    title="Modifier les couverts"
    :subtitle="table ? `Table ${table.numero} · ${table.capacite} places` : undefined"
    icon="ri-group-line"
    :loading="pending"
    :error="message"
    max-width="520"
    @submit="submit"
  >
    <VTextField
      v-model="value"
      label="Nombre de couverts"
      prepend-inner-icon="ri-group-line"
      type="number"
      inputmode="numeric"
      min="1"
      max="99"
      :rules="[between]"
      autofocus
    />
    <VAlert
      v-if="preview"
      :type="free !== null && free < 0 ? 'warning' : free === 0 ? 'info' : 'success'"
      variant="tonal"
      density="compact"
      :icon="free !== null && free < 0 ? 'ri-alert-line' : 'ri-armchair-line'"
      class="mt-2"
    >
      {{ preview }}
    </VAlert>
  </AppFormDialog>
</template>
