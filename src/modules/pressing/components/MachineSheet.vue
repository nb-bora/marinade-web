<!--
  Fiche d'une machine : en-tête, fiche technique et programmes, changement d'état (seulement les
  transitions permises), maintenance (mesure et estimation séparées) et historique. Le contenu est
  le même dans le tiroir latéral (ordinateur) et dans la feuille du bas (téléphone).
-->
<script setup lang="ts">
import { pressingApi } from '../api'
import {
  CATEGORY_INFO,
  HISTORY_INFO,
  MAINTENANCE_INFO,
  MODE_INFO,
  MOTIF_REQUIRED,
  STATE_INFO,
  TRANSITION_ACTION,
  formatCapacity,
  formatMinutes,
  plural,
  pressingError,
  transitionsPermises,
} from '../labels'
import type { Commande, HistoryEvent, Machine, MachineState, Maintenance, Zone } from '../types'
import MachineStateChip from './MachineStateChip.vue'
import MaintenanceFormDialog from './MaintenanceFormDialog.vue'
import { useAsyncData } from '@/composables/useAsyncData'
import { useConfirm } from '@/composables/useConfirm'
import { useSubmit } from '@/composables/useSubmit'
import { formatDate, formatDateTime } from '@/lib/format'
import { useSessionStore } from '@/stores/session.store'
import { useTenantStore } from '@/stores/tenant.store'
import { useToast } from '@/stores/toast.store'

type TabId = 'fiche' | 'etat' | 'maintenance' | 'historique'

const props = defineProps<{
  machineId: string

  /** Zones du plan, pour nommer celle de la machine. */
  zones: Zone[]

  /** Onglet ouvert à l'arrivée (par défaut : la fiche technique). */
  startTab?: TabId

  /** Incrémenté par le parent quand la machine a été modifiée ailleurs (formulaire) : la fiche se recharge. */
  revision?: number

  /** Les écritures (état, maintenance, notes, désactivation) exigent `management`. */
  canWrite: boolean
}>()

const emit = defineEmits<{
  close: []

  /** Une écriture a réussi : les listes parentes doivent se recharger. */
  changed: []
  edit: [machine: Machine]
}>()

const tenant = useTenantStore()
const session = useSessionStore()
const toast = useToast()
const confirm = useConfirm()

const tab = ref<TabId>(props.startTab ?? 'fiche')

const { data: machine, loading, error, reload, refresh } = useAsyncData(
  signal => tenant.currentId ? pressingApi.machine(tenant.currentId, props.machineId, signal) : Promise.reject(new Error('no tenant')),
  { watch: [() => props.machineId] },
)

// --- Données paresseuses : maintenance et historique ne se chargent qu'à l'ouverture de l'onglet ------

const maintenances = useAsyncData(
  signal => tenant.currentId ? pressingApi.maintenances(tenant.currentId, props.machineId, signal) : Promise.resolve([] as Maintenance[]),
  { immediate: false },
)

const PAGE = 30

const events = ref<HistoryEvent[]>([])
const eventsLoading = ref(false)
const eventsError = ref<unknown>(null)
const eventsMore = ref(false)

async function loadEvents(reset = true) {
  if (!tenant.currentId)
    return

  eventsLoading.value = true
  eventsError.value = null

  try {
    const rows = await pressingApi.history(tenant.currentId, props.machineId, { skip: reset ? 0 : events.value.length, limit: PAGE })

    events.value = reset ? rows : [...events.value, ...rows]
    eventsMore.value = rows.length === PAGE
  }
  catch (cause) {
    eventsError.value = cause
  }
  finally {
    eventsLoading.value = false
  }
}

const visited = new Set<TabId>()

function loadTab(id: TabId) {
  if (id === 'maintenance' && !visited.has(id))
    maintenances.reload()
  else if (id === 'historique' && !visited.has(id))
    loadEvents()

  visited.add(id)
}

watch(tab, loadTab)

watch(() => props.revision, () => {
  refresh()
})

watch(() => props.machineId, () => {
  tab.value = props.startTab ?? 'fiche'
  visited.clear()
  events.value = []
  closeState()
  loadTab(tab.value)
})

onMounted(() => loadTab(tab.value))

/** Recharge ce qui est affiché après une écriture réussie. */
async function afterWrite() {
  emit('changed')
  await Promise.all([
    refresh(),
    visited.has('maintenance') ? maintenances.refresh() : undefined,
    visited.has('historique') ? loadEvents() : undefined,
  ])
}

// --- Changer l'état -----------------------------------------------------------------------------------

const targetState = ref<MachineState | null>(null)
const motif = ref('')

/** Machine liée à une commande : ses passages qui casseraient la commande sont masqués. */
const liee = computed(() => !!machine.value?.commande_courante_id)
const allowed = computed(() => machine.value ? transitionsPermises(machine.value.etat_operationnel, liee.value) : [])
const active = computed(() => machine.value?.actif ?? true)

/** Numéro de la commande liée, pour l'explication (une seule lecture, seulement si l'écran est accessible). */
const commandeLiee = useAsyncData(
  signal => tenant.currentId && liee.value && tenant.can('front_of_house') && machine.value?.commande_courante_id
    ? pressingApi.commande(tenant.currentId, machine.value.commande_courante_id, signal)
    : Promise.resolve(null as Commande | null),
  { watch: [() => machine.value?.commande_courante_id, () => tenant.currentId] },
)

function closeState() {
  targetState.value = null
  motif.value = ''
}

const stateSubmit = useSubmit(async (target: MachineState, reason?: string) => {
  const current = machine.value

  if (!current || !tenant.currentId)
    return

  const accepted = await confirm({
    title: `${TRANSITION_ACTION[target]} ?`,
    text: `« ${current.nom} » passera de « ${STATE_INFO[current.etat_operationnel].label.toLowerCase()} » à « ${STATE_INFO[target].label.toLowerCase()} »${reason ? ` (motif : ${reason})` : ''}.`,
    confirmLabel: 'Confirmer',
    danger: target === 'hors_service',
  })

  if (!accepted)
    return

  await pressingApi.changeState(tenant.currentId, current.id, target, reason)
  toast.success(`« ${current.nom} » est maintenant ${STATE_INFO[target].label.toLowerCase()}.`)
  closeState()
  await afterWrite()
})

function chooseState(target: MachineState) {
  stateSubmit.reset()

  if (MOTIF_REQUIRED.includes(target)) {
    targetState.value = target
    motif.value = ''
  }
  else {
    stateSubmit.submit(target)
  }
}

const motifRules = [(value: string) => value.trim().length >= 3 || 'Indiquez le motif en quelques mots (3 caractères au moins).']
const motifForm = ref()

async function submitMotif() {
  if (!targetState.value || !(await motifForm.value?.validate())?.valid)
    return

  await stateSubmit.submit(targetState.value, motif.value.trim())
}

// --- Maintenance -------------------------------------------------------------------------------------

const declareOpen = ref(false)

const closeSubmit = useSubmit(async (maintenance: Maintenance) => {
  if (!tenant.currentId || !machine.value)
    return

  const accepted = await confirm({
    title: 'Clôturer cette intervention ?',
    text: `La fin sera enregistrée maintenant et l'indisponibilité mesurée depuis le ${formatDateTime(maintenance.debut)}. Si « ${machine.value.nom} » est en maintenance pour cette intervention, elle redevient libre.`,
    confirmLabel: 'Clôturer',
  })

  if (!accepted)
    return

  await pressingApi.closeMaintenance(tenant.currentId, maintenance.id)
  toast.success('L\'intervention est clôturée.')
  await afterWrite()
})

const openMaintenance = computed(() => (maintenances.data.value ?? []).filter(item => !item.fin))

async function onDeclared() {
  await afterWrite()
}

// --- Historique ---------------------------------------------------------------------------------------

const note = ref('')
const noteForm = ref()

const noteSubmit = useSubmit(async () => {
  if (!tenant.currentId || !machine.value)
    return

  const accepted = await confirm({
    title: 'Ajouter cette note ?',
    text: 'La note sera ajoutée à l\'historique de la machine et ne pourra plus être modifiée.',
    confirmLabel: 'Ajouter',
  })

  if (!accepted)
    return

  await pressingApi.addNote(tenant.currentId, machine.value.id, note.value.trim())
  toast.success('La note est ajoutée à l\'historique.')
  note.value = ''
  noteForm.value?.resetValidation()
  await afterWrite()
})

const noteRules = [(value: string) => (value.trim().length >= 1 && value.trim().length <= 1000) || 'Écrivez la note, 1000 caractères au plus.']

async function submitNote() {
  if ((await noteForm.value?.validate())?.valid)
    await noteSubmit.submit()
}

function authorOf(event: HistoryEvent): string {
  if (!event.auteur_id)
    return 'Système'

  return event.auteur_id === session.user?.id ? 'Vous' : `Un collègue (n° ${event.auteur_id.slice(0, 4)})`
}

// --- Désactivation ------------------------------------------------------------------------------------

const deactivateSubmit = useSubmit(async () => {
  const current = machine.value

  if (!current || !tenant.currentId)
    return

  const accepted = await confirm({
    title: 'Désactiver cette machine ?',
    text: `« ${current.nom} » disparaîtra du plan et ne pourra plus recevoir de linge. Son historique est conservé. Le serveur refuse si elle est réservée ou en cycle.`,
    confirmLabel: 'Désactiver',
    danger: true,
  })

  if (!accepted)
    return

  await pressingApi.deactivateMachine(tenant.currentId, current.id)
  toast.success(`« ${current.nom} » est désactivée.`)
  emit('changed')
  emit('close')
})

const writeError = computed(() => {
  const failing = [stateSubmit, closeSubmit, noteSubmit, deactivateSubmit].find(item => item.error.value)

  return failing ? pressingError(failing.error.value) : ''
})

// --- Présentation -------------------------------------------------------------------------------------

const details = computed(() => {
  const current = machine.value

  if (!current)
    return []

  const decimal = (value: string | null | undefined, unit: string) => value ? `${Number(value).toLocaleString('fr-FR', { maximumFractionDigits: 3 })} ${unit}` : null

  return [
    { label: 'Marque', icon: 'ri-building-2-line', value: current.marque },
    { label: 'Modèle', icon: 'ri-barcode-box-line', value: current.modele },
    { label: 'Numéro de série', icon: 'ri-hashtag', value: current.numero_serie },
    { label: 'Mise en service', icon: 'ri-calendar-line', value: current.date_mise_en_service ? formatDate(current.date_mise_en_service) : null },
    { label: 'Fonctionnement', icon: 'ri-settings-3-line', value: MODE_INFO[current.type_fonctionnement].label },
    { label: 'Électricité par cycle', icon: 'ri-flashlight-line', value: decimal(current.conso_electrique_kwh_cycle, 'kWh') },
    { label: 'Eau par cycle', icon: 'ri-drop-line', value: decimal(current.conso_eau_litres_cycle, 'L') },
  ]
})

const zoneName = computed(() => props.zones.find(zone => zone.id === machine.value?.zone_id)?.nom ?? null)

const TABS: Array<{ id: TabId; title: string; icon: string }> = [
  { id: 'fiche', title: 'Fiche', icon: 'ri-file-list-3-line' },
  { id: 'etat', title: 'État', icon: 'ri-pulse-line' },
  { id: 'maintenance', title: 'Maintenance', icon: 'ri-tools-line' },
  { id: 'historique', title: 'Historique', icon: 'ri-history-line' },
]

const stepsText = (program: Machine['programmes'][number]) =>
  (program.etapes ?? []).map(step => `${step.nom} ${formatMinutes(step.duree_min)}`).join(' · ')

defineExpose({ reload })
</script>

<template>
  <div class="machine-sheet d-flex flex-column">
    <template v-if="machine">
      <!-- En-tête -->
      <div class="machine-sheet__head px-5 pt-5 pb-3">
        <div class="d-flex align-start gap-3">
          <VAvatar
            :color="CATEGORY_INFO[machine.categorie].color"
            variant="tonal"
            rounded
            size="48"
          >
            <VIcon
              :icon="CATEGORY_INFO[machine.categorie].icon"
              size="26"
            />
          </VAvatar>
          <div class="min-w-0 flex-grow-1">
            <h2 class="text-h6 text-truncate">
              {{ machine.nom }}
            </h2>
            <div class="text-body-2 text-medium-emphasis">
              {{ CATEGORY_INFO[machine.categorie].label }}<template v-if="zoneName">
                · zone {{ zoneName }}
              </template>
            </div>
          </div>
          <VMenu v-if="canWrite">
            <template #activator="{ props: menu }">
              <IconBtn
                v-bind="menu"
                aria-label="Actions sur la machine"
              >
                <VIcon icon="ri-more-2-fill" />
              </IconBtn>
            </template>
            <VList density="compact">
              <VListItem
                prepend-icon="ri-edit-line"
                title="Modifier la fiche"
                @click="emit('edit', machine)"
              />
              <VListItem
                v-if="active"
                prepend-icon="ri-forbid-line"
                title="Désactiver la machine"
                base-color="error"
                @click="deactivateSubmit.submit()"
              />
            </VList>
          </VMenu>
          <IconBtn
            aria-label="Fermer la fiche"
            @click="emit('close')"
          >
            <VIcon icon="ri-close-line" />
          </IconBtn>
        </div>
        <div class="d-flex flex-wrap align-center gap-2 mt-3">
          <MachineStateChip :state="machine.etat_operationnel" />
          <VChip
            size="small"
            label
            variant="tonal"
            prepend-icon="ri-scales-3-line"
          >
            {{ formatCapacity(machine.capacite_kg) }}
          </VChip>
          <VChip
            v-if="!active"
            size="small"
            label
            variant="tonal"
            color="error"
            prepend-icon="ri-forbid-line"
          >
            Désactivée
          </VChip>
        </div>
      </div>

      <VTabs
        v-model="tab"
        grow
        density="comfortable"
        class="machine-sheet__tabs"
      >
        <VTab
          v-for="item in TABS"
          :key="item.id"
          :value="item.id"
          :aria-label="item.title"
        >
          <VIcon
            :icon="item.icon"
            size="20"
            class="me-sm-1"
          />
          <span :class="tab === item.id ? '' : 'd-none d-sm-inline'">{{ item.title }}</span>
        </VTab>
      </VTabs>

      <div class="machine-sheet__body px-5 py-4">
        <VAlert
          v-if="writeError"
          type="error"
          variant="tonal"
          class="mb-4"
          closable
        >
          {{ writeError }}
        </VAlert>

        <VAlert
          v-if="!active"
          type="info"
          variant="tonal"
          class="mb-4"
          icon="ri-information-line"
        >
          Cette machine est désactivée : elle n'apparaît plus sur le plan et son état ne peut plus changer. Sa fiche et son historique restent consultables.
        </VAlert>

        <VWindow
          v-model="tab"
          :touch="false"
        >
          <!-- Fiche technique -->
          <VWindowItem value="fiche">
            <h3 class="text-subtitle-1 font-weight-semibold mb-3">
              Fiche technique
            </h3>
            <dl class="machine-sheet__facts">
              <template
                v-for="item in details"
                :key="item.label"
              >
                <div class="machine-sheet__fact">
                  <dt class="text-body-2 text-medium-emphasis d-flex align-center gap-2">
                    <VIcon
                      :icon="item.icon"
                      size="16"
                    />
                    {{ item.label }}
                  </dt>
                  <dd class="text-body-1 mb-0">
                    {{ item.value || '—' }}
                  </dd>
                </div>
              </template>
            </dl>

            <template v-if="machine.remarques || machine.contraintes">
              <VDivider class="my-4" />
              <div
                v-if="machine.remarques"
                class="mb-3"
              >
                <div class="text-body-2 text-medium-emphasis mb-1">
                  Remarques
                </div>
                <p class="text-body-1 mb-0 machine-sheet__text">
                  {{ machine.remarques }}
                </p>
              </div>
              <div v-if="machine.contraintes">
                <div class="text-body-2 text-medium-emphasis mb-1">
                  Contraintes d'utilisation
                </div>
                <p class="text-body-1 mb-0 machine-sheet__text">
                  {{ machine.contraintes }}
                </p>
              </div>
            </template>

            <VDivider class="my-4" />

            <h3 class="text-subtitle-1 font-weight-semibold mb-3">
              Programmes
              <span class="text-medium-emphasis font-weight-regular">({{ machine.programmes.length }})</span>
            </h3>
            <p
              v-if="!machine.programmes.length"
              class="text-body-2 text-medium-emphasis"
            >
              Aucun programme n'est défini pour cette machine.
            </p>
            <VTable
              v-else
              density="comfortable"
              class="machine-sheet__programs"
            >
              <thead>
                <tr>
                  <th>Programme</th>
                  <th>Durée</th>
                  <th class="text-center">
                    Humaine
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="program in machine.programmes"
                  :key="program.nom"
                >
                  <td class="py-2">
                    <div class="font-weight-medium">
                      {{ program.nom }}
                    </div>
                    <div
                      v-if="program.types_linge?.length"
                      class="d-flex flex-wrap gap-1 mt-1"
                    >
                      <VChip
                        v-for="type in program.types_linge"
                        :key="type"
                        size="x-small"
                        variant="tonal"
                      >
                        {{ type }}
                      </VChip>
                    </div>
                    <div
                      v-if="program.etapes?.length"
                      class="text-caption text-medium-emphasis mt-1"
                    >
                      {{ stepsText(program) }}
                    </div>
                  </td>
                  <td class="text-no-wrap tabular-nums">
                    {{ formatMinutes(program.duree_min) }}
                  </td>
                  <td class="text-center">
                    <VIcon
                      v-if="program.intervention_humaine"
                      icon="ri-user-line"
                      color="warning"
                      aria-label="Intervention humaine requise"
                    />
                    <span
                      v-else
                      class="text-medium-emphasis"
                      aria-label="Aucune intervention"
                    >—</span>
                  </td>
                </tr>
              </tbody>
            </VTable>
          </VWindowItem>

          <!-- État -->
          <VWindowItem value="etat">
            <div
              class="machine-sheet__state pa-4"
              :style="{ '--c': STATE_INFO[machine.etat_operationnel].color.startsWith('#') ? STATE_INFO[machine.etat_operationnel].color : `rgb(var(--v-theme-${STATE_INFO[machine.etat_operationnel].color}))` }"
            >
              <VIcon
                :icon="STATE_INFO[machine.etat_operationnel].icon"
                size="30"
              />
              <div>
                <div class="text-subtitle-1 font-weight-semibold">
                  {{ STATE_INFO[machine.etat_operationnel].label }}
                </div>
                <div class="text-body-2">
                  {{ STATE_INFO[machine.etat_operationnel].hint }}
                </div>
                <div
                  v-if="machine.fin_estimee && machine.etat_operationnel === 'en_cycle'"
                  class="text-body-2 mt-1"
                >
                  Fin estimée : {{ formatDateTime(machine.fin_estimee) }}.
                </div>
              </div>
            </div>

            <h3 class="text-subtitle-1 font-weight-semibold mt-5 mb-1">
              Changer l'état
            </h3>

            <p
              v-if="!canWrite"
              class="text-body-2 text-medium-emphasis"
            >
              Seule la direction peut changer l'état d'une machine. Vous pouvez consulter l'état actuel ci-dessus.
            </p>
            <p
              v-else-if="!active"
              class="text-body-2 text-medium-emphasis"
            >
              Une machine désactivée ne change plus d'état.
            </p>
            <template v-else>
              <VAlert
                v-if="liee"
                type="info"
                variant="tonal"
                icon="ri-link"
                class="mb-4"
                data-testid="machine-linked"
              >
                Cette machine est liée à la commande {{ commandeLiee.data.value?.numero ?? 'en cours' }} : passez par la commande pour changer son état.
                <div
                  v-if="tenant.can('front_of_house') && machine.commande_courante_id"
                  class="mt-3"
                >
                  <VBtn
                    size="large"
                    class="machine-sheet__transition"
                    variant="tonal"
                    prepend-icon="ri-arrow-right-line"
                    :to="`/pressing/commandes/${machine.commande_courante_id}`"
                    data-testid="machine-linked-order"
                  >
                    Ouvrir la commande
                  </VBtn>
                </div>
              </VAlert>

              <p
                v-if="allowed.length"
                class="text-body-2 text-medium-emphasis mb-3"
              >
                Depuis « {{ STATE_INFO[machine.etat_operationnel].label.toLowerCase() }} », seuls {{ plural(allowed.length, 'passage est possible', 'passages sont possibles') }}.
              </p>
              <p
                v-else
                class="text-body-2 text-medium-emphasis mb-3"
              >
                Aucun changement d'état n'est possible depuis « {{ STATE_INFO[machine.etat_operationnel].label.toLowerCase() }} ».
              </p>

              <div class="d-flex flex-column gap-2">
                <VBtn
                  v-for="target in allowed"
                  :key="target"
                  variant="tonal"
                  :color="STATE_INFO[target].color"
                  size="large"
                  class="machine-sheet__transition justify-start"
                  :prepend-icon="STATE_INFO[target].icon"
                  :loading="stateSubmit.pending.value && targetState === null"
                  :disabled="stateSubmit.pending.value"
                  :data-testid="`etat-${target}`"
                  @click="chooseState(target)"
                >
                  <span class="text-start">
                    {{ TRANSITION_ACTION[target] }}
                    <span class="d-block text-caption text-medium-emphasis font-weight-regular">{{ STATE_INFO[target].hint }}</span>
                  </span>
                </VBtn>
              </div>

              <VForm
                v-if="targetState"
                ref="motifForm"
                validate-on="submit"
                class="machine-sheet__motif mt-4 pa-4"
                @submit.prevent="submitMotif"
              >
                <div class="text-subtitle-2 mb-2">
                  {{ TRANSITION_ACTION[targetState] }} : pourquoi ?
                </div>
                <VTextarea
                  v-model="motif"
                  label="Motif (obligatoire)"
                  prepend-inner-icon="ri-chat-1-line"
                  rows="2"
                  auto-grow
                  counter="1000"
                  autofocus
                  :rules="motifRules"
                  placeholder="Courroie cassée, attente d'une pièce..."
                />
                <div class="d-flex justify-end gap-2 mt-3">
                  <VBtn
                    variant="outlined"
                    color="secondary"
                    :disabled="stateSubmit.pending.value"
                    @click="closeState"
                  >
                    Annuler
                  </VBtn>
                  <VBtn
                    type="submit"
                    :color="STATE_INFO[targetState].color"
                    :loading="stateSubmit.pending.value"
                  >
                    Continuer
                  </VBtn>
                </div>
              </VForm>
            </template>
          </VWindowItem>

          <!-- Maintenance -->
          <VWindowItem value="maintenance">
            <div class="d-flex flex-wrap align-center justify-space-between gap-3 mb-4">
              <h3 class="text-subtitle-1 font-weight-semibold">
                Interventions
              </h3>
              <VBtn
                v-if="canWrite && active"
                size="small"
                prepend-icon="ri-alarm-warning-line"
                data-testid="declarer-maintenance"
                @click="declareOpen = true"
              >
                Déclarer une panne ou un entretien
              </VBtn>
            </div>

            <VSkeletonLoader
              v-if="maintenances.loading.value && !maintenances.data.value"
              type="list-item-three-line, list-item-three-line"
            />
            <AppErrorState
              v-else-if="maintenances.error.value"
              :error="maintenances.error.value"
              @retry="maintenances.reload"
            />
            <AppEmptyState
              v-else-if="!maintenances.data.value?.length"
              icon="ri-tools-line"
              title="Aucune intervention"
              text="Les pannes, entretiens et réparations de cette machine apparaîtront ici, avec l'indisponibilité qu'ils ont causée."
            />
            <div
              v-else
              class="d-flex flex-column gap-3"
            >
              <VCard
                v-for="item in maintenances.data.value"
                :key="item.id"
                variant="outlined"
                class="pa-4"
              >
                <div class="d-flex align-center justify-space-between gap-2 mb-2">
                  <VChip
                    :color="MAINTENANCE_INFO[item.type].color"
                    variant="tonal"
                    size="small"
                    label
                    :prepend-icon="MAINTENANCE_INFO[item.type].icon"
                  >
                    {{ MAINTENANCE_INFO[item.type].label }}
                  </VChip>
                  <VChip
                    :color="item.fin ? 'success' : 'warning'"
                    variant="tonal"
                    size="small"
                    label
                  >
                    {{ item.fin ? 'Terminée' : 'En cours' }}
                  </VChip>
                </div>
                <p class="text-body-1 mb-2 machine-sheet__text">
                  {{ item.description }}
                </p>
                <div class="text-body-2 text-medium-emphasis mb-3">
                  Du {{ formatDateTime(item.debut) }}<template v-if="item.fin">
                    au {{ formatDateTime(item.fin) }}
                  </template>
                </div>

                <!-- Mesure et estimation : deux blocs distincts, jamais mélangés. -->
                <div class="machine-sheet__durations">
                  <div class="machine-sheet__measured pa-3">
                    <div class="text-caption text-medium-emphasis d-flex align-center gap-1">
                      <VIcon
                        icon="ri-timer-flash-line"
                        size="14"
                      />
                      Indisponibilité mesurée
                    </div>
                    <div
                      v-if="item.indisponibilite_min != null"
                      class="text-h6 tabular-nums"
                    >
                      {{ formatMinutes(item.indisponibilite_min) }}
                    </div>
                    <div
                      v-else
                      class="text-body-2 text-medium-emphasis"
                    >
                      Mesurée à la clôture
                    </div>
                  </div>
                  <div class="machine-sheet__estimated pa-3">
                    <div class="text-caption text-medium-emphasis d-flex align-center gap-1">
                      <VIcon
                        icon="ri-hourglass-line"
                        size="14"
                      />
                      Durée estimée
                    </div>
                    <div
                      v-if="item.duree_estimee_min != null"
                      class="text-h6 tabular-nums text-medium-emphasis"
                    >
                      {{ formatMinutes(item.duree_estimee_min) }}
                    </div>
                    <div
                      v-else
                      class="text-body-2 text-medium-emphasis"
                    >
                      Non estimée
                    </div>
                  </div>
                </div>

                <VBtn
                  v-if="canWrite && !item.fin"
                  variant="tonal"
                  color="success"
                  size="small"
                  class="mt-3"
                  prepend-icon="ri-check-line"
                  :loading="closeSubmit.pending.value"
                  :data-testid="`cloturer-${item.id}`"
                  @click="closeSubmit.submit(item)"
                >
                  Clôturer l'intervention
                </VBtn>
              </VCard>
            </div>
            <p
              v-if="openMaintenance.length && !canWrite"
              class="text-body-2 text-medium-emphasis mt-3"
            >
              Seule la direction peut clôturer une intervention.
            </p>
          </VWindowItem>

          <!-- Historique -->
          <VWindowItem value="historique">
            <VForm
              v-if="canWrite"
              ref="noteForm"
              validate-on="submit"
              class="mb-5"
              @submit.prevent="submitNote"
            >
              <VTextarea
                v-model="note"
                label="Ajouter une note"
                prepend-inner-icon="ri-sticky-note-line"
                rows="2"
                auto-grow
                counter="1000"
                :rules="noteRules"
                placeholder="Bruit inhabituel à l'essorage, joint remplacé..."
                data-testid="note-texte"
              />
              <div class="d-flex justify-end mt-2">
                <VBtn
                  type="submit"
                  size="small"
                  prepend-icon="ri-add-line"
                  :loading="noteSubmit.pending.value"
                >
                  Ajouter la note
                </VBtn>
              </div>
            </VForm>

            <VSkeletonLoader
              v-if="eventsLoading && !events.length"
              type="list-item-three-line, list-item-three-line"
            />
            <AppErrorState
              v-else-if="eventsError"
              :error="eventsError"
              @retry="loadEvents"
            />
            <AppEmptyState
              v-else-if="!events.length"
              icon="ri-history-line"
              title="Pas encore d'historique"
              text="Chaque changement d'état, intervention et note de cette machine sera daté et conservé ici."
            />
            <template v-else>
              <VTimeline
                side="end"
                density="compact"
                line-inset="9"
                truncate-line="both"
                class="machine-sheet__timeline"
              >
                <VTimelineItem
                  v-for="event in events"
                  :key="event.id"
                  :dot-color="HISTORY_INFO[event.type].color"
                  size="small"
                  :icon="HISTORY_INFO[event.type].icon"
                >
                  <div class="d-flex flex-wrap align-center gap-2">
                    <span class="text-subtitle-2 font-weight-semibold">{{ HISTORY_INFO[event.type].label }}</span>
                    <template v-if="event.type === 'etat_change' && event.nouvel_etat">
                      <MachineStateChip
                        v-if="event.ancien_etat"
                        :state="event.ancien_etat"
                        size="x-small"
                      />
                      <VIcon
                        v-if="event.ancien_etat"
                        icon="ri-arrow-right-line"
                        size="14"
                      />
                      <MachineStateChip
                        :state="event.nouvel_etat"
                        size="x-small"
                      />
                    </template>
                  </div>
                  <p
                    v-if="event.motif"
                    class="text-body-2 mb-0 mt-1 machine-sheet__text"
                  >
                    {{ event.motif }}
                  </p>
                  <div class="text-caption text-medium-emphasis mt-1">
                    {{ formatDateTime(event.date) }} · {{ authorOf(event) }}
                  </div>
                </VTimelineItem>
              </VTimeline>
              <div
                v-if="eventsMore"
                class="text-center mt-2"
              >
                <VBtn
                  variant="text"
                  size="small"
                  :loading="eventsLoading"
                  @click="loadEvents(false)"
                >
                  Voir les événements plus anciens
                </VBtn>
              </div>
            </template>
          </VWindowItem>
        </VWindow>
      </div>

      <MaintenanceFormDialog
        v-model="declareOpen"
        :machine="machine"
        @saved="onDeclared"
      />
    </template>

    <div
      v-else-if="loading"
      class="pa-5"
    >
      <VSkeletonLoader type="avatar, heading, text, text, list-item-three-line" />
    </div>
    <div
      v-else-if="error"
      class="pa-5"
    >
      <AppErrorState
        :error="error"
        @retry="reload"
      />
    </div>
  </div>
</template>

<style scoped>
.machine-sheet {
  block-size: 100%;
  min-block-size: 0;
}

.machine-sheet__head {
  flex: none;
}

.machine-sheet__tabs :deep(.v-tab.v-btn) {
  min-inline-size: 0;
  padding-inline: 8px;
  font-size: 0.8125rem;
  letter-spacing: 0;
}

.machine-sheet__tabs {
  flex: none;
  border-block-end: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.machine-sheet__body {
  flex: 1 1 auto;
  min-block-size: 0;
  overflow-y: auto;
}

.machine-sheet__facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px 16px;
  margin: 0;
}

.machine-sheet__fact {
  min-inline-size: 0;
  overflow-wrap: anywhere;
}

.machine-sheet__text {
  white-space: pre-line;
  overflow-wrap: anywhere;
}

.machine-sheet__programs :deep(th) {
  font-size: 0.75rem;
}

.machine-sheet__state {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  border: 1px solid color-mix(in srgb, var(--c) 45%, transparent);
  border-radius: 12px;
  background: color-mix(in srgb, var(--c) 10%, transparent);
}

.machine-sheet__state > .v-icon {
  color: var(--c);
}

.machine-sheet__transition :deep(.v-btn__content) {
  white-space: normal;
  text-align: start;
}

.machine-sheet__transition {
  block-size: auto !important;
  min-block-size: 52px;
  padding-block: 8px;
  text-transform: none;
  letter-spacing: 0;
  white-space: normal;
}

.machine-sheet__motif {
  border: 1px dashed rgba(var(--v-border-color), 0.5);
  border-radius: 12px;
}

.machine-sheet__durations {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.machine-sheet__measured {
  border: 1px solid rgba(var(--v-theme-primary), 0.5);
  border-radius: 10px;
  background: rgba(var(--v-theme-primary), 0.07);
}

.machine-sheet__estimated {
  border: 1px dashed rgba(var(--v-border-color), 0.55);
  border-radius: 10px;
}

.machine-sheet__timeline :deep(.v-timeline-item__body) {
  padding-block-end: 12px !important;
}

@media (max-width: 400px) {
  .machine-sheet__facts,
  .machine-sheet__durations {
    grid-template-columns: 1fr;
  }
}
</style>
