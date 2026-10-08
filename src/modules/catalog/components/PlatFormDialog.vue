<!-- Création et modification d'un plat. -->
<script setup lang="ts">
import { catalogApi } from '../api'
import type { CategoryWithMenu, Plat } from '../types'
import { useSubmit } from '@/composables/useSubmit'
import { useTenantStore } from '@/stores/tenant.store'
import { useToast } from '@/stores/toast.store'

const props = defineProps<{
  plat: Plat | null
  categories: CategoryWithMenu[]
}>()

const emit = defineEmits<{ saved: [plat: Plat] }>()
const open = defineModel<boolean>({ required: true })

const tenant = useTenantStore()
const toast = useToast()

const nom = ref('')
const categoryId = ref<string | null>(null)
const prix = ref<string>('')
const temps = ref<string>('')
const description = ref('')
const photoUrl = ref('')
const disponible = ref(true)

const isEdit = computed(() => props.plat !== null)

const categoryItems = computed(() => props.categories.map(category => ({
  value: category.id,
  title: category.name,
  subtitle: category.menuName,
})))

const { submit, pending, message, apiError, reset } = useSubmit(async () => {
  const body = {
    nom: nom.value.trim(),
    category_id: categoryId.value,
    prix: Number(prix.value),
    temps_preparation: temps.value === '' ? null : Number(temps.value),
    description: description.value.trim() || null,
    photo_url: photoUrl.value.trim() || null,
    disponible: disponible.value,
  }

  let saved: Plat | undefined

  if (props.plat)
    saved = await catalogApi.updatePlat(props.plat.id, body)
  else if (tenant.currentId)
    saved = await catalogApi.createPlat(tenant.currentId, body)

  toast.success(isEdit.value ? 'Plat modifié.' : 'Plat ajouté à la carte.')
  open.value = false
  if (saved)
    emit('saved', saved)
})

watch(open, isOpen => {
  if (!isOpen)
    return

  reset()
  nom.value = props.plat?.nom ?? ''
  categoryId.value = props.plat?.category_id ?? null
  prix.value = props.plat ? String(Number(props.plat.prix)) : ''
  temps.value = props.plat?.temps_preparation != null ? String(props.plat.temps_preparation) : ''
  description.value = props.plat?.description ?? ''
  photoUrl.value = props.plat?.photo_url ?? ''
  disponible.value = props.plat?.disponible ?? true
})

const nomRules = [(value: string) => value.trim().length > 0 || 'Donnez un nom au plat.']
const prixRules = [(value: string) => Number(value) > 0 || 'Indiquez un prix supérieur à 0.']
const tempsRules = [(value: string) => value === '' || (Number.isInteger(Number(value)) && Number(value) >= 0) || 'Indiquez un nombre entier de minutes.']
const photoRules = [(value: string) => value.trim() === '' || /^https?:\/\//i.test(value.trim()) || 'L\'adresse doit commencer par http:// ou https://.']
</script>

<template>
  <AppFormDialog
    v-model="open"
    :title="isEdit ? 'Modifier le plat' : 'Nouveau plat'"
    :subtitle="isEdit ? undefined : 'Il apparaîtra sur la carte dès son enregistrement.'"
    icon="ri-restaurant-2-line"
    :loading="pending"
    :error="message"
    @submit="submit"
  >
    <VRow>
      <VCol cols="12">
        <VTextField
          v-model="nom"
          label="Nom du plat"
          prepend-inner-icon="ri-restaurant-line"
          placeholder="Poulet DG"
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
          prepend-inner-icon="ri-money-dollar-circle-line"
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
        <VTextField
          v-model="temps"
          label="Temps de préparation (minutes)"
          prepend-inner-icon="ri-time-line"
          type="number"
          min="0"
          step="1"
          :rules="tempsRules"
          :error-messages="apiError?.fieldMessage('temps_preparation')"
        />
      </VCol>
      <VCol cols="12">
        <VSelect
          v-model="categoryId"
          :items="categoryItems"
          label="Catégorie"
          prepend-inner-icon="ri-price-tag-3-line"
          placeholder="Sans catégorie"
          clearable
          :hint="categories.length ? undefined : 'Créez d\'abord un menu et ses catégories pour classer vos plats.'"
          :persistent-hint="categories.length === 0"
        >
          <template #item="{ props: itemProps, item }">
            <VListItem
              v-bind="itemProps"
              :title="item.raw.title"
              :subtitle="`Menu ${item.raw.subtitle}`"
            />
          </template>
        </VSelect>
      </VCol>
      <VCol cols="12">
        <VTextarea
          v-model="description"
          label="Description (facultative)"
          prepend-inner-icon="ri-file-text-line"
          rows="2"
          auto-grow
        />
      </VCol>
      <VCol cols="12">
        <VTextField
          v-model="photoUrl"
          label="Adresse de la photo (facultative)"
          placeholder="https://..."
          prepend-inner-icon="ri-image-line"
          :rules="photoRules"
          :error-messages="apiError?.fieldMessage('photo_url')"
        />
      </VCol>
      <VCol cols="12">
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
