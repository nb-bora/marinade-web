<!--
  Saisie d'une commande (page dédiée : c'est un flux, pas une fenêtre) et modification d'une commande
  encore « reçue ». Cinq étapes visibles dans l'ordre : client, linge, articles et combinaisons,
  remise et instructions, puis récapitulatif calculé en direct par le serveur (anti-rebond de 300 ms,
  aucune réponse périmée).
-->
<script setup lang="ts">
import { useDisplay } from 'vuetify'
import { pressingApi } from '../api'
import { LINEN_CHOICES, MODES_PAIEMENT, MODE_PAIEMENT_INFO, STATUT_INFO, linenLabel, quantityText } from '../commandes'
import LinesEditor from '../components/LinesEditor.vue'
import type { LineItem } from '../components/LinesEditor.vue'
import { MODE_LABELS, STEP_LABELS, formatKg, formatPhone, mergedLines, newLine, parseKg, pressingError, toInt } from '../labels'
import type { Calcul, CalculLigneType, Client, Commande, CommandeWrite, EditableLine, PaiementMode } from '../types'
import { useAsyncData } from '@/composables/useAsyncData'
import { useConfirm } from '@/composables/useConfirm'
import { useSubmit } from '@/composables/useSubmit'
import { formatMoney } from '@/lib/format'
import { useTenantStore } from '@/stores/tenant.store'
import { useToast } from '@/stores/toast.store'

const route = useRoute()
const router = useRouter()
const tenant = useTenantStore()
const toast = useToast()
const confirm = useConfirm()
const { lgAndUp } = useDisplay()

const editedId = computed(() => typeof route.params.id === 'string' ? route.params.id : null)
const editing = computed(() => editedId.value !== null)
const allowed = computed(() => tenant.can('front_of_house'))

const TYPE_LABELS: Record<CalculLigneType, string> = { lavage: 'Lavage', sechage: 'Séchage', article: 'Article', combinaison: 'Combinaison' }
const TYPE_ICONS: Record<CalculLigneType, string> = { lavage: 'ri-drop-line', sechage: 'ri-sun-line', article: 'ri-t-shirt-line', combinaison: 'ri-stack-line' }

// --- Données de référence ----------------------------------------------------------------------

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

const original = useAsyncData(
  signal => tenant.currentId && editedId.value ? pressingApi.commande(tenant.currentId, editedId.value, signal) : Promise.resolve(null as Commande | null),
  { watch: [() => tenant.currentId, editedId] },
)

const dryingAvailable = computed(() => tarifs.data.value !== null && tarifs.data.value.prix_sechage_kg !== null)
const loaded = computed(() => tarifs.data.value !== null && articles.data.value !== null && combos.data.value !== null && (!editing.value || original.data.value !== null))
const loadError = computed(() => tarifs.error.value ?? articles.error.value ?? combos.error.value ?? original.error.value)

const articleItems = computed<LineItem[]>(() => (articles.data.value ?? [])
  .filter(article => article.actif)
  .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
  .map(article => ({ value: article.id, title: article.nom, subtitle: formatMoney(article.prix_unitaire) })))

const comboItems = computed<LineItem[]>(() => (combos.data.value ?? [])
  .filter(combo => combo.actif)
  .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
  .map(combo => ({ value: combo.id, title: combo.nom, subtitle: formatMoney(combo.prix) })))

// --- Saisie ------------------------------------------------------------------------------------

const clientName = ref('')
const clientPhone = ref('')
const weightText = ref('')
const wash = ref(true)
const dry = ref(false)
const linen = ref<string[]>([])
const articleLines = ref<EditableLine[]>([])
const comboLines = ref<EditableLine[]>([])
const discountText = ref('')
const instructions = ref('')
const unmatched = ref<string[]>([])
const showDetails = ref(false)
const form = ref()

// Acompte facultatif, encaissé juste après la création (jamais à la modification).
const depositText = ref('')
const depositMode = ref<PaiementMode>('especes')
const deposit = computed(() => depositText.value.trim() === '' ? 0 : toInt(depositText.value))

// Clients déjà connus : évite de créer un doublon à la saisie du nom ou du téléphone.
const suggestions = ref<Client[]>([])

const suggestQuery = computed(() => {
  const name = clientName.value.trim()

  if (name.length >= 2)
    return name

  const digits = clientPhone.value.replace(/\D/g, '')

  return digits.length >= 3 ? digits : ''
})

watchDebounced(suggestQuery, async query => {
  if (!query || !tenant.currentId || editing.value) {
    suggestions.value = []

    return
  }

  try {
    suggestions.value = await pressingApi.clientsPage(tenant.currentId, { q: query, limit: 5 })
  }
  catch {
    suggestions.value = []
  }
}, { debounce: 300 })

function pickClient(client: Client) {
  clientName.value = client.nom
  clientPhone.value = client.telephone ?? ''
  suggestions.value = []
}

// Une commande qui n'est plus « reçue » ne se modifie plus : on renvoie vers sa fiche, avec le motif.
watch(() => original.data.value, commande => {
  if (!editing.value || !commande || commande.statut === 'recue')
    return

  toast.error(`La commande ${commande.numero} n'est plus modifiable : elle est ${STATUT_INFO[commande.statut].label.toLowerCase()}.`)
  router.replace(`/pressing/commandes/${commande.id}`).catch(() => undefined)
}, { immediate: true })

watch(dryingAvailable, available => {
  if (!available)
    dry.value = false
})

// Modification : on reprend la commande telle qu'elle est enregistrée.
watch(loaded, ready => {
  const commande = original.data.value

  if (!ready || !commande || !editing.value || !articles.data.value || !combos.data.value)
    return

  clientName.value = commande.client_nom
  clientPhone.value = commande.client_telephone ?? ''
  weightText.value = commande.poids_grams ? String(commande.poids_grams / 1000).replace('.', ',') : ''
  wash.value = commande.lavage
  dry.value = commande.sechage
  linen.value = [...commande.types_linge]
  discountText.value = commande.remise_fcfa ? String(commande.remise_fcfa) : ''
  instructions.value = commande.instructions ?? ''

  // Les lignes figées ne portent que le libellé : on retrouve l'article ou la combinaison par son nom.
  const missing: string[] = []
  const articleRows: EditableLine[] = []
  const comboRows: EditableLine[] = []

  for (const ligne of commande.lignes) {
    if (ligne.type === 'article') {
      const found = articles.data.value.find(article => article.nom === ligne.libelle && article.actif)

      if (found)
        articleRows.push(newLine(found.id, String(Number(ligne.quantite))))
      else missing.push(ligne.libelle)
    }
    else if (ligne.type === 'combinaison') {
      const found = combos.data.value.find(combo => combo.nom === ligne.libelle && combo.actif)

      if (found)
        comboRows.push(newLine(found.id, String(Number(ligne.quantite))))
      else missing.push(ligne.libelle)
    }
  }

  articleLines.value = articleRows
  comboLines.value = comboRows
  unmatched.value = missing
}, { immediate: true })

const result = ref<Calcul | null>(null)
const resultWeight = ref<number | null>(null)
const calculating = ref(false)
const calcError = ref('')

const needsWeight = computed(() => wash.value || dry.value)
const weight = computed(() => parseKg(weightText.value))
const weightError = computed(() => !needsWeight.value || weightText.value.trim() === '' ? '' : 'error' in weight.value ? weight.value.error : '')
const discount = computed(() => discountText.value.trim() === '' ? 0 : toInt(discountText.value))
const hasItems = computed(() => mergedLines(articleLines.value).length > 0 || mergedLines(comboLines.value).length > 0)

const discountError = computed(() => {
  if (discount.value === null)
    return 'La remise est un montant en FCFA, nombre entier de 0 ou plus.'

  if (result.value && discount.value > result.value.sous_total)
    return `La remise ne peut pas dépasser le sous-total de ${formatMoney(result.value.sous_total)}.`

  return ''
})

/** Corps commun de la création, de la modification et du calcul. */
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
    remise_fcfa: discountError.value ? 0 : discount.value,
  }
})

// --- Récapitulatif en direct -------------------------------------------------------------------

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

watchDebounced(() => JSON.stringify(request.value), calculate, { debounce: 300, immediate: true })
onScopeDispose(() => controller?.abort())

watch(() => JSON.stringify(request.value), () => {
  if (request.value)
    calculating.value = true
})

const weightRule = computed(() => {
  const billable = result.value?.poids_facturable_grams

  if (!needsWeight.value || billable === undefined || billable === null || resultWeight.value === null)
    return ''

  const base = `Poids facturable : ${formatKg(billable)}`

  return billable === resultWeight.value ? base : `${base} (${formatKg(resultWeight.value)} pesés)`
})

const tarifLine = computed(() => {
  const data = tarifs.data.value

  if (!data)
    return ''

  return `${formatMoney(data.prix_kg)} le kilo`
})

// --- Enregistrement ----------------------------------------------------------------------------

function payload(): CommandeWrite | null {
  const body = request.value

  if (!body)
    return null

  return {
    ...body,
    client_nom: clientName.value.trim(),
    client_telephone: clientPhone.value || null,
    types_linge: linen.value,
    instructions: instructions.value.trim() || null,
  }
}

const saving = useSubmit(async (body: CommandeWrite) => {
  if (!tenant.currentId)
    throw new Error('no tenant')

  return editedId.value
    ? pressingApi.updateCommande(tenant.currentId, editedId.value, body)
    : pressingApi.createCommande(tenant.currentId, body)
})

const depositError = computed(() => {
  if (deposit.value === null)
    return 'L\'acompte est un montant en FCFA, nombre entier de 0 ou plus.'

  if (result.value && deposit.value > result.value.total)
    return `L'acompte ne peut pas dépasser le total de ${formatMoney(result.value.total)}.`

  return ''
})

const canSave = computed(() => !!result.value && !calculating.value && !calcError.value && clientName.value.trim() !== '' && !discountError.value && !depositError.value)

/** Encaisse l'acompte après la création. Un échec ne perd pas la commande : il est dit, et l'encaissement se fait depuis la fiche. */
async function takeDeposit(commandeId: string): Promise<string> {
  if (!tenant.currentId || !deposit.value)
    return ''

  try {
    await pressingApi.pay(tenant.currentId, commandeId, { montant: deposit.value, mode: depositMode.value, reference: null })

    return ''
  }
  catch (cause) {
    return pressingError(cause)
  }
}

async function save() {
  if (!(await form.value?.validate())?.valid) {
    // Erreur hors écran : on la montre (ligne d'article vide, par exemple).
    await nextTick()
    document.querySelector('.v-input--error')?.scrollIntoView({ behavior: 'smooth', block: 'center' })

    return
  }

  const body = payload()

  if (!body || !result.value)
    return

  const deposited = !editing.value && deposit.value ? ` Un acompte de ${formatMoney(deposit.value)} sera encaissé.` : ''

  const accepted = await confirm({
    title: editing.value ? 'Enregistrer les modifications ?' : `Créer la commande de ${body.client_nom} ?`,
    text: `Le total de la commande est de ${formatMoney(result.value.total)}.${editing.value ? ' Les lignes seront recalculées.' : ' Le numéro est attribué à l\'enregistrement.'}${deposited}`,
    confirmLabel: editing.value ? 'Enregistrer' : 'Créer la commande',
  })

  if (!accepted)
    return

  const saved = await saving.submit(body)

  if (!saved) {
    toast.error(saving.message.value)

    return
  }

  toast.success(editing.value ? `La commande ${saved.numero} est modifiée.` : `La commande ${saved.numero} est créée.`)

  if (!editing.value) {
    const failure = await takeDeposit(saved.id)

    if (failure)
      toast.error(`La commande ${saved.numero} est créée, mais l'acompte n'a pas été enregistré : ${failure}. Encaissez-le depuis la fiche.`)
  }

  await router.push({ path: `/pressing/commandes/${saved.id}`, query: editing.value ? {} : { recommander: '1' } })
}

const required = [(value: string) => value.trim() !== '' || 'Indiquez le nom du client.']

const stepClient = computed(() => clientName.value.trim() !== '')
const stepLinge = computed(() => !needsWeight.value || 'grams' in weight.value)
</script>

<template>
  <div>
    <AppPageHeader
      :title="editing ? 'Modifier la commande' : 'Nouvelle commande'"
      :subtitle="editing ? 'Le contenu peut être changé tant que la commande est « reçue ». Les lignes seront recalculées.' : 'Saisissez le client, pesez le linge puis vérifiez le total avant d\'enregistrer.'"
    >
      <template #actions>
        <VBtn
          variant="outlined"
          color="secondary"
          prepend-icon="ri-arrow-left-line"
          :to="editedId ? `/pressing/commandes/${editedId}` : '/pressing/commandes'"
        >
          {{ editing ? 'Retour à la commande' : 'Retour aux commandes' }}
        </VBtn>
      </template>
    </AppPageHeader>

    <VCard v-if="!allowed">
      <AppEmptyState
        icon="ri-lock-line"
        title="Saisie réservée à la salle"
        text="Demandez au responsable du pressing de vous donner accès à la salle."
      />
    </VCard>

    <AppErrorState
      v-else-if="loadError && !loaded"
      :error="loadError"
      @retry="() => { tarifs.reload(); articles.reload(); combos.reload(); original.reload() }"
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

    <VForm
      v-else
      ref="form"
      validate-on="submit lazy"
      @submit.prevent="save"
    >
      <VRow>
        <VCol
          cols="12"
          lg="7"
        >
          <VAlert
            v-if="unmatched.length"
            type="warning"
            variant="tonal"
            class="mb-6"
          >
            Ces lignes de la commande n'existent plus parmi les articles ou combinaisons actifs : {{ unmatched.join(', ') }}. Ajoutez-les de nouveau si besoin, sinon elles seront retirées.
          </VAlert>

          <VCard
            class="mb-6"
            data-tour="order-client"
          >
            <VCardItem>
              <template #prepend>
                <VAvatar
                  color="primary"
                  variant="tonal"
                  rounded
                >
                  <VIcon icon="ri-user-3-line" />
                </VAvatar>
              </template>
              <VCardTitle>1. Client</VCardTitle>
              <VCardSubtitle>Le nom suffit ; le téléphone permet de retrouver ses commandes.</VCardSubtitle>
            </VCardItem>
            <VCardText>
              <VRow>
                <VCol
                  cols="12"
                  md="6"
                >
                  <VTextField
                    v-model="clientName"
                    label="Nom du client"
                    prepend-inner-icon="ri-user-line"
                    placeholder="Mme Ngono"
                    :rules="required"
                    autocomplete="off"
                    data-testid="order-client-nom"
                  />
                </VCol>
                <VCol
                  cols="12"
                  md="6"
                >
                  <AppPhoneField
                    v-model="clientPhone"
                    label="Téléphone (facultatif)"
                    data-testid="order-client-tel"
                  />
                </VCol>
              </VRow>
              <div
                v-if="suggestions.length && !editing"
                class="mt-3"
                data-testid="order-client-suggestions"
              >
                <div class="text-body-2 text-medium-emphasis mb-2">
                  Clients déjà connus : choisissez-en un pour ne pas créer de doublon.
                </div>
                <div class="d-flex flex-wrap gap-2">
                  <VChip
                    v-for="(client, index) in suggestions"
                    :key="`${client.nom}-${index}`"
                    variant="outlined"
                    prepend-icon="ri-user-line"
                    size="large"
                    class="action-btn"
                    :data-testid="`order-client-pick-${index}`"
                    @click="pickClient(client)"
                  >
                    {{ client.nom }}<template v-if="client.telephone">
                      · {{ formatPhone(client.telephone) }}
                    </template>
                  </VChip>
                </div>
              </div>
            </VCardText>
          </VCard>

          <VCard
            class="mb-6"
            data-tour="order-weight"
          >
            <VCardItem>
              <template #prepend>
                <VAvatar
                  color="info"
                  variant="tonal"
                  rounded
                >
                  <VIcon icon="ri-scales-3-line" />
                </VAvatar>
              </template>
              <VCardTitle>2. Linge</VCardTitle>
              <VCardSubtitle>Pesée, services demandés et nature du linge.</VCardSubtitle>
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
                :hint="weightError ? undefined : needsWeight ? 'Pesez le linge et saisissez le poids avec une virgule, trois décimales au plus.' : 'Le poids n\'est pas nécessaire sans lavage ni séchage.'"
                persistent-hint
                data-testid="order-poids"
              />

              <div
                v-if="tarifs.data.value"
                class="tariff mt-4 pa-3 d-flex flex-wrap gap-x-6 gap-y-1 text-body-2"
              >
                <span><VIcon
                  icon="ri-price-tag-3-line"
                  size="16"
                  class="me-1"
                />Lavage : <strong>{{ tarifLine }}</strong></span>
                <span v-if="dryingAvailable"><VIcon
                  icon="ri-sun-line"
                  size="16"
                  class="me-1"
                />Séchage : <strong>{{ formatMoney(tarifs.data.value.prix_sechage_kg) }} le kilo</strong></span>
                <span><VIcon
                  icon="ri-ruler-line"
                  size="16"
                  class="me-1"
                />Arrondi : <strong>{{ STEP_LABELS[tarifs.data.value.arrondi.pas_grammes] }}</strong> ({{ MODE_LABELS[tarifs.data.value.arrondi.mode].toLowerCase() }})</span>
              </div>

              <div class="d-flex flex-wrap gap-x-8 mt-4">
                <VSwitch
                  v-model="wash"
                  label="Lavage"
                  color="primary"
                  hide-details
                  data-testid="order-lavage"
                />
                <VSwitch
                  v-model="dry"
                  label="Séchage"
                  color="primary"
                  hide-details
                  :disabled="!dryingAvailable"
                  data-testid="order-sechage"
                />
              </div>
              <VAlert
                v-if="!dryingAvailable"
                type="info"
                variant="tonal"
                density="compact"
                class="mt-3"
              >
                Le séchage n'est pas proposé : aucun prix du kilo de séchage n'est défini. La direction peut l'ajouter dans les tarifs.
              </VAlert>

              <div class="text-subtitle-2 mt-5 mb-2">
                Type de linge (facultatif)
              </div>
              <VChipGroup
                v-model="linen"
                multiple
                column
                filter
                selected-class="text-primary"
              >
                <VChip
                  v-for="choice in LINEN_CHOICES"
                  :key="choice"
                  :value="choice"
                  variant="outlined"
                  filter
                  :data-testid="`order-linge-${choice}`"
                >
                  {{ linenLabel(choice) }}
                </VChip>
              </VChipGroup>
            </VCardText>
          </VCard>

          <VCard
            class="mb-6"
            data-tour="order-items"
          >
            <VCardItem>
              <template #prepend>
                <VAvatar
                  color="warning"
                  variant="tonal"
                  rounded
                >
                  <VIcon icon="ri-t-shirt-line" />
                </VAvatar>
              </template>
              <VCardTitle>3. Articles et combinaisons</VCardTitle>
              <VCardSubtitle>Pièces facturées à l'unité et ensembles à prix fixe, avec leur quantité.</VCardSubtitle>
            </VCardItem>
            <VCardText>
              <div class="text-subtitle-2 mb-2">
                Articles à l'unité
              </div>
              <LinesEditor
                v-model="articleLines"
                :items="articleItems"
                label="Article"
                icon="ri-t-shirt-line"
                add-label="Ajouter un article"
                empty-text="Aucun article ajouté."
                id-prefix="order-article"
                required
              />
              <VDivider class="my-5" />
              <div class="text-subtitle-2 mb-2">
                Combinaisons
              </div>
              <LinesEditor
                v-model="comboLines"
                :items="comboItems"
                label="Combinaison"
                icon="ri-stack-line"
                add-label="Ajouter une combinaison"
                empty-text="Aucune combinaison ajoutée."
                id-prefix="order-combo"
                required
              />
            </VCardText>
          </VCard>

          <VCard class="mb-6">
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
              <VCardTitle>4. Remise et instructions</VCardTitle>
              <VCardSubtitle>Facultatif : un geste commercial et les consignes pour l'équipe.</VCardSubtitle>
            </VCardItem>
            <VCardText>
              <VTextField
                v-model="discountText"
                label="Remise (FCFA)"
                prepend-inner-icon="ri-percent-line"
                placeholder="0"
                inputmode="numeric"
                suffix="FCFA"
                :error-messages="discountError"
                data-testid="order-remise"
              />
              <VTextarea
                v-model="instructions"
                label="Instructions"
                prepend-inner-icon="ri-sticky-note-line"
                placeholder="Taches de vin sur la nappe, ne pas sécher la couette…"
                rows="3"
                auto-grow
                class="mt-4"
                counter="500"
                maxlength="500"
                data-testid="order-instructions"
              />
            </VCardText>
          </VCard>

          <VCard
            v-if="!editing"
            class="mb-6"
            data-testid="order-deposit"
          >
            <VCardItem>
              <template #prepend>
                <VAvatar
                  color="success"
                  variant="tonal"
                  rounded
                >
                  <VIcon icon="ri-hand-coin-line" />
                </VAvatar>
              </template>
              <VCardTitle>Acompte reçu (facultatif)</VCardTitle>
              <VCardSubtitle>Encaissé tout de suite après la création, sur la même commande.</VCardSubtitle>
            </VCardItem>
            <VCardText>
              <VRow>
                <VCol
                  cols="12"
                  md="6"
                >
                  <VTextField
                    v-model="depositText"
                    label="Montant de l'acompte"
                    prepend-inner-icon="ri-money-dollar-circle-line"
                    placeholder="0"
                    inputmode="numeric"
                    suffix="FCFA"
                    :error-messages="depositError"
                    data-testid="order-acompte"
                  />
                </VCol>
                <VCol
                  cols="12"
                  md="6"
                >
                  <VSelect
                    v-model="depositMode"
                    :items="MODES_PAIEMENT.map(item => ({ value: item, title: MODE_PAIEMENT_INFO[item].label }))"
                    label="Moyen de paiement"
                    prepend-inner-icon="ri-wallet-3-line"
                    data-testid="order-acompte-mode"
                  />
                </VCol>
              </VRow>
            </VCardText>
          </VCard>
        </VCol>

        <VCol
          cols="12"
          lg="5"
          class="summary-col"
        >
          <VCard
            class="summary"
            data-testid="order-summary"
            data-tour="order-summary"
          >
            <VCardItem class="pb-1">
              <VCardTitle class="d-none d-lg-block">
                5. Récapitulatif
              </VCardTitle>
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
                  @click="showDetails = !showDetails"
                >
                  {{ showDetails ? 'Masquer' : 'Détail' }}
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
                data-testid="order-calc-error"
              >
                {{ calcError }}
              </VAlert>

              <p
                v-if="!result && !calcError && lgAndUp"
                class="text-body-2 text-medium-emphasis mb-3"
              >
                {{ needsWeight ? 'Saisissez le poids du linge pour voir le détail du calcul.' : 'Ajoutez des articles ou des combinaisons pour voir le détail du calcul.' }}
              </p>

              <template v-if="result">
                <div v-show="lgAndUp || showDetails">
                  <div
                    v-if="weightRule"
                    class="text-body-2 font-weight-medium mb-3"
                    data-testid="order-poids-facturable"
                  >
                    {{ weightRule }}
                  </div>

                  <VList
                    density="compact"
                    class="pa-0 mb-3 summary-lines"
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
                        {{ TYPE_LABELS[ligne.type] }} · {{ quantityText(ligne.type, ligne.quantite) }} × <AppMoney :amount="ligne.prix_unitaire" />
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
                    <span><template v-if="result.remise_fcfa > 0">− </template><AppMoney :amount="result.remise_fcfa" /></span>
                  </div>
                </div>

                <div class="d-flex align-baseline justify-space-between gap-3">
                  <span :class="lgAndUp ? 'text-h6' : 'text-subtitle-1'">Total</span>
                  <span
                    class="font-weight-bold text-primary tabular-nums"
                    :class="lgAndUp ? 'text-h4' : 'text-h5'"
                    data-testid="order-total"
                  ><AppMoney :amount="result.total" /></span>
                </div>
              </template>

              <VBtn
                block
                size="large"
                class="mt-4"
                type="submit"
                prepend-icon="ri-save-line"
                :loading="saving.pending.value"
                :disabled="!canSave"
                data-testid="order-save"
              >
                {{ editing ? 'Enregistrer les modifications' : 'Enregistrer la commande' }}
              </VBtn>
              <p
                v-if="!canSave && !saving.pending.value && lgAndUp"
                class="text-caption text-medium-emphasis mt-2 mb-0"
              >
                <template v-if="!stepClient">
                  Il manque le nom du client.
                </template>
                <template v-else-if="!stepLinge">
                  Il manque un poids valide.
                </template>
                <template v-else>
                  Le total doit être calculé avant l'enregistrement.
                </template>
              </p>
            </VCardText>
          </VCard>
        </VCol>
      </VRow>
    </VForm>
  </div>
</template>

<style scoped>
/* Cibles tactiles : au moins 48 px de haut. */
.action-btn {
  min-block-size: 48px;
}

.tariff {
  border-radius: 10px;
  background: rgba(var(--v-theme-on-surface), 0.04);
}

/* Téléphone : le récapitulatif reste collé en bas de l'écran. */
.summary-col {
  display: contents;
}

.summary {
  position: sticky;
  inset-block-end: 0;
  z-index: 5;
  flex: 0 0 calc(100% - 24px);
  margin-inline: 12px;
  margin-block-end: 8px;
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.12);
}

.summary-lines {
  max-block-size: 18rem;
  overflow-y: auto;
}

.summary-lines :deep(.v-list-item-subtitle) {
  -webkit-line-clamp: unset;
  white-space: normal;
}

@media (width >= 1280px) {
  .summary-col {
    display: block;
  }

  .summary {
    position: sticky;
    flex: none;
    margin: 0;
    inset-block: 5rem auto;
    box-shadow: none;
  }

  .summary-lines {
    max-block-size: none;
  }
}
</style>
