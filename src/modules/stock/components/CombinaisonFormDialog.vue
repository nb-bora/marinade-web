<script setup lang="ts">
import { stockApi } from '../api'
import { parseQty, positiveQty, required } from '../labels'
import type { Combinaison, Composant } from '../types'
import { useSubmit } from '@/composables/useSubmit'
import { useTenantStore } from '@/stores/tenant.store'
import { useToast } from '@/stores/toast.store'

const props = defineProps<{
  combinaison: Combinaison | null
  composants: Composant[]
}>()

const emit = defineEmits<{ saved: [] }>()
const open = defineModel<boolean>({ required: true })

const tenant = useTenantStore()
const toast = useToast()

const nom = ref('')
const prix = ref('')
const description = ref('')
const available = ref(true)
const selected = ref<string[]>([])

const isEdit = computed(() => props.combinaison !== null)

const options = computed(() => props.composants
  .map(item => ({ value: item.id, title: item.nom, subtitle: item.type }))
  .sort((a, b) => a.title.localeCompare(b.title, 'fr')))

const save = useSubmit(async () => {
  const body = {
    nom: nom.value.trim(),
    prix: parseQty(prix.value),
    description: description.value.trim() || null,
    disponible: available.value,
    composant_ids: selected.value,
  }

  if (props.combinaison)
    await stockApi.updateCombinaison(props.combinaison.id, body)
  else if (tenant.currentId)
    await stockApi.createCombinaison(tenant.currentId, { ...body, devise: 'XAF' })

  toast.success(props.combinaison ? 'Combinaison modifiée.' : 'Combinaison créée.')
  open.value = false
  emit('saved')
})

watch(open, isOpen => {
  if (!isOpen)
    return

  const source = props.combinaison

  nom.value = source?.nom ?? ''
  prix.value = source ? String(Number(source.prix)) : ''
  description.value = source?.description ?? ''
  available.value = source?.disponible ?? true
  selected.value = source ? [...source.composant_ids] : []
  save.reset()
})
</script>

<template>
  <AppFormDialog
    v-model="open"
    :title="isEdit ? 'Modifier la combinaison' : 'Nouvelle combinaison'"
    :subtitle="isEdit ? undefined : 'Une offre à prix unique composée de plusieurs composants, par exemple riz + sauce tomate + poulet.'"
    icon="ri-restaurant-2-line"
    :loading="save.pending.value"
    :error="save.message.value"
    @submit="save.submit()"
  >
    <VRow>
      <VCol
        cols="12"
        sm="8"
      >
        <VTextField
          v-model="nom"
          label="Nom de l'offre"
          prepend-inner-icon="ri-restaurant-2-line"
          autocomplete="off"
          autofocus
          :rules="[required('Indiquez le nom de la combinaison.')]"
          :error-messages="save.apiError.value?.fieldMessage('nom')"
        />
      </VCol>
      <VCol
        cols="12"
        sm="4"
      >
        <VTextField
          v-model="prix"
          label="Prix (FCFA)"
          prepend-inner-icon="ri-money-dollar-circle-line"
          inputmode="decimal"
          autocomplete="off"
          :rules="[positiveQty]"
          :error-messages="save.apiError.value?.fieldMessage('prix')"
        />
      </VCol>
      <VCol cols="12">
        <VAutocomplete
          v-model="selected"
          :items="options"
          label="Composants de l'offre"
          prepend-inner-icon="ri-flask-line"
          multiple
          chips
          closable-chips
          no-data-text="Aucun composant ne correspond."
          :rules="[(value: string[]) => value.length > 0 || 'Choisissez au moins un composant.']"
          :error-messages="save.apiError.value?.fieldMessage('composant_ids')"
        />
      </VCol>
      <VCol cols="12">
        <VTextarea
          v-model="description"
          label="Description (facultatif)"
          prepend-inner-icon="ri-file-text-line"
          rows="2"
          auto-grow
        />
      </VCol>
      <VCol cols="12">
        <VSwitch
          v-model="available"
          label="Activée à la carte"
          hint="Une offre activée n'est vendable que si le stock de tous ses composants le permet."
          persistent-hint
          color="primary"
        />
      </VCol>
    </VRow>
  </AppFormDialog>
</template>
