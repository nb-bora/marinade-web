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

  /** La carte n'a pas pu être chargée. */
  failed?: boolean
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

const available = computed(() => (kind.value === 'plat' ? props.plats : props.boissons).filter(article => article.disponible))

const options = computed(() => available.value
  .map(article => ({ value: article.id, title: article.nom, subtitle: formatMoney(article.prix) })))

const MAX_QUANTITY = 99

const noDataText = computed(() => {
  if (props.loading)
    return 'Chargement…'

  return props.failed ? 'La carte n\'a pas pu être chargée.' : 'Aucun article disponible.'
})

const quantityValue = computed(() => Number(quantity.value))
const unitPrice = computed(() => Number(available.value.find(article => article.id === articleId.value)?.prix ?? 0))
const lineTotal = computed(() => (articleId.value && quantityValue.value > 0 ? unitPrice.value * quantityValue.value : null))

const step = (delta: number) => {
  const next = (Number.isInteger(quantityValue.value) ? quantityValue.value : 1) + delta

  quantity.value = Math.min(MAX_QUANTITY, Math.max(1, next))
}

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

const positive = (value: number) => {
  const number = Number(value)

  if (!Number.isInteger(number) || number < 1)
    return 'Indiquez une quantité d\'au moins 1.'

  return number <= MAX_QUANTITY ? true : `Au plus ${MAX_QUANTITY} par ligne.`
}
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

    <VAutocomplete
      v-model="articleId"
      :items="options"
      :label="kind === 'plat' ? 'Plat' : 'Boisson'"
      prepend-inner-icon="ri-restaurant-line"
      :loading="loading"
      :rules="[required]"
      :no-data-text="noDataText"
      class="mb-3"
    >
      <template #item="{ props: itemProps, item }">
        <VListItem
          v-bind="itemProps"
          :title="item.raw.title"
          :subtitle="item.raw.subtitle"
        />
      </template>
    </VAutocomplete>

    <div class="d-flex align-start gap-3 mb-3">
      <IconBtn
        class="mt-2"
        aria-label="Diminuer la quantité"
        :disabled="quantityValue <= 1"
        @click="step(-1)"
      >
        <VIcon icon="ri-subtract-line" />
      </IconBtn>
      <VTextField
        v-model.number="quantity"
        label="Quantité"
        type="number"
        min="1"
        :max="MAX_QUANTITY"
        :rules="[positive]"
        class="quantity-field"
      />
      <IconBtn
        class="mt-2"
        aria-label="Augmenter la quantité"
        :disabled="quantityValue >= MAX_QUANTITY"
        @click="step(1)"
      >
        <VIcon icon="ri-add-line" />
      </IconBtn>
      <div
        v-if="lineTotal !== null"
        class="line-total ms-auto"
      >
        <div class="text-caption text-medium-emphasis">
          Montant de la ligne
        </div>
        <div class="text-h6 font-weight-semibold tabular-nums">
          {{ formatMoney(lineTotal) }}
        </div>
      </div>
    </div>
    <VTextField
      v-model="notes"
      label="Note pour la cuisine (facultatif)"
      prepend-inner-icon="ri-file-text-line"
      placeholder="Sans piment, bien cuit…"
      maxlength="200"
    />
  </AppFormDialog>
</template>

<style scoped>
.quantity-field {
  flex: 0 1 120px;
}

.line-total {
  padding: 6px 14px;
  border-radius: 12px;
  background: rgba(var(--v-theme-primary), 0.08);
  text-align: end;
}
</style>
