<!-- Créer ou modifier une table. -->
<script setup lang="ts">
import { floorApi } from '../api'
import { TABLE_STATUS_OPTIONS, tableStatusOf } from '../labels'
import type { Table } from '../types'
import { useSubmit } from '@/composables/useSubmit'
import { isApiError } from '@/lib/http/errors'
import { required } from '@/lib/validation'
import { useTenantStore } from '@/stores/tenant.store'
import { useToast } from '@/stores/toast.store'

const props = defineProps<{

  /** La table à modifier ; `null` pour en créer une. */
  table: Table | null

  /** Emplacements déjà utilisés, proposés à la saisie. */
  locations: string[]

  /** Seul le management peut changer le numéro et la capacité ; le service ne change que le statut. */
  canEditLayout: boolean
}>()

const emit = defineEmits<{ saved: [table: Table] }>()

const open = defineModel<boolean>({ required: true })

const tenant = useTenantStore()
const toast = useToast()

const numero = ref('')
const capacite = ref<number | string>(4)
const emplacement = ref<string | null>(null)
const statut = ref('libre')

const isEdit = computed(() => props.table !== null)

const { submit, pending, error, message, reset } = useSubmit(async () => {
  const restaurantId = tenant.currentId

  if (!restaurantId)
    return

  const body = {
    numero: numero.value.trim(),
    capacite: Number(capacite.value),
    emplacement: emplacement.value?.trim() || null,
    statut: statut.value,
  }

  const saved = props.table
    ? await floorApi.updateTable(props.table.id, props.canEditLayout ? body : { statut: statut.value })
    : await floorApi.createTable(restaurantId, body)

  toast.success(isEdit.value ? `Table ${saved.numero} mise à jour.` : `Table ${saved.numero} créée.`)
  open.value = false
  emit('saved', saved)
})

watch(open, isOpen => {
  if (!isOpen)
    return

  numero.value = props.table?.numero ?? ''
  capacite.value = props.table?.capacite ?? 4
  emplacement.value = props.table?.emplacement ?? null
  statut.value = props.table ? tableStatusOf(props.table.statut) : 'libre'
  reset()
})

// Un numéro déjà pris revient en 400 : on le dit plutôt qu'un message générique.
const errorText = computed(() => {
  if (isApiError(error.value) && error.value.kind === 'client')
    return 'Cette table n\'a pas pu être enregistrée : ce numéro est peut-être déjà utilisé.'

  return message.value
})

const positiveInteger = (value: unknown) => (Number.isInteger(Number(value)) && Number(value) > 0) || 'Saisissez un nombre entier supérieur à zéro.'
</script>

<template>
  <AppFormDialog
    v-model="open"
    :title="isEdit ? `Modifier la table ${table?.numero}` : 'Nouvelle table'"
    icon="ri-layout-grid-line"
    :loading="pending"
    :error="errorText"
    :max-width="480"
    @submit="submit"
  >
    <VRow>
      <VCol
        cols="12"
        sm="6"
      >
        <VTextField
          v-model="numero"
          label="Numéro ou nom"
          placeholder="T12"
          :rules="[required]"
          :disabled="isEdit && !canEditLayout"
          autocomplete="off"
          maxlength="50"
        />
      </VCol>
      <VCol
        cols="12"
        sm="6"
      >
        <VTextField
          v-model="capacite"
          label="Nombre de places"
          type="number"
          inputmode="numeric"
          min="1"
          :rules="[positiveInteger]"
          :disabled="isEdit && !canEditLayout"
        />
      </VCol>
      <VCol cols="12">
        <VCombobox
          v-model="emplacement"
          :items="locations"
          label="Emplacement"
          placeholder="Salle, terrasse, bar…"
          clearable
          :disabled="isEdit && !canEditLayout"
          maxlength="50"
          hint="Les tables du même emplacement sont regroupées sur le plan."
          persistent-hint
        />
      </VCol>
      <VCol cols="12">
        <VSelect
          v-model="statut"
          :items="TABLE_STATUS_OPTIONS"
          label="Statut"
        />
      </VCol>
    </VRow>
  </AppFormDialog>
</template>
