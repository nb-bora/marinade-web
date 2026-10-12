<!--
  Rapports du pressing sur une période (7, 30, 90 jours ou dates choisies, 366 jours au plus) :
  chiffre d'affaires FACTURÉ (commandes non annulées, jour de dépôt), commandes, poids traité,
  durée moyenne d'un cycle MESURÉE (cycles terminés), pannes, CA par jour, répartition par service
  et utilisation des machines. Tout vient de GET /rapports ; export CSV de la période.
-->
<script setup lang="ts">
import { useDisplay } from 'vuetify'
import { pressingApi } from '../api'
import { dayKey, downloadText, formatDuration, formatKgValue, shiftDay, toCsv } from '../commandes'
import type { MetricItem } from '../components/MetricStrip.vue'
import MetricStrip from '../components/MetricStrip.vue'
import { PERIODE_MAX_JOURS, PERIODE_OPTIONS, SERVICES, SERVICE_INFO, capitalize, daysBetween, formatDayLong, formatDayMedium, formatDayNumeric, formatDayShort, isDayKey, plural } from '../labels'
import type { PeriodeChoix } from '../labels'
import { useAsyncData } from '@/composables/useAsyncData'
import { useChartTheme } from '@/composables/useChartTheme'
import { formatMoney } from '@/lib/format'
import { useTenantStore } from '@/stores/tenant.store'
import { useToast } from '@/stores/toast.store'

const tenant = useTenantStore()
const toast = useToast()
const theme = useChartTheme()

// Sur téléphone, moins de dates sur l'axe pour qu'elles ne se chevauchent pas.
const display = useDisplay()

const canRead = computed(() => tenant.can('management'))

// --- Période -----------------------------------------------------------------------------------

const today = ref(dayKey())

useIntervalFn(() => {
  today.value = dayKey()
}, 60_000)

const choice = ref<PeriodeChoix>('30')
const customFrom = ref(shiftDay(today.value, -29))
const customTo = ref(today.value)

const customError = computed(() => {
  if (choice.value !== 'perso')
    return ''

  if (!isDayKey(customFrom.value) || !isDayKey(customTo.value))
    return 'Choisissez une date de début et une date de fin.'

  if (customTo.value > today.value)
    return 'La date de fin ne peut pas dépasser aujourd\'hui.'

  if (customFrom.value > customTo.value)
    return 'La date de début doit précéder la date de fin.'

  const days = daysBetween(customFrom.value, customTo.value)

  return days > PERIODE_MAX_JOURS ? `La période ne peut pas dépasser ${PERIODE_MAX_JOURS} jours : vous en avez choisi ${days}.` : ''
})

const period = computed<{ du: string; au: string } | null>(() => {
  if (choice.value === 'perso')
    return customError.value ? null : { du: customFrom.value, au: customTo.value }

  return { du: shiftDay(today.value, -(Number(choice.value) - 1)), au: today.value }
})

const periodText = computed(() => {
  if (!period.value)
    return ''

  const { du, au } = period.value
  const days = daysBetween(du, au)

  return du === au ? `${capitalize(formatDayLong(du))} · 1 jour` : `Du ${formatDayMedium(du)} au ${formatDayMedium(au)} · ${days} jours`
})

// --- Rapport -----------------------------------------------------------------------------------

const report = useAsyncData(
  signal => tenant.currentId && canRead.value && period.value ? pressingApi.rapports(tenant.currentId, period.value.du, period.value.au, signal) : Promise.resolve(null),
  { watch: [() => period.value?.du, () => period.value?.au, () => tenant.currentId] },
)

const data = computed(() => report.data.value)
const loaded = computed(() => data.value !== null)

/** Le rapport affiché ne correspond plus à la période choisie (chargement en cours). */
const stale = computed(() => !!data.value && !!period.value && (data.value.periode.du !== period.value.du || data.value.periode.au !== period.value.au))

const caTotal = computed(() => data.value?.ca_par_jour.reduce((sum, jour) => sum + jour.montant, 0) ?? 0)
const caAverage = computed(() => (data.value && data.value.periode.jours > 0 ? Math.round(caTotal.value / data.value.periode.jours) : 0))

const bestDay = computed(() => data.value?.ca_par_jour.reduce<{ date: string; montant: number } | null>(
  (top, jour) => (!top || jour.montant > top.montant ? jour : top), null,
) ?? null)

const isEmpty = computed(() => !!data.value && data.value.nb_commandes === 0 && caTotal.value === 0)

/** Durée sans retour à la ligne entre le nombre et l'unité (« 3 h 20 »). */
const durationText = (minutes: number | null | undefined) => formatDuration(minutes).replace(/ /g, ' ')

const strip = computed<MetricItem[]>(() => {
  const rapport = data.value
  const pannes = rapport?.pannes

  return [
    { label: 'CA facturé', value: formatMoney(caTotal.value), icon: 'ri-money-dollar-circle-line', color: 'primary', hint: 'Commandes non annulées' },
    { label: 'Commandes', value: String(rapport?.nb_commandes ?? 0), icon: 'ri-shopping-basket-2-line', color: 'info', hint: 'Hors commandes annulées' },
    { label: 'Poids traité', value: formatKgValue(rapport?.poids_kg ?? 0), icon: 'ri-scales-3-line', color: 'success', hint: 'Linge pesé à la réception' },
    { label: 'Durée moyenne mesurée', value: formatDuration(rapport?.duree_moyenne_cycle_min_mesuree), icon: 'ri-timer-line', color: 'secondary', hint: rapport?.duree_moyenne_cycle_min_mesuree === null || rapport?.duree_moyenne_cycle_min_mesuree === undefined ? 'Aucun cycle terminé sur la période' : 'Par cycle de machine terminé' },
    {
      label: 'Pannes',
      value: String(pannes?.nombre ?? 0),
      icon: 'ri-alarm-warning-line',
      color: (pannes?.nombre ?? 0) > 0 ? 'error' : 'secondary',
      hint: (pannes?.nombre ?? 0) > 0 ? `Indisponibilité : ${durationText(pannes?.indisponibilite_min ?? 0)}` : 'Aucune panne déclarée',
    },
  ]
})

// --- Graphique du CA par jour --------------------------------------------------------------------

const series = computed(() => [{ name: 'CA facturé', data: data.value?.ca_par_jour.map(jour => jour.montant) ?? [] }])

const chartOptions = computed(() => {
  const t = theme.value
  const days = data.value?.ca_par_jour ?? []

  return {
    chart: { type: 'area', toolbar: { show: false }, zoom: { enabled: false }, parentHeightOffset: 0, fontFamily: t.fontFamily },
    colors: [t.primary],

    // Courbe monotone : jamais sous zéro ni au-dessus du vrai pic entre deux jours.
    stroke: { curve: 'monotoneCubic', width: 3 },
    fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.02, stops: [0, 90, 100] } },
    dataLabels: { enabled: false },
    markers: { size: days.length <= 31 ? 3 : 0, strokeWidth: 0, hover: { size: 6 } },
    legend: { show: false },
    grid: { borderColor: t.grid, strokeDashArray: 6, padding: { top: -10, left: 6, right: 12, bottom: -4 } },
    xaxis: {
      categories: days.map(jour => formatDayShort(jour.date)),
      tickAmount: Math.min(display.smAndDown.value ? 3 : 8, Math.max(1, days.length - 1)),
      tickPlacement: 'on',
      axisBorder: { show: false },
      axisTicks: { show: false },
      crosshairs: { stroke: { color: t.grid } },
      tooltip: { enabled: false },
      labels: { style: { colors: t.text, fontSize: '12px' }, rotate: 0, hideOverlappingLabels: true },
    },
    yaxis: {
      min: 0,
      tickAmount: 4,
      forceNiceScale: true,
      labels: {
        style: { colors: t.text, fontSize: '12px' },
        formatter: (value: number) => (value >= 1000 ? `${(value / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} k` : String(Math.round(value))),
      },
    },
    tooltip: {
      theme: t.mode,
      x: { formatter: (_value: unknown, context: { dataPointIndex: number }) => capitalize(formatDayLong(days[context.dataPointIndex]?.date ?? '')) },
      y: { formatter: (value: number) => formatMoney(value) },
    },
  }
})

// --- Services et machines ------------------------------------------------------------------------

const services = computed(() => {
  const parService = data.value?.ca_par_service

  if (!parService)
    return []

  const sum = SERVICES.reduce((total, key) => total + parService[key], 0)

  return SERVICES
    .map(key => ({ key, ...SERVICE_INFO[key], amount: parService[key], percent: sum > 0 ? Math.round(parService[key] / sum * 100) : 0 }))
    .sort((a, b) => b.amount - a.amount)
})

const servicesTotal = computed(() => services.value.reduce((sum, service) => sum + service.amount, 0))

const machines = computed(() => [...(data.value?.machines ?? [])]
  .sort((a, b) => b.heures_utilisation - a.heures_utilisation || b.cycles - a.cycles || a.nom.localeCompare(b.nom, 'fr', { numeric: true })))

const maxHours = computed(() => Math.max(0, ...machines.value.map(machine => machine.heures_utilisation)))

const hoursText = (hours: number) => formatDuration(Math.round(hours * 60))

// --- Export CSV ----------------------------------------------------------------------------------

function exportCsv() {
  const rapport = data.value

  if (!rapport || stale.value)
    return

  const { du, au, jours } = rapport.periode

  const rows: Array<Array<string | number>> = [
    ['Rapport du pressing', tenant.current?.name ?? ''],
    ['Du', formatDayNumeric(du)],
    ['Au', formatDayNumeric(au)],
    ['Nombre de jours', jours],
    [],
    ['Indicateur', 'Valeur'],
    ['Chiffre d\'affaires facturé (FCFA)', caTotal.value],
    ['Commandes (hors annulées)', rapport.nb_commandes],
    ['Poids traité (kg)', rapport.poids_kg],
    ['Durée moyenne mesurée d\'un cycle (min)', rapport.duree_moyenne_cycle_min_mesuree ?? ''],
    ['Pannes', rapport.pannes.nombre],
    ['Indisponibilité due aux pannes (min)', rapport.pannes.indisponibilite_min],
    [],
    ['Date', 'Chiffre d\'affaires facturé (FCFA)'],
    ...rapport.ca_par_jour.map(jour => [formatDayNumeric(jour.date), jour.montant]),
    [],
    ['Service', 'Montant avant remise (FCFA)'],
    ...SERVICES.map(key => [SERVICE_INFO[key].label, rapport.ca_par_service[key]]),
    [],
    ['Machine', 'Cycles terminés', 'Heures d\'utilisation mesurées'],
    ...machines.value.map(machine => [machine.nom, machine.cycles, machine.heures_utilisation]),
  ]

  downloadText(`rapport-pressing-${du}-au-${au}.csv`, toCsv(rows))
  toast.success('Le rapport de la période a été exporté.')
}
</script>

<template>
  <div>
    <AppPageHeader
      title="Rapports"
      subtitle="L'activité du pressing sur une période : chiffre d'affaires, linge traité et machines."
    >
      <template
        v-if="canRead"
        #actions
      >
        <VBtn
          variant="outlined"
          color="secondary"
          prepend-icon="ri-file-download-line"
          :disabled="!loaded || stale || !period"
          data-tour="rapports-export"
          data-testid="rapports-export"
          @click="exportCsv"
        >
          Exporter en CSV
        </VBtn>
      </template>
    </AppPageHeader>

    <VCard v-if="!canRead">
      <AppEmptyState
        icon="ri-lock-line"
        title="Les rapports sont réservés aux responsables"
        text="Demandez au responsable du pressing de vous les communiquer."
      />
    </VCard>

    <template v-else>
      <!-- Période -->
      <VCard
        class="mb-6"
        data-tour="rapports-period"
      >
        <VCardText class="d-flex flex-wrap align-center gap-4">
          <div class="segmented-scroll">
            <AppSegmented
              v-model="choice"
              :options="PERIODE_OPTIONS"
              label="Période du rapport"
            />
          </div>
          <template v-if="choice === 'perso'">
            <VTextField
              v-model="customFrom"
              type="date"
              label="Du"
              prepend-inner-icon="ri-calendar-line"
              :max="today"
              hide-details
              class="date-field"
              data-testid="rapports-du"
            />
            <VTextField
              v-model="customTo"
              type="date"
              label="Au"
              prepend-inner-icon="ri-calendar-line"
              :max="today"
              hide-details
              class="date-field"
              data-testid="rapports-au"
            />
          </template>
          <VSpacer class="d-none d-md-block" />
          <span
            v-if="period"
            class="text-body-1 text-medium-emphasis"
            data-testid="rapports-periode"
          >{{ periodText }}</span>
        </VCardText>
        <VExpandTransition>
          <div v-if="customError">
            <VAlert
              type="warning"
              variant="tonal"
              density="compact"
              class="mx-4 mb-4"
              data-testid="rapports-periode-erreur"
            >
              {{ customError }}
            </VAlert>
          </div>
        </VExpandTransition>
        <VProgressLinear
          v-if="report.loading.value"
          indeterminate
          color="primary"
          height="2"
          class="period-progress"
        />
      </VCard>

      <VCard v-if="!period">
        <AppEmptyState
          icon="ri-calendar-line"
          title="Corrigez la période"
          :text="`Choisissez deux dates passées, la première avant la seconde, ${PERIODE_MAX_JOURS} jours au plus.`"
        />
      </VCard>

      <AppErrorState
        v-else-if="report.error.value"
        :error="report.error.value"
        @retry="report.reload"
      />

      <div
        v-else
        :class="{ 'is-refreshing': stale }"
      >
        <MetricStrip
          :items="strip"
          :loading="!loaded"
          data-tour="rapports-metrics"
        />

        <VRow class="mt-2">
          <!-- CA par jour -->
          <VCol
            cols="12"
            lg="8"
          >
            <VCard
              class="h-100"
              data-tour="rapports-chart"
            >
              <VCardItem>
                <template #prepend>
                  <VAvatar
                    color="primary"
                    variant="tonal"
                    rounded
                  >
                    <VIcon icon="ri-line-chart-line" />
                  </VAvatar>
                </template>
                <VCardTitle class="text-wrap">
                  Chiffre d'affaires facturé par jour
                </VCardTitle>
                <VCardSubtitle class="text-wrap">
                  Commandes non annulées, comptées le jour de leur dépôt.
                </VCardSubtitle>
              </VCardItem>

              <VCardText>
                <VSkeletonLoader
                  v-if="!loaded"
                  type="image"
                  height="280"
                />
                <AppEmptyState
                  v-else-if="isEmpty"
                  icon="ri-line-chart-line"
                  title="Aucune commande sur cette période"
                  text="Choisissez une période plus longue, ou revenez après vos premières commandes."
                />
                <template v-else-if="data">
                  <VueApexCharts
                    type="area"
                    height="280"
                    :options="chartOptions"
                    :series="series"
                    data-testid="rapports-chart"
                  />
                  <div class="d-flex flex-wrap align-center gap-x-6 gap-y-2 mt-2">
                    <div class="d-flex align-baseline gap-3">
                      <span class="text-h5 font-weight-semibold tabular-nums">{{ formatMoney(caAverage) }}</span>
                      <span class="text-body-2 text-medium-emphasis">facturés en moyenne par jour</span>
                    </div>
                    <VSpacer />
                    <span
                      v-if="bestDay && bestDay.montant > 0"
                      class="text-body-2"
                    >
                      Meilleur jour : <strong class="text-primary">{{ formatDayLong(bestDay.date) }}</strong>
                      ({{ formatMoney(bestDay.montant) }})
                    </span>
                  </div>
                </template>
              </VCardText>
            </VCard>
          </VCol>

          <!-- Par service -->
          <VCol
            cols="12"
            lg="4"
          >
            <VCard
              class="h-100"
              data-tour="rapports-services"
            >
              <VCardItem>
                <template #prepend>
                  <VAvatar
                    color="info"
                    variant="tonal"
                    rounded
                  >
                    <VIcon icon="ri-pie-chart-2-line" />
                  </VAvatar>
                </template>
                <VCardTitle>Répartition par service</VCardTitle>
                <VCardSubtitle class="text-wrap">
                  Ce que rapporte chaque service sur la période.
                </VCardSubtitle>
              </VCardItem>

              <VCardText>
                <VSkeletonLoader
                  v-if="!loaded"
                  type="list-item-two-line, list-item-two-line, list-item-two-line, list-item-two-line"
                />
                <p
                  v-else-if="servicesTotal === 0"
                  class="text-body-2 text-medium-emphasis mb-0"
                >
                  Aucun service facturé sur cette période.
                </p>
                <template v-else>
                  <div class="d-flex flex-column gap-5">
                    <div
                      v-for="service in services"
                      :key="service.key"
                      :data-testid="`rapports-service-${service.key}`"
                    >
                      <div class="d-flex align-center gap-2 mb-2">
                        <VAvatar
                          :color="service.color"
                          variant="tonal"
                          rounded
                          size="28"
                        >
                          <VIcon
                            :icon="service.icon"
                            size="16"
                          />
                        </VAvatar>
                        <span class="text-body-1 text-high-emphasis">{{ service.label }}</span>
                        <VSpacer />
                        <span class="text-body-2 font-weight-medium tabular-nums text-no-wrap">{{ formatMoney(service.amount) }}</span>
                        <span class="text-body-2 text-medium-emphasis tabular-nums percent">{{ service.percent }} %</span>
                      </div>
                      <VProgressLinear
                        :model-value="service.percent"
                        :color="service.color"
                        height="8"
                        rounded
                        bg-opacity="0.14"
                        :aria-label="`${service.label} : ${service.percent} %`"
                      />
                    </div>
                  </div>
                  <p class="text-caption text-medium-emphasis mt-5 mb-0">
                    Montants des lignes avant remise : leur somme ({{ formatMoney(servicesTotal) }}) peut dépasser le chiffre d'affaires facturé.
                  </p>
                </template>
              </VCardText>
            </VCard>
          </VCol>

          <!-- Machines -->
          <VCol cols="12">
            <VCard data-tour="rapports-machines">
              <VCardItem>
                <template #prepend>
                  <VAvatar
                    color="success"
                    variant="tonal"
                    rounded
                  >
                    <VIcon icon="ri-t-shirt-air-line" />
                  </VAvatar>
                </template>
                <VCardTitle>Machines</VCardTitle>
                <VCardSubtitle class="text-wrap">
                  Cycles terminés sur la période et temps d'utilisation mesuré, de la plus utilisée à la moins utilisée.
                </VCardSubtitle>
              </VCardItem>

              <VSkeletonLoader
                v-if="!loaded"
                type="table-thead, table-tbody"
              />
              <AppEmptyState
                v-else-if="machines.length === 0"
                icon="ri-t-shirt-air-line"
                title="Aucune machine active"
                text="Ajoutez vos machines pour suivre leur utilisation."
              >
                <VBtn
                  variant="outlined"
                  to="/pressing/machines"
                >
                  Voir les machines
                </VBtn>
              </AppEmptyState>
              <VTable
                v-else
                class="machines-table"
                data-testid="rapports-machines"
              >
                <thead>
                  <tr>
                    <th>Machine</th>
                    <th class="text-end">
                      Cycles
                    </th>
                    <th class="text-end th-wrap">
                      Temps mesuré
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="machine in machines"
                    :key="machine.machine_id"
                  >
                    <td>
                      <div class="d-flex align-center gap-3 py-2">
                        <VAvatar
                          :color="machine.cycles > 0 ? 'primary' : 'secondary'"
                          variant="tonal"
                          rounded
                          size="38"
                          class="d-none d-sm-flex"
                        >
                          <VIcon icon="ri-t-shirt-air-line" />
                        </VAvatar>
                        <div class="min-w-0 flex-grow-1">
                          <div class="text-body-1 font-weight-medium text-high-emphasis machine-name">
                            {{ machine.nom }}
                          </div>
                          <VProgressLinear
                            :model-value="maxHours > 0 ? machine.heures_utilisation / maxHours * 100 : 0"
                            color="primary"
                            height="5"
                            rounded
                            bg-opacity="0.12"
                            class="mt-2 usage-bar"
                            :aria-label="`Utilisation de ${machine.nom}`"
                          />
                        </div>
                      </div>
                    </td>
                    <td class="text-end tabular-nums">
                      {{ machine.cycles }}
                    </td>
                    <td class="text-end">
                      <span
                        v-if="machine.cycles > 0"
                        class="font-weight-medium text-high-emphasis"
                      >{{ hoursText(machine.heures_utilisation) }}</span>
                      <span
                        v-else
                        class="text-disabled"
                      >Aucun cycle</span>
                    </td>
                  </tr>
                </tbody>
              </VTable>
              <VCardText
                v-if="loaded && machines.length"
                class="text-caption text-medium-emphasis pt-3"
              >
                {{ plural(machines.reduce((sum, machine) => sum + machine.cycles, 0), 'cycle terminé', 'cycles terminés') }} au total, mesurés entre le démarrage réel et la fin réelle de chaque cycle.
              </VCardText>
            </VCard>
          </VCol>
        </VRow>
      </div>
    </template>
  </div>
</template>

<style scoped>
.segmented-scroll {
  max-inline-size: 100%;
  overflow-x: auto;
  scrollbar-width: none;
}

.date-field {
  flex: 1 1 10rem;
  max-inline-size: 12rem;
}

.period-progress {
  position: absolute;
  inset-block-end: 0;
}

.is-refreshing {
  opacity: 0.55;
  pointer-events: none;
  transition: opacity 0.15s ease;
}

.percent {
  min-inline-size: 2.75rem;
  text-align: end;
}

.th-wrap {
  white-space: normal !important;
}

/* Trois colonnes à largeur fixe : le tableau tient dans la carte, même à 390 px. */
.machines-table :deep(table) {
  table-layout: fixed;
}

.machines-table :deep(th:first-child) {
  inline-size: 50%;
}

.machines-table :deep(td),
.machines-table :deep(th) {
  padding-inline: 12px !important;
}

.machine-name {
  overflow: hidden;
  max-inline-size: 22rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.usage-bar {
  max-inline-size: 22rem;
}
</style>
