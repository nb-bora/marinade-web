<!-- Création et modification d'un menu. -->
<script setup lang="ts">
import { catalogApi } from '../api'
import type { Menu } from '../types'
import { useSubmit } from '@/composables/useSubmit'
import { useTenantStore } from '@/stores/tenant.store'
import { useToast } from '@/stores/toast.store'

const props = defineProps<{ menu: Menu | null }>()
const emit = defineEmits<{ saved: [] }>()
const open = defineModel<boolean>({ required: true })

const tenant = useTenantStore()
const toast = useToast()

const name = ref('')
const description = ref('')
const actif = ref(true)

const isEdit = computed(() => props.menu !== null)

const { submit, pending, message, reset } = useSubmit(async () => {
  const body = { name: name.value.trim(), description: description.value.trim() || null, actif: actif.value }

  if (props.menu)
    await catalogApi.updateMenu(props.menu.id, body)
  else if (tenant.currentId)
    await catalogApi.createMenu(tenant.currentId, body)

  toast.success(isEdit.value ? 'Menu modifié.' : 'Menu créé.')
  open.value = false
  emit('saved')
})

watch(open, isOpen => {
  if (!isOpen)
    return

  reset()
  name.value = props.menu?.name ?? ''
  description.value = props.menu?.description ?? ''
  actif.value = props.menu?.actif ?? true
})

const required = [(value: string) => value.trim().length > 0 || 'Donnez un nom au menu.']
</script>

<template>
  <AppFormDialog
    v-model="open"
    :title="isEdit ? 'Modifier le menu' : 'Nouveau menu'"
    subtitle="Un menu regroupe des catégories : carte du midi, carte du soir, boissons..."
    icon="ri-book-open-line"
    :loading="pending"
    :error="message"
    @submit="submit"
  >
    <VRow>
      <VCol cols="12">
        <VTextField
          v-model="name"
          label="Nom du menu"
          placeholder="Carte du midi"
          :rules="required"
          maxlength="255"
          autofocus
        />
      </VCol>
      <VCol cols="12">
        <VTextarea
          v-model="description"
          label="Description (facultative)"
          rows="3"
          auto-grow
        />
      </VCol>
      <VCol cols="12">
        <VSwitch
          v-model="actif"
          label="Menu actif"
          hint="Un menu désactivé reste enregistré mais n'est plus proposé."
          persistent-hint
          color="primary"
        />
      </VCol>
    </VRow>
  </AppFormDialog>
</template>
