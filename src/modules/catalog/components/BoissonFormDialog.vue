<!-- Création et modification d'une boisson. -->
<script setup lang="ts">
import { catalogApi } from '../api'
import type { Boisson } from '../types'
import { useSubmit } from '@/composables/useSubmit'
import { useTenantStore } from '@/stores/tenant.store'
import { useToast } from '@/stores/toast.store'

const props = defineProps<{
  boisson: Boisson | null

  /** Catégories déjà utilisées, proposées en suggestion. */
  suggestions: string[]
}>()

const emit = defineEmits<{ saved: [boisson: Boisson] }>()
const open = defineModel<boolean>({ required: true })

const tenant = useTenantStore()
const toast = useToast()

const nom = ref('')
const category = ref<string | null>(null)
const prix = ref('')
const description = ref('')
const alcool = ref(false)
const disponible = ref(true)

const isEdit = computed(() => props.boisson !== null)

const { submit, pending, message, apiError, reset } = useSubmit(async () => {
  const body = {
    nom: nom.value.trim(),
    category: category.value?.trim() || null,
    prix: Number(prix.value),
    description: description.value.trim() || null,
    alcool: alcool.value,
    disponible: disponible.value,
  }

  let saved: Boisson | undefined

  if (props.boisson)
    saved = await catalogApi.updateBoisson(props.boisson.id, body)
  else if (tenant.currentId)
    saved = await catalogApi.createBoisson(tenant.currentId, body)

  toast.success(isEdit.value ? 'Boisson modifiée.' : 'Boisson ajoutée à la carte.')
  open.value = false
  if (saved)
    emit('saved', saved)
})

watch(open, isOpen => {
  if (!isOpen)
    return

  reset()
  nom.value = props.boisson?.nom ?? ''
  category.value = props.boisson?.category ?? null
  prix.value = props.boisson ? String(Number(props.boisson.prix)) : ''
  description.value = props.boisson?.description ?? ''
  alcool.value = props.boisson?.alcool ?? false
  disponible.value = props.boisson?.disponible ?? true
})

const nomRules = [(value: string) => value.trim().length > 0 || 'Donnez un nom à la boisson.']
const prixRules = [(value: string) => Number(value) > 0 || 'Indiquez un prix supérieur à 0.']
const categoryRules = [(value: string | null) => !value || value.length <= 50 || '50 caractères au plus.']
</script>

<template>
  <AppFormDialog
    v-model="open"
    :title="isEdit ? 'Modifier la boisson' : 'Nouvelle boisson'"
    :subtitle="isEdit ? undefined : 'Elle apparaîtra sur la carte dès son enregistrement.'"
    icon="ri-goblet-line"
    :loading="pending"
    :error="message"
    :max-width="600"
    @submit="submit"
  >
    <VRow>
      <VCol cols="12">
        <VTextField
          v-model="nom"
          label="Nom de la boisson"
          placeholder="Jus de gingembre"
          :rules="nomRules"
          :error-messages="apiError?.fieldMessage('nom')"
          maxlength="255"
          autofocus
        />
      </VCol>
      <VCol
        cols="12"
        sm="6"
      >
        <VTextField
          v-model="prix"
          label="Prix (FCFA)"
          type="number"
          min="0"
          step="any"
          :rules="prixRules"
          :error-messages="apiError?.fieldMessage('prix')"
        />
      </VCol>
      <VCol
        cols="12"
        sm="6"
      >
        <VCombobox
          v-model="category"
          :items="suggestions"
          label="Catégorie (facultative)"
          placeholder="Jus, bières, sodas..."
          clearable
          :rules="categoryRules"
          :error-messages="apiError?.fieldMessage('category')"
        />
      </VCol>
      <VCol cols="12">
        <VTextarea
          v-model="description"
          label="Description (facultative)"
          rows="2"
          auto-grow
        />
      </VCol>
      <VCol
        cols="12"
        sm="6"
      >
        <VSwitch
          v-model="alcool"
          label="Contient de l'alcool"
          color="warning"
          hide-details
        />
      </VCol>
      <VCol
        cols="12"
        sm="6"
      >
        <VSwitch
          v-model="disponible"
          label="Disponible à la vente"
          color="primary"
          hide-details
        />
      </VCol>
    </VRow>
  </AppFormDialog>
</template>
