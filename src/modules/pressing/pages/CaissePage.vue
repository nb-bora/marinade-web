<!--
  Caisse du pressing : ce qui a été encaissé un jour donné (aujourd'hui, hier ou un jour passé),
  moyen par moyen, la liste des paiements, la clôture de fin de journée (management), l'impression
  du journal sur une page A4 et son export CSV. Le serveur compte les jours dans le fuseau du
  pressing ; les heures affichées sont celles de l'appareil. Un montant négatif est l'annulation
  d'un paiement (contre-passation) : il s'affiche en rouge, précédé du signe moins.
-->
<script setup lang="ts">
import { pressingApi } from '../api'
import { MODES_PAIEMENT, MODE_PAIEMENT_INFO, dayKey, downloadText, shiftDay, toCsv } from '../commandes'
import { ANNULATION_LABEL, JOUR_OPTIONS, capitalize, ecartInfo, formatDayLong, formatDayMedium, formatDayNumeric, formatSignedMoney, isDayKey, plural, pressingError, toInt } from '../labels'
import type { JourChoix } from '../labels'
import type { JournalPaiementVue } from '../types'
import { useAsyncData } from '@/composables/useAsyncData'
import { useClientPagination } from '@/composables/useClientPagination'
import { useConfirm } from '@/composables/useConfirm'
import { useLive } from '@/composables/useLive'
import { useSubmit } from '@/composables/useSubmit'
import { formatDateTime, formatMoney, formatTime } from '@/lib/format'
import { isApiError } from '@/lib/http/errors'
import { useTenantStore } from '@/stores/tenant.store'
import { useToast } from '@/stores/toast.store'

const tenant = useTenantStore()
const toast = useToast()
const confirm = useConfirm()

const canRead = computed(() => tenant.can('front_of_house'))
const canClose = computed(() => tenant.can('management'))

// --- Jour affiché ------------------------------------------------------------------------------

const today = ref(dayKey())

// Une page laissée ouverte passe minuit : « aujourd'hui » suit l'horloge.
useIntervalFn(() => {
  today.value = dayKey()
}, 60_000)

const choice = ref<JourChoix>('aujourdhui')
const otherDay = ref(shiftDay(today.value, -2))

const dateError = computed(() => {
  if (choice.value !== 'autre')
    return ''

  if (!isDayKey(otherDay.value))
    return 'Choisissez un jour.'

  return otherDay.value > today.value ? 'Ce jour n\'est pas encore arrivé : choisissez aujourd\'hui ou un jour passé.' : ''
})

const day = computed<string | null>(() => {
  if (choice.value === 'aujourdhui')
    return today.value

  if (choice.value === 'hier')
    return shiftDay(today.value, -1)

  return dateError.value ? null : otherDay.value
})

const isToday = computed(() => day.value === today.value)

// --- Journal -----------------------------------------------------------------------------------

const journal = useAsyncData(
  signal => tenant.currentId && canRead.value && day.value ? pressingApi.journalDuJour(tenant.currentId, day.value, signal) : Promise.resolve(null),
  { watch: [day, () => tenant.currentId] },
)

// Seul le journal d'aujourd'hui bouge encore : on ne rafraîchit que lui.
useLive(() => {
  if (isToday.value)
    journal.refresh()
})

// Pendant le changement de jour, l'ancien journal n'est jamais montré sous la nouvelle date.
const data = computed(() => journal.data.value && journal.data.value.date === day.value ? journal.data.value : null)
const loaded = computed(() => data.value !== null)

const payments = computed<JournalPaiementVue[]>(() => data.value?.paiements ?? [])
const received = computed(() => payments.value.filter(payment => payment.montant >= 0))
const cancellations = computed(() => payments.value.filter(payment => payment.montant < 0))

/** Motif d'annulation de chaque paiement annulé de la journée (porté par le paiement d'origine). */
const motifs = computed(() => new Map(payments.value
  .filter(payment => payment.motif_annulation)
  .map(payment => [payment.id, payment.motif_annulation as string])))

/** Paiement d'origine annulé ensuite (son montant compte toujours, l'annulation est une autre ligne). */
const isCancelled = (payment: JournalPaiementVue) => payment.montant >= 0 && !!payment.annule_le

function lineType(payment: JournalPaiementVue): string {
  if (payment.montant < 0)
    return ANNULATION_LABEL

  return isCancelled(payment) ? 'Paiement annulé ensuite' : 'Paiement'
}

/** Motif à afficher : celui du paiement annulé, ou celui de l'original pour une annulation. */
function motifOf(payment: JournalPaiementVue): string | null {
  if (payment.montant < 0)
    return payment.annule_paiement_id ? motifs.value.get(payment.annule_paiement_id) ?? null : null

  return payment.motif_annulation ?? null
}

const { page, pageSize, total, pages, rows, hasNext } = useClientPagination(payments, 10)

const modeTiles = computed(() => MODES_PAIEMENT.map(mode => {
  const amount = data.value?.par_mode[mode] ?? 0
  const totalEncaisse = data.value?.total_encaisse ?? 0

  return {
    mode,
    ...MODE_PAIEMENT_INFO[mode],
    amount,
    count: received.value.filter(payment => payment.mode === mode).length,
    share: totalEncaisse > 0 && amount > 0 ? Math.min(100, Math.round(amount / totalEncaisse * 100)) : 0,
  }
}))

const dayTitle = computed(() => (day.value ? capitalize(formatDayLong(day.value)) : ''))

const emptyText = computed(() => isToday.value
  ? 'Les paiements enregistrés sur les commandes apparaissent ici au fil de la journée.'
  : 'Aucun paiement n\'a été enregistré ce jour-là.')

// --- Clôture -----------------------------------------------------------------------------------

const cloture = computed(() => data.value?.cloture ?? null)
const expectedCash = computed(() => data.value?.par_mode.especes ?? 0)

/** Net des paiements reçus après la clôture (champ du serveur ; absent : rien à signaler). */
const afterClose = computed(() => {
  const value = data.value?.encaisse_apres_cloture

  return typeof value === 'number' ? value : 0
})

const afterCloseText = computed(() => afterClose.value > 0
  ? `${formatMoney(afterClose.value)} encaissés après la clôture : ces paiements figurent dans le journal mais pas dans ce récapitulatif.`
  : `Des annulations enregistrées après la clôture ont retiré ${formatMoney(-afterClose.value)} : elles figurent dans le journal mais pas dans ce récapitulatif.`)

const closedEcart = computed(() => (cloture.value ? ecartInfo(cloture.value.ecart) : null))

const countedText = ref('')
const counted = computed(() => toInt(countedText.value.replace(/\s/g, '')))
const liveEcart = computed(() => (counted.value === null ? null : ecartInfo(counted.value - expectedCash.value)))

const countedRules = [
  (value: string) => toInt(value.replace(/\s/g, '')) !== null || 'Saisissez le montant compté en FCFA, sans décimales (0 si le tiroir est vide).',
]

const form = ref()

const submission = useSubmit(async (date: string, amount: number) => {
  if (!tenant.currentId)
    throw new Error('no restaurant')

  return pressingApi.closeCash(tenant.currentId, date, amount)
})

watch(day, () => {
  countedText.value = ''
  submission.reset()
  form.value?.resetValidation()
})

async function closeCash() {
  const date = day.value
  const amount = counted.value

  if (!date || !canClose.value || submission.pending.value || !(await form.value?.validate())?.valid || amount === null)
    return

  const ecart = ecartInfo(amount - expectedCash.value)

  const accepted = await confirm({
    title: `Clôturer la caisse du ${formatDayMedium(date)} ?`,
    text: `Espèces attendues : ${formatMoney(expectedCash.value)}. Espèces comptées : ${formatMoney(amount)}. ${ecart.text} La clôture est définitive : une seule par jour, sans modification possible.`,
    confirmLabel: 'Clôturer la caisse',
  })

  if (!accepted)
    return

  const done = await submission.submit(date, amount)

  if (done) {
    toast.success(`Caisse du ${formatDayLong(date)} clôturée.`)
    countedText.value = ''
    form.value?.resetValidation()

    // La clôture renvoyée s'affiche tout de suite : une relecture immédiate du journal peut
    // précéder l'enregistrement définitif côté serveur. On relit ensuite pour le reste.
    if (journal.data.value?.date === date)
      journal.data.value = { ...journal.data.value, cloture: done, encaisse_apres_cloture: 0 }
    setTimeout(() => journal.refresh(), 1500)
  }
  else if (isApiError(submission.error.value) && submission.error.value.kind === 'conflict') {
    // Clôturée entre-temps depuis un autre poste : on montre le récapitulatif.
    await journal.refresh()
  }
}

// --- Impression A4 et export CSV --------------------------------------------------------------

const printedAt = ref('')

/** `window.print` n'imprime que la feuille du journal : une classe sur le body masque l'application. */
async function print() {
  if (!data.value)
    return

  printedAt.value = formatDateTime(new Date())
  await nextTick()

  const clear = () => {
    document.body.classList.remove('pressing-journal-printing')
    window.removeEventListener('afterprint', clear)
  }

  document.body.classList.add('pressing-journal-printing')
  window.addEventListener('afterprint', clear)
  window.print()
}

const secondsTime = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

function exportCsv() {
  const journalDuJour = data.value

  if (!journalDuJour)
    return

  const rowsCsv: Array<Array<string | number>> = [
    ['Journal de caisse', tenant.current?.name ?? ''],
    ['Jour', formatDayNumeric(journalDuJour.date)],
    [],
    ['Date', 'Heure', 'Commande', 'Client', 'Moyen de paiement', 'Type', 'Référence', 'Motif d\'annulation', 'Montant (FCFA)'],
    ...journalDuJour.paiements.map(payment => [
      formatDayNumeric(journalDuJour.date),
      secondsTime.format(new Date(payment.cree_le)),
      payment.commande_numero,
      payment.client_nom,
      MODE_PAIEMENT_INFO[payment.mode].label,
      lineType(payment),
      payment.reference ?? '',
      motifOf(payment) ?? '',
      payment.montant,
    ]),
    [],
    ['Moyen de paiement', 'Montant (FCFA)'],
    ...MODES_PAIEMENT.map(mode => [MODE_PAIEMENT_INFO[mode].label, journalDuJour.par_mode[mode]]),
    ['Total encaissé', journalDuJour.total_encaisse],
  ]

  if (journalDuJour.cloture) {
    rowsCsv.push(
      [],
      ['Clôture', formatDateTime(journalDuJour.cloture.cree_le)],
      ['Espèces attendues (FCFA)', journalDuJour.cloture.especes_attendues],
      ['Espèces comptées (FCFA)', journalDuJour.cloture.montant_compte],
      ['Écart (FCFA)', journalDuJour.cloture.ecart],
    )
    if (afterClose.value !== 0)
      rowsCsv.push(['Net encaissé après la clôture (FCFA)', afterClose.value])
  }

  downloadText(`journal-caisse-${journalDuJour.date}.csv`, toCsv(rowsCsv))
  toast.success('Le journal du jour a été exporté.')
}
</script>

<template>
  <div>
    <AppPageHeader
      title="Caisse"
      subtitle="Ce qui a été encaissé, moyen par moyen, et la clôture de fin de journée."
    >
      <template
        v-if="canRead"
        #actions
      >
        <VBtn
          variant="outlined"
          color="secondary"
          prepend-icon="ri-file-download-line"
          :disabled="!loaded"
          data-tour="caisse-export"
          data-testid="caisse-export"
          @click="exportCsv"
        >
          Exporter en CSV
        </VBtn>
        <VBtn
          prepend-icon="ri-printer-line"
          :disabled="!loaded"
          data-tour="caisse-print"
          data-testid="caisse-print"
          @click="print"
        >
          Imprimer le journal
        </VBtn>
      </template>
    </AppPageHeader>

    <VCard v-if="!canRead">
      <AppEmptyState
        icon="ri-lock-line"
        title="La caisse n'est pas disponible pour votre rôle"
        text="Demandez au responsable du pressing de vous donner accès à la salle."
      />
    </VCard>

    <template v-else>
      <!-- Choix du jour -->
      <VCard
        class="mb-6"
        data-tour="caisse-day"
      >
        <VCardText class="d-flex flex-wrap align-center gap-4">
          <div class="segmented-scroll">
            <AppSegmented
              v-model="choice"
              :options="JOUR_OPTIONS"
              label="Jour du journal de caisse"
            />
          </div>
          <VTextField
            v-if="choice === 'autre'"
            v-model="otherDay"
            type="date"
            label="Jour"
            prepend-inner-icon="ri-calendar-line"
            :max="today"
            :error-messages="dateError"
            hide-details="auto"
            class="day-field"
            data-testid="caisse-date"
          />
          <VSpacer class="d-none d-sm-block" />
          <div
            v-if="day"
            class="day-label"
          >
            <div class="text-subtitle-1 font-weight-semibold text-high-emphasis">
              {{ dayTitle }}
            </div>
            <div class="d-flex flex-wrap align-center gap-2 mt-1">
              <VSkeletonLoader
                v-if="!loaded"
                type="chip"
                class="bg-transparent"
              />
              <AppStatusChip
                v-else-if="cloture"
                :label="`Clôturée à ${formatTime(cloture.cree_le)}`"
                tone="success"
                icon="ri-lock-line"
              />
              <AppStatusChip
                v-else
                :label="isToday ? 'Caisse ouverte' : 'Non clôturée'"
                :tone="isToday ? 'info' : 'warning'"
                :icon="isToday ? 'ri-lock-unlock-line' : 'ri-error-warning-line'"
              />
            </div>
          </div>
        </VCardText>
      </VCard>

      <VCard v-if="!day">
        <AppEmptyState
          icon="ri-calendar-line"
          title="Choisissez un jour passé"
          text="Le journal de caisse existe pour aujourd'hui et pour chacun des jours précédents."
        />
      </VCard>

      <AppErrorState
        v-else-if="journal.error.value && !loaded"
        :error="journal.error.value"
        @retry="journal.reload"
      />

      <template v-else>
        <VRow>
          <!-- Encaissements par moyen -->
          <VCol
            cols="12"
            lg="8"
          >
            <VCard
              class="h-100"
              data-tour="caisse-modes"
            >
              <VCardItem>
                <template #prepend>
                  <VAvatar
                    color="primary"
                    variant="tonal"
                    rounded
                  >
                    <VIcon icon="ri-hand-coin-line" />
                  </VAvatar>
                </template>
                <VCardTitle>Encaissements</VCardTitle>
                <VCardSubtitle class="text-wrap">
                  Les paiements reçus sur les commandes, par moyen de paiement.
                </VCardSubtitle>
              </VCardItem>

              <VCardText>
                <VSkeletonLoader
                  v-if="!loaded"
                  type="heading, paragraph"
                />

                <template v-else-if="data">
                  <div
                    class="total pa-5"
                    data-testid="caisse-total"
                  >
                    <div>
                      <div class="text-body-1 text-medium-emphasis">
                        Total encaissé
                      </div>
                      <div class="total__amount">
                        <AppMoney :amount="data.total_encaisse" />
                      </div>
                    </div>
                    <div class="total__meta text-body-2 text-medium-emphasis">
                      <div>{{ plural(received.length, 'paiement') }}</div>
                      <div
                        v-if="cancellations.length"
                        class="text-error"
                      >
                        et {{ plural(cancellations.length, 'annulation') }}
                      </div>
                    </div>
                  </div>

                  <div class="modes mt-4">
                    <div
                      v-for="tile in modeTiles"
                      :key="tile.mode"
                      class="mode-tile pa-4"
                      :data-testid="`caisse-mode-${tile.mode}`"
                    >
                      <div class="d-flex align-center gap-3">
                        <VAvatar
                          :color="tile.color"
                          variant="tonal"
                          rounded
                          size="40"
                        >
                          <VIcon
                            :icon="tile.icon"
                            size="22"
                          />
                        </VAvatar>
                        <div class="min-w-0">
                          <div class="text-body-2 text-medium-emphasis text-truncate">
                            {{ tile.label }}
                          </div>
                          <div
                            class="text-h6 font-weight-semibold"
                            :class="tile.amount < 0 ? 'text-error' : 'text-high-emphasis'"
                          >
                            {{ formatSignedMoney(tile.amount) }}
                          </div>
                        </div>
                      </div>
                      <VProgressLinear
                        :model-value="tile.share"
                        :color="tile.color"
                        height="6"
                        rounded
                        bg-opacity="0.14"
                        class="mt-3"
                        :aria-label="`${tile.label} : ${tile.share} % du total`"
                      />
                      <div class="d-flex justify-space-between text-caption text-medium-emphasis mt-1">
                        <span>{{ plural(tile.count, 'paiement') }}</span>
                        <span class="tabular-nums">{{ tile.share }} %</span>
                      </div>
                    </div>
                  </div>
                </template>
              </VCardText>
            </VCard>
          </VCol>

          <!-- Clôture -->
          <VCol
            cols="12"
            lg="4"
          >
            <VCard
              class="h-100"
              data-tour="caisse-cloture"
              data-testid="caisse-cloture"
            >
              <VCardItem>
                <template #prepend>
                  <VAvatar
                    :color="cloture ? 'success' : 'primary'"
                    variant="tonal"
                    rounded
                  >
                    <VIcon :icon="cloture ? 'ri-lock-line' : 'ri-safe-2-line'" />
                  </VAvatar>
                </template>
                <VCardTitle>Clôture de caisse</VCardTitle>
                <VCardSubtitle class="text-wrap">
                  {{ cloture ? `Clôturée à ${formatTime(cloture.cree_le)}` : 'Les espèces du tiroir, comptées en fin de journée.' }}
                </VCardSubtitle>
              </VCardItem>

              <VCardText>
                <VSkeletonLoader
                  v-if="!loaded"
                  type="list-item-two-line, list-item-two-line, button"
                />

                <!-- Déjà clôturée : récapitulatif -->
                <template v-else-if="cloture && closedEcart">
                  <dl class="recap">
                    <div class="recap__row">
                      <dt>Clôturée le</dt>
                      <dd>{{ formatDateTime(cloture.cree_le) }}</dd>
                    </div>
                    <div class="recap__row">
                      <dt>Espèces attendues</dt>
                      <dd><AppMoney :amount="cloture.especes_attendues" /></dd>
                    </div>
                    <div class="recap__row">
                      <dt>Espèces comptées</dt>
                      <dd><AppMoney :amount="cloture.montant_compte" /></dd>
                    </div>
                    <div class="recap__row">
                      <dt>Total encaissé à la clôture</dt>
                      <dd><AppMoney :amount="cloture.total_encaisse" /></dd>
                    </div>
                  </dl>

                  <div
                    class="ecart mt-4 pa-4"
                    :class="`ecart--${closedEcart.color}`"
                    data-testid="caisse-ecart"
                  >
                    <VIcon
                      :icon="closedEcart.icon"
                      size="22"
                    />
                    <div>
                      <div class="font-weight-semibold">
                        Écart : {{ cloture.ecart > 0 ? '+ ' : '' }}{{ formatSignedMoney(cloture.ecart) }}
                      </div>
                      <div class="text-body-2">
                        {{ closedEcart.text }}
                      </div>
                    </div>
                  </div>

                  <VAlert
                    v-if="afterClose !== 0"
                    :type="afterClose > 0 ? 'info' : 'warning'"
                    variant="tonal"
                    icon="ri-time-line"
                    class="mt-4"
                    data-testid="caisse-after-close"
                  >
                    {{ afterCloseText }}
                  </VAlert>
                </template>

                <!-- À clôturer (management) -->
                <VForm
                  v-else-if="canClose"
                  ref="form"
                  validate-on="submit"
                  @submit.prevent="closeCash"
                >
                  <div class="expected pa-4">
                    <div class="text-body-2 text-medium-emphasis">
                      Espèces attendues dans le tiroir
                    </div>
                    <div class="text-h5 font-weight-semibold tabular-nums">
                      <AppMoney :amount="expectedCash" />
                    </div>
                    <div class="text-caption text-medium-emphasis">
                      Somme des paiements en espèces de la journée{{ cancellations.some(payment => payment.mode === 'especes') ? ', annulations déduites' : '' }}.
                    </div>
                  </div>

                  <VTextField
                    v-model="countedText"
                    label="Espèces comptées"
                    prepend-inner-icon="ri-money-dollar-circle-line"
                    suffix="FCFA"
                    inputmode="numeric"
                    autocomplete="off"
                    :rules="countedRules"
                    class="mt-5"
                    hint="Le montant total des billets et pièces présents dans le tiroir."
                    persistent-hint
                    data-testid="caisse-compte"
                  />

                  <VExpandTransition>
                    <div
                      v-if="liveEcart && counted !== null"
                      class="ecart mt-4 pa-4"
                      :class="`ecart--${liveEcart.color}`"
                      aria-live="polite"
                      data-testid="caisse-ecart-live"
                    >
                      <VIcon
                        :icon="liveEcart.icon"
                        size="22"
                      />
                      <div>
                        <div class="font-weight-semibold">
                          {{ liveEcart.title }}
                        </div>
                        <div class="text-body-2">
                          {{ liveEcart.text }}
                        </div>
                      </div>
                    </div>
                  </VExpandTransition>

                  <VAlert
                    v-if="submission.error.value"
                    type="error"
                    variant="tonal"
                    class="mt-4"
                  >
                    {{ pressingError(submission.error.value) }}
                  </VAlert>

                  <VBtn
                    type="submit"
                    block
                    class="mt-5"
                    prepend-icon="ri-lock-line"
                    :loading="submission.pending.value"
                    data-testid="caisse-cloturer"
                  >
                    Clôturer la caisse
                  </VBtn>
                  <p class="text-caption text-medium-emphasis mt-3 mb-0">
                    Une seule clôture par jour, définitive. Les paiements reçus ensuite restent visibles dans le journal.
                  </p>
                </VForm>

                <!-- À clôturer, sans le droit de le faire -->
                <template v-else>
                  <div class="expected pa-4">
                    <div class="text-body-2 text-medium-emphasis">
                      Espèces attendues dans le tiroir
                    </div>
                    <div class="text-h5 font-weight-semibold tabular-nums">
                      <AppMoney :amount="expectedCash" />
                    </div>
                  </div>
                  <div
                    class="d-flex gap-3 mt-4"
                    data-testid="caisse-readonly"
                  >
                    <VIcon
                      icon="ri-shield-user-line"
                      class="text-medium-emphasis"
                    />
                    <p class="text-body-2 text-medium-emphasis mb-0">
                      La caisse de ce jour n'est pas encore clôturée. Seul un responsable du pressing peut la clôturer : il compte les espèces du tiroir et l'écart avec le montant attendu est enregistré.
                    </p>
                  </div>
                </template>
              </VCardText>
            </VCard>
          </VCol>
        </VRow>

        <!-- Paiements -->
        <VCard
          class="mt-6"
          data-tour="caisse-list"
        >
          <VCardItem>
            <VCardTitle>Paiements du jour</VCardTitle>
            <VCardSubtitle class="text-wrap">
              Dans l'ordre où ils ont été encaissés, à l'heure de votre appareil.
            </VCardSubtitle>
            <template #append>
              <span
                v-if="loaded"
                class="text-body-2 text-medium-emphasis text-no-wrap"
              >{{ plural(payments.length, 'ligne') }}</span>
            </template>
          </VCardItem>

          <VDivider />

          <VSkeletonLoader
            v-if="!loaded"
            type="table-thead, table-tbody"
          />

          <AppEmptyState
            v-else-if="payments.length === 0"
            icon="ri-hand-coin-line"
            :title="isToday ? 'Aucun paiement encaissé aujourd\'hui' : 'Aucun paiement ce jour-là'"
            :text="emptyText"
          >
            <VBtn
              v-if="isToday"
              variant="outlined"
              to="/pressing/commandes?onglet=pretes"
            >
              Voir les commandes prêtes
            </VBtn>
          </AppEmptyState>

          <template v-else>
            <VTable
              hover
              class="d-none d-md-block"
              data-testid="caisse-table"
            >
              <thead>
                <tr>
                  <th>Paiement</th>
                  <th>Commande</th>
                  <th>Client</th>
                  <th class="d-none d-lg-table-cell">
                    Référence
                  </th>
                  <th class="text-end">
                    Montant
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="payment in rows"
                  :key="payment.id"
                  :class="{ 'row--cancel': payment.montant < 0 }"
                >
                  <td>
                    <div class="d-flex align-center gap-3 py-2">
                      <VAvatar
                        :color="payment.montant < 0 ? 'error' : MODE_PAIEMENT_INFO[payment.mode].color"
                        variant="tonal"
                        rounded
                        size="38"
                      >
                        <VIcon :icon="payment.montant < 0 ? 'ri-arrow-go-back-line' : MODE_PAIEMENT_INFO[payment.mode].icon" />
                      </VAvatar>
                      <div class="min-w-0">
                        <div class="text-body-1 font-weight-medium text-high-emphasis tabular-nums">
                          {{ formatTime(payment.cree_le) }}
                        </div>
                        <div class="d-flex align-center gap-2 text-body-2 text-medium-emphasis text-no-wrap">
                          <span><span
                            v-if="payment.montant < 0"
                            class="text-error font-weight-medium"
                          >{{ ANNULATION_LABEL }} · </span>{{ MODE_PAIEMENT_INFO[payment.mode].label }}</span>
                          <VChip
                            v-if="isCancelled(payment)"
                            size="x-small"
                            color="error"
                            variant="tonal"
                            label
                            :title="payment.annule_le ? `Annulé le ${formatDateTime(payment.annule_le)}` : undefined"
                          >
                            Annulé ensuite
                          </VChip>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <RouterLink
                      :to="`/pressing/commandes/${payment.commande_id}`"
                      class="order-link text-no-wrap"
                    >
                      {{ payment.commande_numero }}
                    </RouterLink>
                  </td>
                  <td>
                    <div class="client-cell text-high-emphasis">
                      {{ payment.client_nom }}
                    </div>
                  </td>
                  <td class="d-none d-lg-table-cell">
                    <div
                      v-if="payment.reference"
                      class="reference"
                    >
                      {{ payment.reference }}
                    </div>
                    <div
                      v-if="motifOf(payment)"
                      class="text-caption text-medium-emphasis motif"
                    >
                      Motif : {{ motifOf(payment) }}
                    </div>
                    <span
                      v-if="!payment.reference && !motifOf(payment)"
                      class="text-disabled"
                    >—</span>
                  </td>
                  <td class="text-end">
                    <span
                      class="font-weight-semibold tabular-nums text-no-wrap"
                      :class="payment.montant < 0 ? 'text-error' : 'text-high-emphasis'"
                    >{{ formatSignedMoney(payment.montant) }}</span>
                  </td>
                </tr>
              </tbody>
            </VTable>

            <div class="d-md-none pa-4 d-flex flex-column gap-3">
              <div
                v-for="payment in rows"
                :key="payment.id"
                class="pay-card pa-4"
                :class="{ 'pay-card--cancel': payment.montant < 0 }"
              >
                <div class="d-flex align-center gap-3">
                  <VAvatar
                    :color="payment.montant < 0 ? 'error' : MODE_PAIEMENT_INFO[payment.mode].color"
                    variant="tonal"
                    rounded
                    size="38"
                  >
                    <VIcon :icon="payment.montant < 0 ? 'ri-arrow-go-back-line' : MODE_PAIEMENT_INFO[payment.mode].icon" />
                  </VAvatar>
                  <div class="min-w-0 flex-grow-1">
                    <div class="text-body-1 font-weight-medium text-high-emphasis">
                      <span class="tabular-nums">{{ formatTime(payment.cree_le) }}</span> · {{ payment.montant < 0 ? ANNULATION_LABEL : MODE_PAIEMENT_INFO[payment.mode].label }}
                    </div>
                    <RouterLink
                      :to="`/pressing/commandes/${payment.commande_id}`"
                      class="order-link text-body-2 d-block text-truncate"
                    >
                      {{ payment.commande_numero }}
                    </RouterLink>
                    <div class="text-body-2 text-medium-emphasis text-truncate">
                      {{ payment.client_nom }}
                    </div>
                  </div>
                  <span
                    class="font-weight-semibold tabular-nums text-no-wrap"
                    :class="payment.montant < 0 ? 'text-error' : 'text-high-emphasis'"
                  >{{ formatSignedMoney(payment.montant) }}</span>
                </div>
                <div
                  v-if="payment.reference || payment.montant < 0 || isCancelled(payment)"
                  class="d-flex flex-column gap-1 text-caption text-medium-emphasis mt-2"
                >
                  <span v-if="payment.montant < 0">{{ MODE_PAIEMENT_INFO[payment.mode].label }}</span>
                  <span
                    v-if="isCancelled(payment)"
                    class="text-error font-weight-medium"
                  >Annulé ensuite<template v-if="payment.annule_le"> le {{ formatDateTime(payment.annule_le) }}</template></span>
                  <span v-if="payment.reference">Référence : {{ payment.reference }}</span>
                  <span v-if="motifOf(payment)">Motif : {{ motifOf(payment) }}</span>
                </div>
              </div>
            </div>

            <VDivider />

            <AppTablePagination
              :page="page"
              :page-size="pageSize"
              :count="rows.length"
              :total="total"
              :pages="pages"
              :has-next="hasNext"
              @update:page="page = $event"
              @update:page-size="pageSize = $event"
            />
          </template>
        </VCard>
      </template>
    </template>

    <!-- Feuille imprimée (A4), invisible à l'écran -->
    <Teleport to="body">
      <section
        v-if="data && day"
        class="pressing-journal-print"
        aria-hidden="true"
      >
        <header class="pjp-header">
          <div>
            <div class="pjp-kicker">
              Journal de caisse
            </div>
            <h1>{{ tenant.current?.name ?? 'Pressing' }}</h1>
          </div>
          <div class="pjp-right">
            <strong>{{ dayTitle }}</strong>
            <span>Imprimé le {{ printedAt }}</span>
          </div>
        </header>

        <section class="pjp-summary">
          <div class="pjp-total">
            <span>Total encaissé</span>
            <strong>{{ formatSignedMoney(data.total_encaisse) }}</strong>
            <small>{{ plural(received.length, 'paiement') }}<template v-if="cancellations.length"> et {{ plural(cancellations.length, 'annulation') }}</template></small>
          </div>
          <table class="pjp-modes">
            <tbody>
              <tr
                v-for="tile in modeTiles"
                :key="tile.mode"
              >
                <th>{{ tile.label }}</th>
                <td>{{ plural(tile.count, 'paiement') }}</td>
                <td class="pjp-num">
                  {{ formatSignedMoney(tile.amount) }}
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <h2>Paiements</h2>
        <table
          v-if="payments.length"
          class="pjp-lines"
        >
          <thead>
            <tr>
              <th>Heure</th>
              <th>Commande</th>
              <th>Client</th>
              <th>Moyen</th>
              <th>Référence</th>
              <th class="pjp-num">
                Montant
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="payment in payments"
              :key="payment.id"
              :class="{ 'pjp-cancel': payment.montant < 0 }"
            >
              <td>{{ formatTime(payment.cree_le) }}</td>
              <td>{{ payment.commande_numero }}</td>
              <td>{{ payment.client_nom }}</td>
              <td>{{ payment.montant < 0 ? `${ANNULATION_LABEL} · ` : '' }}{{ MODE_PAIEMENT_INFO[payment.mode].label }}{{ isCancelled(payment) ? ' (annulé ensuite)' : '' }}</td>
              <td>
                {{ payment.reference || (motifOf(payment) ? '' : '—') }}
                <small v-if="motifOf(payment)"><br>Motif : {{ motifOf(payment) }}</small>
              </td>
              <td class="pjp-num">
                {{ formatSignedMoney(payment.montant) }}
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <th colspan="5">
                Total encaissé
              </th>
              <th class="pjp-num">
                {{ formatSignedMoney(data.total_encaisse) }}
              </th>
            </tr>
          </tfoot>
        </table>
        <p
          v-else
          class="pjp-muted"
        >
          Aucun paiement enregistré ce jour-là.
        </p>

        <h2>Clôture</h2>
        <table
          v-if="cloture && closedEcart"
          class="pjp-modes"
        >
          <tbody>
            <tr>
              <th>Clôturée le</th>
              <td class="pjp-num">
                {{ formatDateTime(cloture.cree_le) }}
              </td>
            </tr>
            <tr>
              <th>Espèces attendues</th>
              <td class="pjp-num">
                {{ formatMoney(cloture.especes_attendues) }}
              </td>
            </tr>
            <tr>
              <th>Espèces comptées</th>
              <td class="pjp-num">
                {{ formatMoney(cloture.montant_compte) }}
              </td>
            </tr>
            <tr>
              <th>Écart</th>
              <td class="pjp-num">
                {{ cloture.ecart > 0 ? '+ ' : '' }}{{ formatSignedMoney(cloture.ecart) }} — {{ closedEcart.text }}
              </td>
            </tr>
            <tr v-if="afterClose !== 0">
              <th>Net encaissé après la clôture</th>
              <td class="pjp-num">
                {{ formatSignedMoney(afterClose) }}
              </td>
            </tr>
          </tbody>
        </table>
        <div v-else>
          <p class="pjp-muted">
            Caisse non clôturée au moment de l'impression. Espèces attendues : {{ formatMoney(expectedCash) }}.
          </p>
          <div class="pjp-sign">
            <span>Espèces comptées : ………………………… FCFA</span>
            <span>Nom et signature : ……………………………………</span>
          </div>
        </div>

        <footer class="pjp-footer">
          Jour compté dans le fuseau {{ data.fuseau }} ; heures données à l'heure de l'appareil qui a imprimé ce journal.
        </footer>
      </section>
    </Teleport>
  </div>
</template>

<style scoped>
.segmented-scroll {
  max-inline-size: 100%;
  overflow-x: auto;
  scrollbar-width: none;
}

.day-field {
  flex: 0 1 13rem;
  min-inline-size: 11rem;
}

.day-label {
  min-inline-size: 0;
}

.total {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  border: 1px solid rgba(var(--v-theme-primary), 0.24);
  border-radius: 14px;
  background: linear-gradient(135deg, rgba(var(--v-theme-primary), 0.14), rgba(var(--v-theme-primary), 0.03));
  gap: 12px;
}

.total__amount {
  color: rgb(var(--v-theme-primary));
  font-size: 2.25rem;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  line-height: 2.75rem;
}

.total__meta {
  text-align: end;
}

/* Quatre moyens : deux colonnes (jamais une tuile orpheline), une seule sur téléphone. */
.modes {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

@media (max-width: 599px) {
  .modes {
    grid-template-columns: 1fr;
  }
}

.mode-tile {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 12px;
}

.recap {
  display: grid;
  margin: 0;
  gap: 10px;
}

.recap__row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.recap__row dt {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

.recap__row dd {
  margin: 0;
  color: rgba(var(--v-theme-on-surface), var(--v-high-emphasis-opacity));
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  text-align: end;
}

.expected {
  border-radius: 12px;
  background: rgba(var(--v-theme-on-surface), 0.04);
}

.ecart {
  display: flex;
  align-items: flex-start;
  border-radius: 12px;
  gap: 12px;
}

.ecart--success {
  background: rgba(var(--v-theme-success), 0.12);
  color: rgb(var(--v-theme-success));
}

.ecart--warning {
  background: rgba(var(--v-theme-warning), 0.14);
  color: rgb(var(--v-theme-warning));
}

.ecart--error {
  background: rgba(var(--v-theme-error), 0.12);
  color: rgb(var(--v-theme-error));
}

.order-link {
  color: rgb(var(--v-theme-primary));
  font-weight: 500;
  text-decoration: none;
}

.order-link:hover,
.order-link:focus-visible {
  text-decoration: underline;
}

.client-cell {
  overflow: hidden;
  max-inline-size: 16rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reference {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.8125rem;
}

.motif {
  max-inline-size: 18rem;
  white-space: normal;
}

.row--cancel {
  background: rgba(var(--v-theme-error), 0.04);
}

.pay-card {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 14px;
}

.pay-card--cancel {
  border-color: rgba(var(--v-theme-error), 0.35);
  background: rgba(var(--v-theme-error), 0.04);
}
</style>

<style>
/* Feuille A4 du journal : invisible à l'écran, seule imprimée pendant `window.print()`
   (classe posée sur le body par le bouton « Imprimer le journal »). */
.pressing-journal-print {
  display: none;
  color: #111;
  font-family: Inter, 'Segoe UI', Arial, sans-serif;
  font-size: 10.5pt;
  line-height: 1.4;
}

@media print {
  @page {
    margin: 14mm 12mm;
    size: A4 portrait;
  }

  body.pressing-journal-printing {
    background: #fff !important;
  }

  body.pressing-journal-printing #app,
  body.pressing-journal-printing .v-overlay-container {
    display: none !important;
  }

  body.pressing-journal-printing .pressing-journal-print {
    display: block;
  }
}

/* Encre noire quel que soit le thème de l'écran (le thème sombre éclaircit les titres). */
.pressing-journal-print :is(h1, h2, th, td, strong, span, p, small, div) {
  color: inherit;
}

.pressing-journal-print h1 {
  margin: 2pt 0 0;
  font-size: 18pt;
  font-weight: 700;
}

.pressing-journal-print h2 {
  margin: 16pt 0 6pt;
  font-size: 12pt;
  font-weight: 700;
}

.pressing-journal-print .pjp-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  padding-block-end: 8pt;
  border-block-end: 2pt solid #e67e22;
  gap: 16pt;
}

.pressing-journal-print .pjp-kicker {
  color: #e67e22;
  font-size: 9pt;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.pressing-journal-print .pjp-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2pt;
}

.pressing-journal-print .pjp-right span,
.pressing-journal-print .pjp-muted,
.pressing-journal-print small {
  color: #555;
}

.pressing-journal-print .pjp-summary {
  display: flex;
  align-items: stretch;
  margin-block-start: 12pt;
  gap: 16pt;
}

.pressing-journal-print .pjp-total {
  display: flex;
  flex: 0 0 34%;
  flex-direction: column;
  justify-content: center;
  padding: 10pt 12pt;
  border: 1pt solid #e67e22;
  border-radius: 6pt;
  gap: 2pt;
}

.pressing-journal-print .pjp-total strong {
  color: #b85e10;
  font-size: 17pt;
}

.pressing-journal-print table {
  border-collapse: collapse;
  inline-size: 100%;
}

.pressing-journal-print th,
.pressing-journal-print td {
  padding: 4pt 6pt;
  border-block-end: 0.5pt solid #ccc;
  text-align: start;
  vertical-align: top;
}

.pressing-journal-print thead th {
  border-block-end: 1pt solid #111;
  font-size: 9pt;
  text-transform: uppercase;
}

.pressing-journal-print tfoot th {
  border-block: 1pt solid #111;
}

.pressing-journal-print .pjp-modes th {
  font-weight: 600;
}

.pressing-journal-print .pjp-num {
  font-variant-numeric: tabular-nums;
  text-align: end;
  white-space: nowrap;
}

.pressing-journal-print .pjp-lines tbody tr {
  break-inside: avoid;
}

.pressing-journal-print .pjp-cancel td {
  color: #b00020;
}

.pressing-journal-print .pjp-sign {
  display: flex;
  justify-content: space-between;
  margin-block-start: 18pt;
  gap: 16pt;
}

.pressing-journal-print .pjp-footer {
  margin-block-start: 20pt;
  color: #777;
  font-size: 8.5pt;
}
</style>
