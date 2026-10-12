<!-- Création et modification d'un article à l'unité (drap, taie d'oreiller, couette...). -->
<script setup lang="ts">
import { pressingApi } from '../api'
import { pressingError, toInt } from '../labels'
import type { Article } from '../types'
import { useSubmit } from '@/composables/useSubmit'
import { useTenantStore } from '@/stores/tenant.store'
import { useToast } from '@/stores/toast.store'

const props = defineProps<{
  article: Article | null

  /** Catégories déjà utilisées, proposées en suggestion. */
  suggestions: string[]
}>()

const emit = defineEmits<{ saved: [article: Article] }>()
const open = defineModel<boolean>({ required: true })

const tenant = useTenantStore()
const toast = useToast()

const nom = ref('')
const prix = ref('')
const categorie = ref<string | null>(null)
const actif = ref(true)

const isEdit = computed(() => props.article !== null)

const { submit, pending, error, apiError, reset } = useSubmit(async () => {
  const restaurantId = tenant.currentId

  if (!restaurantId)
    return

  const body = {
    nom: nom.value.trim(),
    prix_unitaire: Number(prix.value),
    categorie: categorie.value?.trim() || null,
    actif: actif.value,
  }

  const saved = props.article
    ? await pressingApi.updateArticle(restaurantId, props.article.id, body)
    : await pressingApi.createArticle(restaurantId, body)

  toast.success(isEdit.value ? 'Article modifié.' : 'Article ajouté.')
  open.value = false
  emit('saved', saved)
})

// Un nom déjà pris (409) s'affiche sous le champ, pas dans un bandeau.
const nameError = computed(() =>
  apiError.value?.kind === 'conflict'
    ? 'Un article porte déjà ce nom : choisissez-en un autre.'
    : apiError.value?.fieldMessage('nom'))

const globalError = computed(() => error.value && !nameError.value ? pressingError(error.value) : '')

watch(open, isOpen => {
  if (!isOpen)
    return

  reset()
  nom.value = props.article?.nom ?? ''
  prix.value = props.article ? String(props.article.prix_unitaire) : ''
  categorie.value = props.article?.categorie ?? null
  actif.value = props.article?.actif ?? true
})

watch(nom, () => {
  if (apiError.value?.kind === 'conflict')
    reset()
})

const nomRules = [(value: string) => {
  const length = value.trim().length

  return (length >= 1 && length <= 120) || 'Donnez un nom à l\'article, de 1 à 120 caractères.'
}]

const prixRules = [(value: string) => toInt(value) !== null || 'Indiquez un prix en FCFA, nombre entier de 0 ou plus.']
const categorieRules = [(value: string | null) => !value || value.length <= 80 || '80 caractères au plus.']
</script>

<template>
  <AppFormDialog
    v-model="open"
    :title="isEdit ? 'Modifier l\'article' : 'Nouvel article'"
    :subtitle="isEdit ? undefined : 'Une pièce facturée à l\'unité, ou utilisable dans une combinaison.'"
    :submit-label="isEdit ? 'Enregistrer' : 'Créer'"
    :confirm-title="isEdit ? 'Enregistrer les modifications ?' : 'Créer cet article ?'"
    :confirm-text="isEdit ? `Les changements apportés à « ${nom.trim()} » seront enregistrés.` : `« ${nom.trim()} » sera ajouté à vos articles.`"
    icon="ri-t-shirt-line"
    :loading="pending"
    :error="globalError"
    @submit="submit"
  >
    <VRow>
      <VCol cols="12">
        <VTextField
          v-model="nom"
          label="Nom de l'article"
          prepend-inner-icon="ri-price-tag-3-line"
          placeholder="Drap, taie d'oreiller, couette..."
          :rules="nomRules"
          :error-messages="nameError"
          maxlength="120"
          autofocus
          data-testid="article-nom"
        />
      </VCol>
      <VCol
        cols="12"
        sm="6"
      >
        <VTextField
          v-model="prix"
          label="Prix unitaire (FCFA)"
          prepend-inner-icon="ri-money-dollar-circle-line"
          inputmode="numeric"
          placeholder="1000"
          :rules="prixRules"
          :error-messages="apiError?.fieldMessage('prix_unitaire')"
          data-testid="article-prix"
        />
      </VCol>
      <VCol
        cols="12"
        sm="6"
      >
        <VCombobox
          v-model="categorie"
          :items="suggestions"
          label="Catégorie (facultative)"
          prepend-inner-icon="ri-folder-line"
          placeholder="Linge de lit, vêtements..."
          clearable
          :rules="categorieRules"
          :error-messages="apiError?.fieldMessage('categorie')"
          data-testid="article-categorie"
        />
      </VCol>
      <VCol cols="12">
        <VSwitch
          v-model="actif"
          label="Article actif (proposé au calculateur et aux combinaisons)"
          color="primary"
          hide-details
        />
      </VCol>
    </VRow>
  </AppFormDialog>
</template>
