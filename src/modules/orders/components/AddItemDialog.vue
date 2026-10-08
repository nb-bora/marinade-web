<script setup lang="ts">
import { ordersApi } from '../api'
import { explainError } from '../labels'
import type { Boisson, Plat } from '../types'
import { useSubmit } from '@/composables/useSubmit'
import { formatMoney } from '@/lib/format'
import { useToast } from '@/stores/toast.store'

const props = defineProps<{
  commandeId: string | null
  plats: Plat[]
  boissons: Boisson[]
  loading?: boolean
}>()

const emit = defineEmits<{ added: [] }>()

const open = defineModel<boolean>({ required: true })

type Kind = 'plat' | 'boisson'

const toast = useToast()
const kind = ref<Kind>('plat')
const articleId = ref<string | null>(null)
const quantity = ref(1)
const notes = ref('')

watch(open, isOpen => {
  if (isOpen) {
    kind.value = 'plat'
    articleId.value = null
    quantity.value = 1
    notes.value = ''
  }
})

watch(kind, () => {
  articleId.value = null
})

const options = computed(() => (kind.value === 'plat' ? props.plats : props.boissons)
  .filter(article => article.disponible)
  .map(article => ({ value: article.id, title: `${article.nom} · ${formatMoney(article.prix)}` })))

const { submit, pending, error } = useSubmit(async () => {
  await ordersApi.addItem(props.commandeId!, {
    plat_id: kind.value === 'plat' ? articleId.value : null,
    boisson_id: kind.value === 'boisson' ? articleId.value : null,
    quantite: quantity.value,
    notes: notes.value.trim() || null,
    supplement_ids: [],
  })

  toast.success('Article ajouté à la commande.')
  open.value = false
  emit('added')
})

const message = computed(() => error.value ? explainError(error.value) : '')

const required = (value: unknown) => (value ? true : 'Choisissez un article.')
const positive = (value: number) => (Number.isInteger(Number(value)) && Number(value) > 0 ? true : 'Indiquez une quantité d\'au moins 1.')
</script>

<template>
  <AppFormDialog
    v-model="open"
    title="Ajouter un article"
    subtitle="Le prix est repris de la carte. Le stock des ingrédients est réservé tout de suite."
    icon="ri-restaurant-2-line"
    submit-label="Ajouter"
    :loading="pending"
    :error="message"
    @submit="submit"
  >
    <div class="mb-5">
      <AppSegmented
        v-model="kind"
        label="Type d'article"
        :options="[{ value: 'plat', title: 'Plat' }, { value: 'boisson', title: 'Boisson' }]"
      />
    </div>

    <VSelect
      v-model="articleId"
      :items="options"
      :label="kind === 'plat' ? 'Plat' : 'Boisson'"
      :loading="loading"
      :rules="[required]"
      :no-data-text="loading ? 'Chargement…' : 'Aucun article disponible.'"
      class="mb-3"
    />
    <VTextField
      v-model.number="quantity"
      label="Quantité"
      type="number"
      min="1"
      :rules="[positive]"
      class="mb-3"
    />
    <VTextField
      v-model="notes"
      label="Note pour la cuisine (facultatif)"
      placeholder="Sans piment, bien cuit…"
      maxlength="200"
    />
  </AppFormDialog>
</template>
