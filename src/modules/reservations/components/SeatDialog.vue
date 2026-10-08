<!-- Installer une entrée de la liste d'attente à une table libre. -->
<script setup lang="ts">
import { reservationsApi } from '../api'
import { coversLabel, tableLabel } from '../labels'
import type { Table, WaitlistEntry } from '../types'
import { useAsyncData } from '@/composables/useAsyncData'
import { useSubmit } from '@/composables/useSubmit'
import { useTenantStore } from '@/stores/tenant.store'
import { useToast } from '@/stores/toast.store'

const props = defineProps<{ entry: WaitlistEntry | null }>()
const emit = defineEmits<{ seated: [] }>()
const open = defineModel<boolean>({ required: true })

const tenant = useTenantStore()
const toast = useToast()
const tableId = ref<string | null>(null)

const { data, loading, error, reload } = useAsyncData(
  signal => tenant.currentId ? reservationsApi.freeTables(tenant.currentId, signal) : Promise.resolve([] as Table[]),
  { immediate: false },
)

const fits = (table: Table) => !props.entry || table.capacite >= props.entry.party_size

// Les tables assez grandes d'abord, puis par numéro.
const items = computed(() => [...(data.value ?? [])]
  .sort((a, b) => Number(fits(b)) - Number(fits(a)) || a.numero.localeCompare(b.numero, 'fr', { numeric: true }))
  .map(table => ({
    value: table.id,
    title: `${tableLabel(table.numero)} · ${table.capacite} place${table.capacite > 1 ? 's' : ''}${fits(table) ? '' : ' (trop petite)'}`,
  })))

const { submit, pending, message, reset } = useSubmit(async () => {
  if (!props.entry || !tableId.value)
    return

  await reservationsApi.seat(props.entry.id, tableId.value)
  toast.success(`${props.entry.customer_name} est installé.`)
  open.value = false
  emit('seated')
})

watch(open, isOpen => {
  if (!isOpen)
    return

  reset()
  tableId.value = null
  reload().then(() => {
    // Une seule table assez grande : on la propose d'office.
    const candidates = (data.value ?? []).filter(fits)

    if (candidates.length === 1)
      tableId.value = candidates[0].id
  })
})

const rules = [(value: string | null) => Boolean(value) || 'Choisissez une table.']
</script>

<template>
  <AppFormDialog
    v-model="open"
    title="Installer à une table"
    :subtitle="entry ? `${entry.customer_name} · ${coversLabel(entry.party_size)}` : undefined"
    submit-label="Installer"
    icon="ri-layout-grid-line"
    :max-width="480"
    :loading="pending"
    :error="message"
    @submit="submit"
  >
    <AppErrorState
      v-if="error"
      :error="error"
      @retry="reload"
    />
    <VSkeletonLoader
      v-else-if="loading && !data"
      type="heading"
    />
    <VAlert
      v-else-if="items.length === 0"
      type="warning"
      variant="tonal"
    >
      Aucune table n'est libre pour l'instant. Réessayez dès qu'une table se libère.
    </VAlert>
    <VSelect
      v-else
      v-model="tableId"
      :items="items"
      label="Table libre"
      :rules="rules"
      no-data-text="Aucune table libre"
    />
  </AppFormDialog>
</template>
