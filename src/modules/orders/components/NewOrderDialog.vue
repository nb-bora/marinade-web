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
const tablesFailed = ref(false)

/** « Table 5 · 4 couverts » : le numéro ne dit pas assez seul. */
const tableOptions = computed(() => freeTables.value.map(table => ({
  value: table.id,
  title: `Table ${table.numero}`,
  subtitle: [`${table.capacite} couvert${table.capacite > 1 ? 's' : ''}`, table.emplacement].filter(Boolean).join(' · '),
})))

const tablesHint = computed(() => (tablesFailed.value
  ? 'Les tables libres n\'ont pas pu être chargées : la commande sera créée sans table.'
  : undefined))

let loadToken = 0

async function loadTables() {
  const restaurantId = tenant.currentId
  const token = ++loadToken

  if (!restaurantId)
    return

  tableId.value = null
  tablesFailed.value = false
  loadingTables.value = true

  try {
    const rows = await ordersApi.freeTables(restaurantId)

    // Une ouverture plus récente a pris le relais : cette réponse est périmée.
    if (token === loadToken)
      freeTables.value = rows
  }
  catch {
    // La liste des tables est un confort : sans elle, on peut créer une commande sans table.
    if (token === loadToken) {
      freeTables.value = []
      tablesFailed.value = true
    }
  }
  finally {
    if (token === loadToken)
      loadingTables.value = false
  }
}

watch(open, isOpen => {
  if (isOpen)
    loadTables()
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
      :items="tableOptions"
      label="Table (facultatif)"
      placeholder="Sans table : à emporter"
      prepend-inner-icon="ri-table-line"
      :loading="loadingTables"
      clearable
      :hint="tablesHint"
      :persistent-hint="tablesFailed"
      :no-data-text="loadingTables ? 'Chargement…' : 'Aucune table libre.'"
    >
      <template #item="{ props: itemProps, item }">
        <VListItem
          v-bind="itemProps"
          :title="item.raw.title"
          :subtitle="item.raw.subtitle"
        />
      </template>
    </VSelect>
  </AppFormDialog>
</template>
