<!--
  Détail d'une commande de pressing : état et dates, linge et lignes figées, affectation des
  machines, paiements, historique et actions selon le statut (annuler, livrer, modifier).
-->
<script setup lang="ts">
import { pressingApi } from '../api'
import { ETAPE_LABELS, LIVE_INTERVAL_MS, MODE_PAIEMENT_INFO, NEXT_STEP, STATUT_INFO, formatDateHeure, formatHeure, linenLabel, prochaineAction, quantityText, withoutMachines } from '../commandes'
import CommandeAffectation from '../components/CommandeAffectation.vue'
import CommandeStatusChip from '../components/CommandeStatusChip.vue'
import { useSyncStatus } from '../composables/useSyncStatus'
import PaymentDialog from '../components/PaymentDialog.vue'
import { formatKg, pressingError } from '../labels'
import type { Commande, Machine, Paiement } from '../types'
import { useAsyncData } from '@/composables/useAsyncData'
import { useConfirm } from '@/composables/useConfirm'
import { useLive } from '@/composables/useLive'
import { useSubmit } from '@/composables/useSubmit'
import { formatMoney } from '@/lib/format'
import { useTenantStore } from '@/stores/tenant.store'
import { useToast } from '@/stores/toast.store'

const route = useRoute()
const router = useRouter()
const tenant = useTenantStore()
const toast = useToast()
const confirm = useConfirm()

const id = computed(() => String(route.params.id))
const canWrite = computed(() => tenant.can('front_of_house'))
const isManager = computed(() => tenant.can('management'))

/** Dialogue d'encaissement (ouvert depuis le bandeau « Prochaine action » ou la carte paiements). */
const payOpen = ref(false)

const { lastSync, failed: syncFailed, track: tracked } = useSyncStatus()

const order = useAsyncData(
  signal => tenant.currentId && canWrite.value ? tracked(pressingApi.commande(tenant.currentId, id.value, signal), signal) : Promise.resolve(null as Commande | null),
  { watch: [() => tenant.currentId, id] },
)

const commande = computed(() => order.data.value)

const payments = useAsyncData(
  signal => tenant.currentId && canWrite.value ? pressingApi.paiements(tenant.currentId, id.value, signal) : Promise.resolve([] as Paiement[]),
  { watch: [() => tenant.currentId, id] },
)

/** Parc de machines : même cadence que la commande, car l'état d'une machine change l'action à faire. */
const machines = useAsyncData(
  signal => tenant.currentId && canWrite.value ? pressingApi.machines(tenant.currentId, {}, signal) : Promise.resolve([] as Machine[]),
  { watch: [() => tenant.currentId] },
)

/** Un seul rafraîchissement groupé : commande, paiements et machines ensemble. */
const refreshAll = () => Promise.all([order.refresh(), payments.refresh(), machines.refresh()])

useLive(refreshAll, LIVE_INTERVAL_MS)

const machineList = computed(() => machines.data.value ?? [])

const nextStep = computed(() => commande.value ? prochaineAction(commande.value, machineList.value) : null)

function goNext() {
  const action = nextStep.value

  if (!action)
    return

  if (action.cible === 'paiement') {
    payOpen.value = true

    return
  }

  document.getElementById(action.cible)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const scrollToAffectation = () => document.getElementById('affectation')?.scrollIntoView({ behavior: 'smooth', block: 'start' })

// Arrivée juste après la création : on lance la recommandation, puis on nettoie l'adresse.
const autoSearch = route.query.recommander === '1'

if (autoSearch)
  router.replace({ path: route.path }).catch(() => undefined)

// Arrivée avec recommander=1 : on fait défiler jusqu'à la section Affectation, une fois la commande chargée.
let scrolled = false

watch(commande, value => {
  if (value && autoSearch && !scrolled) {
    scrolled = true
    nextTick(scrollToAffectation)
  }
})

const cancellable = computed(() => commande.value !== null && ['recue', 'en_attente_machine', 'attente_sechage'].includes(commande.value.statut))
const owing = computed(() => commande.value?.reste_a_payer ?? 0)
const paidShare = computed(() => commande.value && commande.value.montant_total > 0 ? Math.min(100, Math.round(commande.value.montant_paye / commande.value.montant_total * 100)) : 0)

// --- Paiement ------------------------------------------------------------------------------------

// --- Marquer prête (articles seuls) --------------------------------------------------------------

const readying = useSubmit(async () => {
  if (!tenant.currentId || !commande.value)
    throw new Error('no order')

  return pressingApi.markReady(tenant.currentId, commande.value.id)
})

async function markReady() {
  if (!commande.value)
    return

  const accepted = await confirm({
    title: `Marquer ${commande.value.numero} prête ?`,
    text: 'La commande ne passe pas par les machines : elle sera prête à être remise au client.',
    confirmLabel: 'Marquer prête',
  })

  if (!accepted)
    return

  if (await readying.submit()) {
    toast.success('La commande est prête.')
    await refreshAll()
  }
  else {
    toast.error(readying.message.value)
  }
}

// --- Livraison -----------------------------------------------------------------------------------

const delivering = useSubmit(async (force: boolean) => {
  if (!tenant.currentId || !commande.value)
    throw new Error('no order')

  return pressingApi.deliver(tenant.currentId, commande.value.id, force)
})

async function deliver(force: boolean) {
  if (!commande.value)
    return

  const forced = {
    title: 'Livrer malgré le reste à payer ?',
    text: `Il reste ${formatMoney(owing.value)} à payer sur ${commande.value.numero}. La livraison forcée est enregistrée dans l'historique d'audit avec ce montant.`,
    confirmLabel: 'Livrer quand même',
    danger: true,
  }

  const normal = {
    title: `Livrer ${commande.value.numero} ?`,
    text: `Le linge est remis à ${commande.value.client_nom}. La commande passe à « livrée » et ne pourra plus être modifiée.`,
    confirmLabel: 'Livrer',
  }

  const accepted = await confirm(force ? forced : normal)

  if (!accepted)
    return

  if (await delivering.submit(force)) {
    toast.success(`La commande ${commande.value.numero} est livrée.`)
    await refreshAll()
  }
  else {
    toast.error(delivering.message.value)
  }
}

// --- Annulation ----------------------------------------------------------------------------------

const cancelOpen = ref(false)
const reason = ref('')

const cancelling = useSubmit(async () => {
  if (!tenant.currentId || !commande.value)
    throw new Error('no order')

  return pressingApi.cancelCommande(tenant.currentId, commande.value.id, reason.value.trim())
})

function openCancel() {
  reason.value = ''
  cancelling.reset()
  cancelOpen.value = true
}

async function cancel() {
  const accepted = await confirm({
    title: 'Annuler définitivement cette commande ?',
    text: 'Les machines réservées sont libérées. Cette action ne peut pas être défaite.',
    confirmLabel: 'Annuler la commande',
    cancelLabel: 'Garder la commande',
    danger: true,
  })

  if (!accepted)
    return

  if (await cancelling.submit()) {
    toast.success(`La commande ${commande.value?.numero ?? ''} est annulée.`)
    cancelOpen.value = false
    await refreshAll()
  }
}

const reasonRules = [(value: string) => value.trim().length >= 3 || 'Indiquez le motif de l\'annulation (3 caractères au moins).']

// --- Historique, d'après les horodatages de la commande ----------------------------------------------

interface HistoryItem {
  at: string
  icon: string
  color: string
  title: string
  text?: string
}

const history = computed<HistoryItem[]>(() => {
  const data = commande.value

  if (!data)
    return []

  const items: HistoryItem[] = [{ at: data.cree_le, icon: 'ri-inbox-archive-line', color: 'info', title: 'Commande reçue', text: `Total de ${formatMoney(data.montant_total)}.` }]

  if (data.pris_en_charge_le)
    items.push({ at: data.pris_en_charge_le, icon: 'ri-hand-heart-line', color: 'info', title: 'Prise en charge' })

  for (const row of data.machines) {
    const step = ETAPE_LABELS[row.etape].toLowerCase()

    if (row.debut_reel)
      items.push({ at: row.debut_reel, icon: 'ri-play-circle-line', color: 'primary', title: `Cycle de ${step} démarré`, text: `${row.machine_nom ?? 'Machine'}${row.programme ? ` · ${row.programme}` : ''}` })
    if (row.fin_reelle)
      items.push({ at: row.fin_reelle, icon: 'ri-check-double-line', color: 'primary', title: `Cycle de ${step} terminé`, text: row.machine_nom ?? undefined })
    if (row.dechargee_le)
      items.push({ at: row.dechargee_le, icon: 'ri-inbox-unarchive-line', color: 'warning', title: 'Machine déchargée', text: row.machine_nom ?? undefined })
  }

  if (data.pret_le)
    items.push({ at: data.pret_le, icon: 'ri-checkbox-circle-line', color: 'success', title: 'Commande prête' })
  if (data.livre_le)
    items.push({ at: data.livre_le, icon: 'ri-truck-line', color: 'success', title: 'Commande livrée' })
  if (data.annule_le)
    items.push({ at: data.annule_le, icon: 'ri-close-circle-line', color: 'error', title: 'Commande annulée', text: data.motif_annulation ?? undefined })

  return items.sort((a, b) => a.at.localeCompare(b.at))
})

const services = computed(() => {
  const data = commande.value

  if (!data)
    return []

  return [data.lavage ? 'Lavage' : null, data.sechage ? 'Séchage' : null].filter((value): value is string => value !== null)
})

const keyDates = computed(() => {
  const data = commande.value

  if (!data)
    return []

  return [
    { label: 'Reçue', value: data.cree_le },
    { label: 'Prise en charge', value: data.pris_en_charge_le },
    { label: 'Prête', value: data.pret_le },
    { label: 'Livrée', value: data.livre_le },
  ]
})
</script>

<template>
  <div>
    <VCard v-if="!canWrite">
      <AppEmptyState
        icon="ri-lock-line"
        title="Cette commande n'est pas disponible pour votre rôle"
        text="Demandez au responsable du pressing de vous donner accès à la salle."
      />
    </VCard>

    <AppErrorState
      v-else-if="order.error.value && !commande"
      :error="order.error.value"
      @retry="refreshAll"
    />

    <div v-else-if="!commande">
      <VSkeletonLoader type="heading, article, article" />
    </div>

    <template v-else>
      <AppPageHeader
        :title="commande.numero"
        :subtitle="`${commande.client_nom}${commande.client_telephone ? ` · ${commande.client_telephone}` : ''}`"
      >
        <template #actions>
          <VBtn
            variant="outlined"
            color="secondary"
            prepend-icon="ri-arrow-left-line"
            to="/pressing/commandes"
          >
            Les commandes
          </VBtn>
          <VBtn
            v-if="commande.statut === 'recue'"
            variant="outlined"
            prepend-icon="ri-edit-line"
            :to="`/pressing/commandes/${commande.id}/modifier`"
            data-testid="order-edit"
          >
            Modifier
          </VBtn>
          <VBtn
            v-if="cancellable && isManager"
            variant="outlined"
            color="error"
            prepend-icon="ri-close-circle-line"
            data-testid="order-cancel"
            @click="openCancel"
          >
            Annuler la commande
          </VBtn>
        </template>
      </AppPageHeader>

      <VAlert
        v-if="syncFailed"
        type="warning"
        variant="tonal"
        icon="ri-wifi-off-line"
        class="mb-4"
        data-testid="order-sync-failed"
      >
        Impossible de mettre la commande à jour. Les informations affichées datent de {{ lastSync ? formatHeure(lastSync) : "l'ouverture de la page" }}.
      </VAlert>

      <VCard
        v-if="nextStep"
        class="mb-4 next-step"
        data-testid="order-next-action"
      >
        <VCardText class="d-flex flex-wrap align-center gap-3">
          <VAvatar
            color="primary"
            variant="tonal"
            rounded
          >
            <VIcon :icon="nextStep.icone" />
          </VAvatar>
          <div class="flex-grow-1 min-w-0">
            <div class="text-caption text-medium-emphasis">
              Prochaine action
            </div>
            <div class="text-subtitle-1 font-weight-semibold">
              {{ nextStep.texte }}
            </div>
          </div>
          <VBtn
            size="large"
            class="action-btn"
            color="primary"
            :prepend-icon="nextStep.cible === 'paiement' ? 'ri-hand-coin-line' : 'ri-arrow-down-line'"
            data-testid="order-next-go"
            @click="goNext"
          >
            {{ nextStep.cible === 'paiement' ? 'Encaisser' : 'Y aller' }}
          </VBtn>
        </VCardText>
      </VCard>

      <!-- État -->
      <VCard class="mb-6">
        <VCardText class="d-flex flex-wrap align-center gap-x-6 gap-y-4">
          <div class="d-flex align-center gap-3">
            <VAvatar
              :color="STATUT_INFO[commande.statut].tone === 'neutral' ? 'secondary' : STATUT_INFO[commande.statut].tone"
              variant="tonal"
              rounded
              size="48"
            >
              <VIcon
                :icon="STATUT_INFO[commande.statut].icon"
                size="26"
              />
            </VAvatar>
            <div>
              <div class="d-flex flex-wrap align-center gap-2">
                <CommandeStatusChip :statut="commande.statut" />
                <VChip
                  v-if="commande.etape"
                  size="small"
                  label
                  variant="outlined"
                  prepend-icon="ri-flow-chart"
                >
                  Étape : {{ ETAPE_LABELS[commande.etape] }}
                </VChip>
              </div>
              <div
                class="text-body-2 text-medium-emphasis mt-1"
                data-testid="order-next"
              >
                {{ NEXT_STEP[commande.statut] }}
              </div>
            </div>
          </div>
        </VCardText>
        <VDivider />
        <VCardText>
          <dl class="dates">
            <div
              v-for="item in keyDates"
              :key="item.label"
            >
              <dt>{{ item.label }}</dt>
              <dd>{{ item.value ? formatDateHeure(item.value) : '—' }}</dd>
            </div>
          </dl>
        </VCardText>
        <VAlert
          v-if="commande.statut === 'annulee'"
          type="error"
          variant="tonal"
          class="mx-4 mb-4"
        >
          Commande annulée<template v-if="commande.annule_le">
            le {{ formatDateHeure(commande.annule_le) }}
          </template>.
          <template v-if="commande.motif_annulation">
            Motif : {{ commande.motif_annulation }}
          </template>
        </VAlert>
      </VCard>

      <VRow>
        <VCol
          cols="12"
          lg="8"
        >
          <!-- Linge -->
          <VCard class="mb-6">
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
              <VCardTitle>Linge</VCardTitle>
              <VCardSubtitle>Ce que le client a déposé, au prix figé à la commande.</VCardSubtitle>
            </VCardItem>
            <VCardText>
              <dl class="facts">
                <div>
                  <dt>Poids pesé</dt>
                  <dd>{{ commande.poids_grams ? formatKg(commande.poids_grams) : '—' }}</dd>
                </div>
                <div>
                  <dt>Poids facturable</dt>
                  <dd>{{ commande.poids_facturable_grams ? formatKg(commande.poids_facturable_grams) : '—' }}</dd>
                </div>
                <div>
                  <dt>Services</dt>
                  <dd>{{ services.length ? services.join(' et ') : 'Aucun (articles seuls)' }}</dd>
                </div>
              </dl>

              <div
                v-if="commande.types_linge.length"
                class="d-flex flex-wrap gap-2 mt-4"
              >
                <VChip
                  v-for="type in commande.types_linge"
                  :key="type"
                  size="small"
                  variant="tonal"
                  label
                >
                  {{ linenLabel(type) }}
                </VChip>
              </div>

              <VAlert
                v-if="commande.instructions"
                type="info"
                variant="tonal"
                icon="ri-sticky-note-line"
                density="compact"
                class="mt-4"
              >
                {{ commande.instructions }}
              </VAlert>

              <VTable class="mt-4 lines-table">
                <thead>
                  <tr>
                    <th>Ligne</th>
                    <th class="text-end">
                      Quantité
                    </th>
                    <th class="text-end d-none d-sm-table-cell">
                      Prix unitaire
                    </th>
                    <th class="text-end">
                      Montant
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(ligne, index) in commande.lignes"
                    :key="index"
                  >
                    <td class="text-wrap">
                      {{ ligne.libelle }}
                    </td>
                    <td class="text-end text-no-wrap tabular-nums">
                      {{ quantityText(ligne.type, ligne.quantite) }}
                    </td>
                    <td class="text-end d-none d-sm-table-cell">
                      <AppMoney :amount="ligne.prix_unitaire" />
                    </td>
                    <td class="text-end">
                      <AppMoney :amount="ligne.montant" />
                    </td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr>
                    <td
                      colspan="3"
                      class="text-end"
                    >
                      Sous-total
                    </td>
                    <td class="text-end">
                      <AppMoney :amount="commande.sous_total" />
                    </td>
                  </tr>
                  <tr v-if="commande.remise_fcfa > 0">
                    <td
                      colspan="3"
                      class="text-end"
                    >
                      Remise
                    </td>
                    <td class="text-end">
                      − <AppMoney :amount="commande.remise_fcfa" />
                    </td>
                  </tr>
                  <tr>
                    <td
                      colspan="3"
                      class="text-end font-weight-bold"
                    >
                      Total
                    </td>
                    <td class="text-end text-primary font-weight-bold">
                      <AppMoney :amount="commande.montant_total" />
                    </td>
                  </tr>
                </tfoot>
              </VTable>
            </VCardText>
          </VCard>

          <!-- Affectation -->
          <VCard
            id="affectation"
            class="mb-6"
            data-tour="order-assign"
          >
            <VCardItem>
              <template #prepend>
                <VAvatar
                  color="primary"
                  variant="tonal"
                  rounded
                >
                  <VIcon icon="ri-t-shirt-air-line" />
                </VAvatar>
              </template>
              <VCardTitle>Affectation des machines</VCardTitle>
              <VCardSubtitle>Réservation et conduite des cycles de lavage et de séchage.</VCardSubtitle>
            </VCardItem>
            <VCardText>
              <div
                v-if="withoutMachines(commande) && commande.statut === 'recue'"
                class="text-center pa-4"
              >
                <p class="text-body-2 text-medium-emphasis">
                  Cette commande ne contient que des articles : elle ne passe pas par les machines.
                </p>
                <VBtn
                  size="large"
                  class="action-btn"
                  prepend-icon="ri-checkbox-circle-line"
                  :loading="readying.pending.value"
                  @click="markReady"
                >
                  Marquer prête
                </VBtn>
              </div>
              <CommandeAffectation
                v-else
                :commande="commande"
                :machines="machineList"
                :auto-search="autoSearch"
                @changed="refreshAll"
              />
            </VCardText>
          </VCard>
        </VCol>

        <VCol
          cols="12"
          lg="4"
        >
          <!-- Paiements -->
          <VCard
            class="mb-6"
            data-tour="order-payments"
          >
            <VCardItem>
              <template #prepend>
                <VAvatar
                  color="success"
                  variant="tonal"
                  rounded
                >
                  <VIcon icon="ri-wallet-3-line" />
                </VAvatar>
              </template>
              <VCardTitle>Paiements</VCardTitle>
            </VCardItem>
            <VCardText>
              <div class="d-flex justify-space-between align-baseline">
                <span class="text-medium-emphasis">Payé</span>
                <strong><AppMoney :amount="commande.montant_paye" /></strong>
              </div>
              <VProgressLinear
                :model-value="paidShare"
                color="success"
                height="8"
                rounded
                bg-opacity="0.16"
                class="my-2"
                aria-label="Part payée de la commande"
              />
              <div class="d-flex justify-space-between align-baseline">
                <span class="text-medium-emphasis">Reste à payer</span>
                <strong
                  :class="owing > 0 && commande.statut !== 'annulee' ? 'text-warning' : 'text-success'"
                  data-testid="order-reste"
                ><AppMoney :amount="commande.statut === 'annulee' ? 0 : owing" /></strong>
              </div>

              <VBtn
                v-if="owing > 0 && commande.statut !== 'annulee'"
                block
                size="large"
                class="mt-4 action-btn"
                prepend-icon="ri-hand-coin-line"
                data-testid="order-pay"
                @click="payOpen = true"
              >
                Encaisser
              </VBtn>

              <VDivider class="my-4" />

              <VSkeletonLoader
                v-if="payments.data.value === null"
                type="list-item-two-line"
              />
              <p
                v-else-if="!payments.data.value.length"
                class="text-body-2 text-medium-emphasis mb-0"
              >
                Aucun paiement enregistré pour cette commande.
              </p>
              <div
                v-else
                class="d-flex flex-column gap-3"
                data-testid="order-payments-list"
              >
                <div
                  v-for="payment in payments.data.value"
                  :key="payment.id"
                  class="d-flex align-center gap-3"
                >
                  <VAvatar
                    :color="MODE_PAIEMENT_INFO[payment.mode].color"
                    variant="tonal"
                    rounded
                    size="36"
                  >
                    <VIcon
                      :icon="MODE_PAIEMENT_INFO[payment.mode].icon"
                      size="20"
                    />
                  </VAvatar>
                  <div class="min-w-0 flex-grow-1">
                    <div class="text-body-1 font-weight-medium">
                      {{ MODE_PAIEMENT_INFO[payment.mode].label }}
                    </div>
                    <div class="text-body-2 text-medium-emphasis text-truncate">
                      {{ formatDateHeure(payment.cree_le) }}<template v-if="payment.reference">
                        · {{ payment.reference }}
                      </template>
                    </div>
                  </div>
                  <strong><AppMoney :amount="payment.montant" /></strong>
                </div>
              </div>
            </VCardText>
          </VCard>

          <!-- Livraison -->
          <VCard
            v-if="commande.statut === 'pret'"
            id="livraison"
            class="mb-6"
            data-tour="order-deliver"
          >
            <VCardItem>
              <template #prepend>
                <VAvatar
                  color="success"
                  variant="tonal"
                  rounded
                >
                  <VIcon icon="ri-truck-line" />
                </VAvatar>
              </template>
              <VCardTitle>Remise du linge</VCardTitle>
            </VCardItem>
            <VCardText>
              <VAlert
                v-if="owing > 0"
                type="warning"
                variant="tonal"
                density="compact"
                class="mb-3"
              >
                Il reste {{ formatMoney(owing) }} à payer : la livraison est bloquée tant que la commande n'est pas soldée.
              </VAlert>
              <VBtn
                block
                size="large"
                class="action-btn"
                prepend-icon="ri-truck-line"
                :disabled="owing > 0"
                :loading="delivering.pending.value"
                data-testid="order-deliver"
                @click="deliver(false)"
              >
                Livrer la commande
              </VBtn>
              <VBtn
                v-if="owing > 0 && isManager"
                block
                class="mt-3"
                color="error"
                variant="outlined"
                prepend-icon="ri-error-warning-line"
                data-testid="order-deliver-force"
                @click="deliver(true)"
              >
                Livrer malgré le reste à payer
              </VBtn>
            </VCardText>
          </VCard>

          <!-- Historique -->
          <VCard data-tour="order-history">
            <VCardItem>
              <template #prepend>
                <VAvatar
                  color="secondary"
                  variant="tonal"
                  rounded
                >
                  <VIcon icon="ri-history-line" />
                </VAvatar>
              </template>
              <VCardTitle>Historique</VCardTitle>
            </VCardItem>
            <VCardText>
              <VTimeline
                density="compact"
                side="end"
                align="start"
                line-thickness="2"
                truncate-line="both"
              >
                <VTimelineItem
                  v-for="(item, index) in history"
                  :key="index"
                  :dot-color="item.color"
                  size="x-small"
                >
                  <div class="text-body-1 font-weight-medium">
                    {{ item.title }}
                  </div>
                  <div
                    v-if="item.text"
                    class="text-body-2 text-medium-emphasis"
                  >
                    {{ item.text }}
                  </div>
                  <div class="text-caption text-medium-emphasis">
                    {{ formatDateHeure(item.at) }}
                  </div>
                </VTimelineItem>
              </VTimeline>
            </VCardText>
          </VCard>
        </VCol>
      </VRow>

      <PaymentDialog
        v-model="payOpen"
        :commande="commande"
        @paid="refreshAll"
      />

      <AppFormDialog
        v-model="cancelOpen"
        title="Annuler la commande"
        :subtitle="`${commande.numero} · ${commande.client_nom}`"
        icon="ri-close-circle-line"
        danger
        submit-label="Annuler la commande"
        :loading="cancelling.pending.value"
        :error="cancelling.error.value ? pressingError(cancelling.error.value) : ''"
        :confirm="false"
        @submit="cancel"
      >
        <VTextarea
          v-model="reason"
          label="Motif de l'annulation"
          prepend-inner-icon="ri-chat-1-line"
          placeholder="Le client a repris son linge, erreur de saisie…"
          rows="3"
          auto-grow
          :rules="reasonRules"
          data-testid="order-cancel-motif"
        />
        <p
          v-if="commande.montant_paye > 0"
          class="text-body-2 text-warning mt-2 mb-0"
        >
          Un montant de {{ formatMoney(commande.montant_paye) }} a déjà été encaissé sur cette commande.
        </p>
      </AppFormDialog>
    </template>
  </div>
</template>

<style scoped>
.dates {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(9.5rem, 1fr));
  gap: 12px 20px;
  margin: 0;
}

.dates dt,
.facts dt {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.75rem;
}

.dates dd,
.facts dd {
  margin: 0;
  font-weight: 500;
}

.dates dd {
  font-size: 0.875rem;
}

.facts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
  gap: 12px 20px;
  margin: 0;
}

.facts dd {
  font-size: 1.0625rem;
}

.action-btn {
  min-block-size: 48px;
}

.lines-table :deep(tfoot td) {
  border-block-start: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
</style>
