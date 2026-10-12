<!-- Constructeur de combinaison : un nom, un prix fixé et des lignes « article × quantité ». -->
<script setup lang="ts">
import { pressingApi } from '../api'
import { mergedLines, newLine, pressingError, toInt } from '../labels'
import type { Article, Combinaison, EditableLine } from '../types'
import LinesEditor from './LinesEditor.vue'
import type { LineItem } from './LinesEditor.vue'
import { useSubmit } from '@/composables/useSubmit'
import { formatMoney } from '@/lib/format'
import { useTenantStore } from '@/stores/tenant.store'
import { useToast } from '@/stores/toast.store'

const props = defineProps<{
  combinaison: Combinaison | null
  articles: Article[]
}>()

const emit = defineEmits<{ saved: [combinaison: Combinaison] }>()
const open = defineModel<boolean>({ required: true })

const tenant = useTenantStore()
const toast = useToast()

const nom = ref('')
const prix = ref('')
const actif = ref(true)
const lines = ref<EditableLine[]>([])

const isEdit = computed(() => props.combinaison !== null)

// Les articles actifs, plus ceux déjà présents dans la combinaison (même désactivés).
const items = computed<LineItem[]>(() => {
  const used = new Set(lines.value.map(line => line.id))

  return props.articles
    .filter(article => article.actif || used.has(article.id))
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
    .map(article => ({
      value: article.id,
      title: article.actif ? article.nom : `${article.nom} (désactivé)`,
      subtitle: formatMoney(article.prix_unitaire, 'XAF'),
    }))
})

const priceOf = (id: string) => {
  const article = props.articles.find(item => item.id === id)

  return article?.prix_unitaire ?? props.combinaison?.lignes.find(ligne => ligne.article_id === id)?.prix_unitaire_reference ?? 0
}

const merged = computed(() => mergedLines(lines.value))
const separateTotal = computed(() => merged.value.reduce((sum, line) => sum + priceOf(line.id) * line.quantite, 0))
const fixedPrice = computed(() => toInt(prix.value))
const difference = computed(() => fixedPrice.value === null ? null : separateTotal.value - fixedPrice.value)

const { submit, pending, error, apiError, reset } = useSubmit(async () => {
  const restaurantId = tenant.currentId

  if (!restaurantId)
    return

  const body = {
    nom: nom.value.trim(),
    prix: Number(prix.value),
    lignes: merged.value.map(line => ({ article_id: line.id, quantite: line.quantite })),
    actif: actif.value,
  }

  const saved = props.combinaison
    ? await pressingApi.updateCombinaison(restaurantId, props.combinaison.id, body)
    : await pressingApi.createCombinaison(restaurantId, body)

  toast.success(isEdit.value ? 'Combinaison modifiée.' : 'Combinaison créée.')
  open.value = false
  emit('saved', saved)
})

const nameError = computed(() =>
  apiError.value?.kind === 'conflict'
    ? 'Une combinaison porte déjà ce nom : choisissez-en un autre.'
    : apiError.value?.fieldMessage('nom'))

const globalError = computed(() => error.value && !nameError.value ? pressingError(error.value) : '')

watch(open, isOpen => {
  if (!isOpen)
    return

  reset()
  nom.value = props.combinaison?.nom ?? ''
  prix.value = props.combinaison ? String(props.combinaison.prix) : ''
  actif.value = props.combinaison?.actif ?? true
  lines.value = props.combinaison?.lignes.length
    ? props.combinaison.lignes.map(ligne => newLine(ligne.article_id, String(ligne.quantite)))
    : [newLine()]
})

watch(nom, () => {
  if (apiError.value?.kind === 'conflict')
    reset()
})

const nomRules = [(value: string) => {
  const length = value.trim().length

  return (length >= 1 && length <= 120) || 'Donnez un nom à la combinaison, de 1 à 120 caractères.'
}]

const prixRules = [(value: string) => toInt(value) !== null || 'Indiquez un prix en FCFA, nombre entier de 0 ou plus.']
const linesRules = [() => merged.value.length > 0 || 'Ajoutez au moins un article à la combinaison.']
</script>

<template>
  <AppFormDialog
    v-model="open"
    :title="isEdit ? 'Modifier la combinaison' : 'Nouvelle combinaison'"
    subtitle="Composez un ensemble d'articles vendu à un prix fixe."
    :submit-label="isEdit ? 'Enregistrer' : 'Créer'"
    :confirm-title="isEdit ? 'Enregistrer les modifications ?' : 'Créer cette combinaison ?'"
    :confirm-text="isEdit ? `Les changements apportés à « ${nom.trim()} » seront enregistrés.` : `« ${nom.trim()} » sera ajoutée à vos combinaisons.`"
    icon="ri-stack-line"
    :loading="pending"
    :error="globalError"
    @submit="submit"
  >
    <VRow>
      <VCol
        cols="12"
        sm="7"
      >
        <VTextField
          v-model="nom"
          label="Nom de la combinaison"
          prepend-inner-icon="ri-price-tag-3-line"
          placeholder="Drap + taie"
          :rules="nomRules"
          :error-messages="nameError"
          maxlength="120"
          autofocus
          data-testid="combo-nom"
        />
      </VCol>
      <VCol
        cols="12"
        sm="5"
      >
        <VTextField
          v-model="prix"
          label="Prix fixé (FCFA)"
          prepend-inner-icon="ri-money-dollar-circle-line"
          inputmode="numeric"
          placeholder="500"
          :rules="prixRules"
          :error-messages="apiError?.fieldMessage('prix')"
          data-testid="combo-prix"
        />
      </VCol>

      <VCol cols="12">
        <div class="text-subtitle-1 font-weight-medium mb-1">
          Articles de la combinaison
        </div>
        <VInput
          :model-value="merged"
          :rules="linesRules"
          hide-details="auto"
          class="mb-2"
        />
        <LinesEditor
          v-model="lines"
          :items="items"
          label="Article"
          icon="ri-t-shirt-line"
          add-label="Ajouter un article"
          empty-text="Aucun article pour l'instant : ajoutez le premier."
          id-prefix="combo-line"
          required
        />
      </VCol>

      <VCol cols="12">
        <VCard
          variant="tonal"
          :color="difference === null ? 'secondary' : difference < 0 ? 'warning' : 'success'"
          class="combo-summary"
          data-testid="combo-summary"
        >
          <VCardText>
            <div class="d-flex flex-wrap justify-space-between gap-2">
              <span>Somme des articles vendus séparément</span>
              <strong class="tabular-nums">{{ formatMoney(separateTotal, 'XAF') }}</strong>
            </div>
            <div class="d-flex flex-wrap justify-space-between gap-2">
              <span>Prix fixé de la combinaison</span>
              <strong class="tabular-nums">{{ fixedPrice === null ? '—' : formatMoney(fixedPrice, 'XAF') }}</strong>
            </div>
            <VDivider class="my-2" />
            <div
              v-if="difference === null"
              class="text-body-2"
            >
              Indiquez le prix fixé pour voir l'écart avec la vente séparée.
            </div>
            <div
              v-else-if="difference > 0"
              class="font-weight-semibold"
            >
              <VIcon
                icon="ri-arrow-down-circle-line"
                size="18"
                class="me-1"
              />
              Économie de {{ formatMoney(difference, 'XAF') }} pour le client.
            </div>
            <div
              v-else-if="difference < 0"
              class="font-weight-semibold"
            >
              <VIcon
                icon="ri-alert-line"
                size="18"
                class="me-1"
              />
              Majoration de {{ formatMoney(-difference, 'XAF') }} : l'ensemble coûte plus cher que les articles vendus séparément. Vous pouvez tout de même l'enregistrer.
            </div>
            <div
              v-else
              class="font-weight-semibold"
            >
              Le prix fixé est égal à la somme des articles.
            </div>
          </VCardText>
        </VCard>
      </VCol>

      <VCol cols="12">
        <VSwitch
          v-model="actif"
          label="Combinaison active (proposée au calculateur)"
          color="primary"
          hide-details
        />
      </VCol>
    </VRow>
  </AppFormDialog>
</template>
