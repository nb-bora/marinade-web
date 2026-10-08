<!-- Création et modification d'une catégorie d'un menu. -->
<script setup lang="ts">
import { catalogApi } from '../api'
import type { Menu, MenuCategory } from '../types'
import { useSubmit } from '@/composables/useSubmit'
import { useToast } from '@/stores/toast.store'

const props = defineProps<{
  menu: Menu | null
  category: MenuCategory | null

  /** Ordre proposé pour une nouvelle catégorie (à la suite des autres). */
  nextOrder: number
}>()

const emit = defineEmits<{ saved: [] }>()
const open = defineModel<boolean>({ required: true })

const toast = useToast()

const name = ref('')
const ordre = ref(0)

const isEdit = computed(() => props.category !== null)

const { submit, pending, message, reset } = useSubmit(async () => {
  const body = { name: name.value.trim(), ordre: Number(ordre.value) }

  if (props.category)
    await catalogApi.updateCategory(props.category.id, body)
  else if (props.menu)
    await catalogApi.createCategory(props.menu.id, body)

  toast.success(isEdit.value ? 'Catégorie modifiée.' : 'Catégorie créée.')
  open.value = false
  emit('saved')
})

watch(open, isOpen => {
  if (!isOpen)
    return

  reset()
  name.value = props.category?.name ?? ''
  ordre.value = props.category?.ordre ?? props.nextOrder
})

const nameRules = [(value: string) => value.trim().length > 0 || 'Donnez un nom à la catégorie.']
const orderRules = [(value: number | string) => (Number.isInteger(Number(value)) && Number(value) >= 0) || 'Indiquez un nombre entier, 0 ou plus.']
</script>

<template>
  <AppFormDialog
    v-model="open"
    :title="isEdit ? 'Modifier la catégorie' : 'Nouvelle catégorie'"
    :subtitle="menu ? `Dans le menu « ${menu.name} »` : undefined"
    icon="ri-price-tag-3-line"
    :loading="pending"
    :error="message"
    @submit="submit"
  >
    <VRow>
      <VCol cols="12">
        <VTextField
          v-model="name"
          label="Nom de la catégorie"
          prepend-inner-icon="ri-price-tag-3-line"
          placeholder="Entrées"
          :rules="nameRules"
          maxlength="100"
          autofocus
        />
      </VCol>
      <VCol cols="12">
        <VTextField
          v-model="ordre"
          label="Position dans le menu"
          prepend-inner-icon="ri-hashtag"
          type="number"
          min="0"
          step="1"
          :rules="orderRules"
          hint="Les catégories s'affichent de la plus petite position à la plus grande."
          persistent-hint
        />
      </VCol>
    </VRow>
  </AppFormDialog>
</template>
