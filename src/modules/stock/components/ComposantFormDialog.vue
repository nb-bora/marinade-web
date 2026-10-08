<script setup lang="ts">
import { stockApi } from '../api'
import { COMPONENT_TYPE_OPTIONS, UNITS, nonNegativeQty, parseQty, required } from '../labels'
import type { Composant } from '../types'
import { useSubmit } from '@/composables/useSubmit'
import { useTenantStore } from '@/stores/tenant.store'
import { useToast } from '@/stores/toast.store'

const props = defineProps<{ composant: Composant | null }>()
const emit = defineEmits<{ saved: [] }>()
const open = defineModel<boolean>({ required: true })

const tenant = useTenantStore()
const toast = useToast()

const nom = ref('')
const type = ref<string | null>('base')
const unit = ref<string | null>('portion')
const supplement = ref('0')
const available = ref(true)
const description = ref('')

const isEdit = computed(() => props.composant !== null)

const save = useSubmit(async () => {
  const body = {
    nom: nom.value.trim(),
    type: (type.value ?? '').trim().toLowerCase(),
    stock_unite: (unit.value ?? '').trim(),
    prix_supplement: parseQty(supplement.value),
    disponible: available.value,
    description: description.value.trim() || null,
  }

  if (props.composant)
    await stockApi.updateComposant(props.composant.id, body)
  else if (tenant.currentId)
    await stockApi.createComposant(tenant.currentId, { ...body, devise: 'XAF' })

  toast.success(props.composant ? 'Composant modifié.' : 'Composant créé : son stock démarre à zéro.')
  open.value = false
  emit('saved')
})

watch(open, isOpen => {
  if (!isOpen)
    return

  const source = props.composant

  nom.value = source?.nom ?? ''
  type.value = source?.type ?? 'base'
  unit.value = source?.stock_unite ?? 'portion'
  supplement.value = source ? String(Number(source.prix_supplement)) : '0'
  available.value = source?.disponible ?? true
  description.value = source?.description ?? ''
  save.reset()
})
</script>

<template>
  <AppFormDialog
    v-model="open"
    :title="isEdit ? 'Modifier le composant' : 'Nouveau composant'"
    :subtitle="isEdit ? undefined : 'Un ingrédient ou élément de plat dont vous suivez le stock : riz, sauce tomate, poulet…'"
    icon="ri-stack-line"
    :loading="save.pending.value"
    :error="save.message.value"
    @submit="save.submit()"
  >
    <VRow>
      <VCol cols="12">
        <VTextField
          v-model="nom"
          label="Nom"
          autocomplete="off"
          autofocus
          :rules="[required('Indiquez le nom du composant.')]"
          :error-messages="save.apiError.value?.fieldMessage('nom')"
        />
      </VCol>
      <VCol
        cols="12"
        sm="6"
      >
        <VCombobox
          v-model="type"
          :items="COMPONENT_TYPE_OPTIONS"
          item-title="title"
          item-value="value"
          :return-object="false"
          label="Catégorie"
          hint="Choisissez dans la liste ou saisissez la vôtre."
          persistent-hint
          :rules="[required('Indiquez une catégorie.')]"
          :error-messages="save.apiError.value?.fieldMessage('type')"
        />
      </VCol>
      <VCol
        cols="12"
        sm="6"
      >
        <VCombobox
          v-model="unit"
          :items="UNITS"
          label="Unité de stock"
          hint="Ex. kg, litre, portion."
          persistent-hint
          :rules="[required('Indiquez l\'unité.')]"
          :error-messages="save.apiError.value?.fieldMessage('stock_unite')"
        />
      </VCol>
      <VCol
        cols="12"
        sm="6"
      >
        <VTextField
          v-model="supplement"
          label="Supplément de prix (FCFA)"
          inputmode="decimal"
          hint="Facturé en plus quand le client choisit ce composant."
          persistent-hint
          :rules="[nonNegativeQty]"
          :error-messages="save.apiError.value?.fieldMessage('prix_supplement')"
        />
      </VCol>
      <VCol
        cols="12"
        sm="6"
        class="d-flex align-center"
      >
        <VSwitch
          v-model="available"
          label="Proposé à la vente"
          color="primary"
          hide-details
        />
      </VCol>
      <VCol cols="12">
        <VTextarea
          v-model="description"
          label="Description (facultatif)"
          rows="2"
          auto-grow
        />
      </VCol>
    </VRow>
  </AppFormDialog>
</template>
