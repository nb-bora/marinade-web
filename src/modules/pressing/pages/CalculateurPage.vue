<script setup lang="ts">
import { useDisplay } from 'vuetify'
import { pressingApi } from '../api'
import LinesEditor from '../components/LinesEditor.vue'
import type { LineItem } from '../components/LinesEditor.vue'
import { formatKg, mergedLines, parseKg, pressingError, toInt } from '../labels'
import type { Calcul, CalculLigneType, EditableLine } from '../types'
import { useAsyncData } from '@/composables/useAsyncData'
import { formatMoney } from '@/lib/format'
import { useTenantStore } from '@/stores/tenant.store'

const TYPE_LABELS: Record<CalculLigneType, string> = {
  lavage: 'Lavage',
  sechage: 'Séchage',
  article: 'Article',
  combinaison: 'Combinaison',
}

const TYPE_ICONS: Record<CalculLigneType, string> = {
  lavage: 'ri-scales-3-line',
  sechage: 'ri-sun-line',
  article: 'ri-t-shirt-line',
  combinaison: 'ri-stack-line',
}

const tenant = useTenantStore()
const { lgAndUp } = useDisplay()
const allowed = computed(() => tenant.can('front_of_house') || tenant.can('cash_desk'))

// Données de référence
const tarifs = useAsyncData(
  signal => tenant.currentId ? pressingApi.tarifs(tenant.currentId, signal) : Promise.resolve(null),
  { watch: [() => tenant.currentId] },
)

const articles = useAsyncData(
  signal => tenant.currentId ? pressingApi.articles(tenant.currentId, true, signal) : Promise.resolve([]),
  { watch: [() => tenant.currentId] },
)

const combos = useAsyncData(
  signal => tenant.currentId ? pressingApi.combinaisons(tenant.currentId, signal) : Promise.resolve([]),
  { watch: [() => tenant.currentId] },
)

const dryingAvailable = computed(() => tarifs.data.value?.prix_sechage_kg !== null && tarifs.data.value !== null)
const loadError = computed(() => tarifs.error.value ?? articles.error.value ?? combos.error.value)
const loaded = computed(() => tarifs.data.value !== null && articles.data.value !== null && combos.data.value !== null)

const articleItems = computed<LineItem[]>(() =>
  (articles.data.value ?? [])
    .filter(article => article.actif)
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
    .map(article => ({ value: article.id, title: article.nom, subtitle: formatMoney(article.prix_unitaire, 'XAF') })))

const comboItems = computed<LineItem[]>(() =>
  (combos.data.value ?? [])
    .filter(combo => combo.actif)
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
    .map(combo => ({ value: combo.id, title: combo.nom, subtitle: formatMoney(combo.prix, 'XAF') })))

// Saisie
const weightText = ref('')
const wash = ref(true)
const dry = ref(false)
const articleLines = ref<EditableLine[]>([])
const comboLines = ref<EditableLine[]>([])
const discountText = ref('')
const showDetails = ref(false)

watch(dryingAvailable, available => {
  if (!available)
    dry.value = false
})

const needsWeight = computed(() => wash.value || dry.value)
const weight = computed(() => parseKg(weightText.value))

const weightError = computed(() => {
  if (!needsWeight.value || weightText.value.trim() === '')
    return ''

  return 'error' in weight.value ? weight.value.error : ''
})

const discount = computed(() => discountText.value.trim() === '' ? 0 : toInt(discountText.value))

// Le résultat le plus récent accepté
const result = ref<Calcul | null>(null)
const resultWeight = ref<number | null>(null)
const calculating = ref(false)
const calcError = ref('')

const discountError = computed(() => {
  if (discount.value === null)
    return 'La remise est un montant en FCFA, nombre entier de 0 ou plus.'

  if (result.value && discount.value > result.value.sous_total)
    return `La remise ne peut pas dépasser le sous-total de ${formatMoney(result.value.sous_total, 'XAF')}.`

  return ''
})

const hasItems = computed(() => mergedLines(articleLines.value).length > 0 || mergedLines(comboLines.value).length > 0)

/** Corps de la requête, ou `null` tant que la saisie ne permet pas de calculer. */
const request = computed(() => {
  const grams = 'grams' in weight.value ? weight.value.grams : null

  if (needsWeight.value && grams === null)
    return null
  if (!needsWeight.value && !hasItems.value)
    return null
  if (discount.value === null)
    return null

  return {
    poids_grams: needsWeight.value ? grams : null,
    lavage: wash.value,
    sechage: dry.value,
    articles: mergedLines(articleLines.value).map(line => ({ article_id: line.id, quantite: line.quantite })),
    combinaisons: mergedLines(comboLines.value).map(line => ({ combinaison_id: line.id, quantite: line.quantite })),

    // Une remise déjà reconnue trop haute n'est pas envoyée : on rafraîchit le sous-total.
    remise_fcfa: discountError.value ? 0 : discount.value,
  }
})

let controller: AbortController | null = null

async function calculate() {
  controller?.abort()

  const body = request.value
  const restaurantId = tenant.currentId

  if (!body || !restaurantId) {
    controller = null
    result.value = null
    calcError.value = ''
    calculating.value = false

    return
  }

  const current = new AbortController()

  controller = current
  calculating.value = true

  try {
    const response = await pressingApi.calcul(restaurantId, body, current.signal)

    if (current.signal.aborted)
      return

    result.value = response
    resultWeight.value = body.poids_grams
    calcError.value = ''
  }
  catch (cause) {
    if (current.signal.aborted)
      return

    result.value = null
    calcError.value = pressingError(cause)
  }
  finally {
    if (controller === current)
      calculating.value = false
  }
}

// Anti-rebond de 300 ms ; toute nouvelle saisie annule la requête en cours.
watchDebounced(() => JSON.stringify(request.value), calculate, { debounce: 300, immediate: true })
onScopeDispose(() => controller?.abort())

// Une saisie en cours rend le résultat affiché provisoire.
watch(() => JSON.stringify(request.value), () => {
  if (request.value)
    calculating.value = true
})

function reset() {
  weightText.value = ''
  wash.value = true
  dry.value = false
  articleLines.value = []
  comboLines.value = []
  discountText.value = ''
  showDetails.value = false
}

const quantityText = (ligne: Calcul['lignes'][number]) => {
  const quantity = Number(ligne.quantite).toLocaleString('fr-FR', { maximumFractionDigits: 3 })

  return ligne.type === 'lavage' || ligne.type === 'sechage' ? `${quantity} kg` : quantity
}

const weightRule = computed(() => {
  const billable = result.value?.poids_facturable_grams

  if (!needsWeight.value || billable === undefined || billable === null || resultWeight.value === null)
    return ''

  const base = `Poids facturable : ${formatKg(billable)}`

  return billable === resultWeight.value ? base : `${base} (${formatKg(resultWeight.value)} arrondis)`
})

const hintForWeight = computed(() => needsWeight.value ? 'Pesez le linge puis saisissez le poids en kilogrammes, avec une virgule.' : 'Le poids n\'est pas nécessaire : ni lavage ni séchage.')
</script>

<template>
  <div>
    <AppPageHeader
      title="Calculateur du pressing"
      subtitle="Pesez le linge, ajoutez les pièces à l'unité et les combinaisons : le total se calcule en direct."
    >
      <template
        v-if="allowed"
        #actions
      >
        <VBtn
          variant="tonal"
          prepend-icon="ri-refresh-line"
          data-testid="calc-reset"
          @click="reset"
        >
          Nouvelle pesée
        </VBtn>
      </template>
    </AppPageHeader>

    <AppEmptyState
      v-if="!allowed"
      icon="ri-lock-line"
      title="Calculateur réservé à la salle et à la caisse"
      text="Demandez au responsable du restaurant de vous donner accès à la salle ou à la caisse."
    />

    <AppErrorState
      v-else-if="loadError && !loaded"
      :error="loadError"
      @retry="() => { tarifs.reload(); articles.reload(); combos.reload() }"
    />

    <VRow v-else-if="!loaded">
      <VCol
        cols="12"
        lg="7"
      >
        <VSkeletonLoader type="article, article" />
      </VCol>
      <VCol
        cols="12"
        lg="5"
      >
        <VSkeletonLoader type="article" />
      </VCol>
    </VRow>

    <VRow v-else>
      <VCol
        cols="12"
        lg="7"
      >
        <VCard class="mb-6">
          <VCardItem>
            <template #prepend>
              <VAvatar
                color="primary"
                variant="tonal"
                rounded
              >
                <VIcon icon="ri-scales-3-line" />
              </VAvatar>
            </template>
            <VCardTitle>Pesée et services</VCardTitle>
          </VCardItem>
          <VCardText>
            <VTextField
              v-model="weightText"
              label="Poids du linge (kg)"
              prepend-inner-icon="ri-scales-3-line"
              placeholder="3,4"
              inputmode="decimal"
              suffix="kg"
              autocomplete="off"
              :disabled="!needsWeight"
              :error-messages="weightError"
              :hint="weightError ? undefined : hintForWeight"
              persistent-hint
              data-testid="calc-poids"
            />
            <div class="d-flex flex-wrap gap-x-8 mt-4">
              <VSwitch
                v-model="wash"
                label="Lavage"
                color="primary"
                hide-details
                data-testid="calc-lavage"
              />
              <VSwitch
                v-model="dry"
                label="Séchage"
                color="primary"
                hide-details
                :disabled="!dryingAvailable"
                data-testid="calc-sechage"
              />
            </div>
            <VAlert
              v-if="!dryingAvailable"
              type="info"
              variant="tonal"
              density="compact"
              class="mt-3"
            >
              Le séchage n'est pas proposé par ce pressing. La direction peut l'activer dans les tarifs.
            </VAlert>
          </VCardText>
        </VCard>

        <VCard class="mb-6">
          <VCardItem>
            <template #prepend>
              <VAvatar
                color="info"
                variant="tonal"
                rounded
              >
                <VIcon icon="ri-t-shirt-line" />
              </VAvatar>
            </template>
            <VCardTitle>Articles à l'unité</VCardTitle>
          </VCardItem>
          <VCardText>
            <LinesEditor
              v-model="articleLines"
              :items="articleItems"
              label="Article"
              icon="ri-t-shirt-line"
              add-label="Ajouter un article"
              empty-text="Aucun article ajouté : ce sont les pièces facturées à l'unité."
              id-prefix="calc-article"
            />
          </VCardText>
        </VCard>

        <VCard class="mb-6">
          <VCardItem>
            <template #prepend>
              <VAvatar
                color="warning"
                variant="tonal"
                rounded
              >
                <VIcon icon="ri-stack-line" />
              </VAvatar>
            </template>
            <VCardTitle>Combinaisons</VCardTitle>
          </VCardItem>
          <VCardText>
            <LinesEditor
              v-model="comboLines"
              :items="comboItems"
              label="Combinaison"
              icon="ri-stack-line"
              add-label="Ajouter une combinaison"
              empty-text="Aucune combinaison ajoutée : ce sont vos ensembles à prix fixe."
              id-prefix="calc-combo"
            />
          </VCardText>
        </VCard>

        <VCard>
          <VCardItem>
            <template #prepend>
              <VAvatar
                color="success"
                variant="tonal"
                rounded
              >
                <VIcon icon="ri-percent-line" />
              </VAvatar>
            </template>
            <VCardTitle>Remise</VCardTitle>
          </VCardItem>
          <VCardText>
            <VTextField
              v-model="discountText"
              label="Remise (FCFA, facultative)"
              prepend-inner-icon="ri-percent-line"
              placeholder="0"
              inputmode="numeric"
              :error-messages="discountError"
              data-testid="calc-remise"
            />
          </VCardText>
        </VCard>
      </VCol>

      <VCol
        cols="12"
        lg="5"
        class="calc-col"
      >
        <VCard
          class="calc-summary"
          data-testid="calc-summary"
        >
          <VCardItem class="pb-1">
            <VCardTitle>Résumé</VCardTitle>
            <template #append>
              <VProgressCircular
                v-if="calculating"
                indeterminate
                size="20"
                width="2"
                aria-label="Calcul en cours"
              />
              <VBtn
                v-if="!lgAndUp && result"
                variant="text"
                size="small"
                :append-icon="showDetails ? 'ri-arrow-down-s-line' : 'ri-arrow-up-s-line'"
                data-testid="calc-toggle"
                @click="showDetails = !showDetails"
              >
                {{ showDetails ? 'Masquer le détail' : 'Voir le détail' }}
              </VBtn>
            </template>
          </VCardItem>

          <VCardText class="pt-2">
            <VAlert
              v-if="calcError"
              type="error"
              variant="tonal"
              density="compact"
              class="mb-3"
              data-testid="calc-error"
            >
              {{ calcError }}
            </VAlert>

            <p
              v-if="!result && !calcError"
              class="text-body-2 text-medium-emphasis mb-3"
            >
              {{ needsWeight ? 'Saisissez le poids du linge pour voir le détail du calcul.' : 'Ajoutez des articles ou des combinaisons pour voir le détail du calcul.' }}
            </p>

            <template v-if="result">
              <div v-show="lgAndUp || showDetails">
                <div
                  v-if="weightRule"
                  class="text-body-2 font-weight-medium mb-3"
                  data-testid="calc-poids-facturable"
                >
                  {{ weightRule }}
                </div>

                <VList
                  density="compact"
                  class="pa-0 mb-3 calc-lines"
                  data-testid="calc-lignes"
                >
                  <VListItem
                    v-for="(ligne, index) in result.lignes"
                    :key="`${ligne.type}-${index}`"
                    class="px-0"
                  >
                    <template #prepend>
                      <VAvatar
                        color="primary"
                        variant="tonal"
                        size="32"
                        rounded
                        class="me-3"
                      >
                        <VIcon
                          :icon="TYPE_ICONS[ligne.type]"
                          size="18"
                        />
                      </VAvatar>
                    </template>
                    <VListItemTitle class="text-wrap">
                      {{ ligne.libelle }}
                    </VListItemTitle>
                    <VListItemSubtitle class="text-wrap">
                      {{ TYPE_LABELS[ligne.type] }} · {{ quantityText(ligne) }} × <AppMoney :amount="ligne.prix_unitaire" />
                    </VListItemSubtitle>
                    <template #append>
                      <strong class="text-high-emphasis"><AppMoney :amount="ligne.montant" /></strong>
                    </template>
                  </VListItem>
                </VList>

                <VDivider class="mb-3" />
                <div class="d-flex justify-space-between mb-1">
                  <span>Sous-total</span>
                  <AppMoney :amount="result.sous_total" />
                </div>
                <div class="d-flex justify-space-between mb-3">
                  <span>Remise</span>
                  <span>
                    <template v-if="result.remise_fcfa > 0">− </template><AppMoney :amount="result.remise_fcfa" />
                  </span>
                </div>
              </div>

              <div class="d-flex align-baseline justify-space-between gap-3">
                <span class="text-h6">Total</span>
                <span
                  class="text-h4 font-weight-bold text-primary tabular-nums"
                  data-testid="calc-total"
                ><AppMoney :amount="result.total" /></span>
              </div>
            </template>

            <div class="mt-4">
              <VBtn
                block
                disabled
                prepend-icon="ri-hand-coin-line"
                data-testid="calc-encaisser"
              >
                Encaisser (bientôt)
              </VBtn>
              <p class="text-caption text-medium-emphasis mt-2 mb-0 d-none d-lg-block">
                L'encaissement et l'enregistrement de la commande arrivent bientôt : ce calcul est un aperçu.
              </p>
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>
  </div>
</template>

<style scoped>
/* Téléphone : la colonne s'efface pour que le résumé reste collé en bas de toute la page. */
.calc-col {
  display: contents;
}

.calc-summary {
  position: sticky;
  inset-block-end: 0;
  z-index: 5;
  flex: 0 0 calc(100% - 24px);
  margin-inline: 12px;
  margin-block-end: 8px;
}

.calc-lines {
  max-block-size: 18rem;
  overflow-y: auto;
}

.calc-lines :deep(.v-list-item-subtitle) {
  -webkit-line-clamp: unset;
  white-space: normal;
}

@media (width >= 1280px) {
  .calc-col {
    display: block;
  }

  .calc-summary {
    flex: none;
    margin: 0;
    inset-block: 5rem auto;
  }

  .calc-lines {
    max-block-size: none;
  }
}
</style>
