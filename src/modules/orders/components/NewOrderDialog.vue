<script setup lang="ts">
import { ordersApi } from '../api'
import { explainError } from '../labels'
import type { Commande, Table } from '../types'
import { useSubmit } from '@/composables/useSubmit'
import { useTenantStore } from '@/stores/tenant.store'
import { useToast } from '@/stores/toast.store'

const emit = defineEmits<{ created: [order: Commande] }>()

const open = defineModel<boolean>({ required: true })

const tenant = useTenantStore()
const toast = useToast()

const tableId = ref<string | null>(null)
const freeTables = ref<Table[]>([])
const loadingTables = ref(false)

watch(open, async isOpen => {
  if (!isOpen || !tenant.currentId)
    return

  tableId.value = null
  loadingTables.value = true

  try {
    freeTables.value = await ordersApi.freeTables(tenant.currentId)
  }
  catch {
    // La liste des tables est un confort : sans elle, on crée une commande sans table.
    freeTables.value = []
  }
  finally {
    loadingTables.value = false
  }
})

const { submit, pending, error } = useSubmit(async () => {
  const order = await ordersApi.create(tenant.currentId!, { table_id: tableId.value, statut: 'en_cours' })

  toast.success('Commande créée.')
  open.value = false
  emit('created', order)
})

const message = computed(() => error.value ? explainError(error.value) : '')
</script>

<template>
  <AppFormDialog
    v-model="open"
    title="Nouvelle commande"
    subtitle="Ouvre une commande de l'ancien circuit, à laquelle vous ajouterez les articles ensuite."
    icon="ri-file-list-3-line"
    submit-label="Créer la commande"
    :loading="pending"
    :error="message"
    @submit="submit"
  >
    <VSelect
      v-model="tableId"
      :items="freeTables"
      item-title="numero"
      item-value="id"
      label="Table (facultatif)"
      placeholder="Sans table : à emporter"
      prepend-inner-icon="ri-table-line"
      :loading="loadingTables"
      clearable
      :no-data-text="loadingTables ? 'Chargement…' : 'Aucune table libre.'"
    />
  </AppFormDialog>
</template>
