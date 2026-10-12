<!--
  Affectation des machines d'une commande : recommandation (jusqu'à trois options comparables),
  réservation de l'option affichée (par identifiants de machines), puis conduite des cycles
  (démarrer, terminer, interrompre, décharger). Les actions de cycle ne sont proposées que pour les
  machines réellement liées à CETTE commande. Sert pour le lavage comme pour le séchage.
-->
<script setup lang="ts">
import { pressingApi } from '../api'
import { ETAPE_LABELS, formatDateHeure, formatHeure, formatKgValue, ligneLiee, programmeCompatible } from '../commandes'
import { toTarget, unloadLabel, useMachineCycle } from '../composables/useMachineCycle'
import { CATEGORY_INFO, STATE_INFO, formatCapacity, formatMinutes, pressingError } from '../labels'
import type { Commande, CommandeMachine, Machine, OptionAffectation, Recommandation } from '../types'
import MachineStateChip from './MachineStateChip.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useSubmit } from '@/composables/useSubmit'
import { isApiError } from '@/lib/http/errors'
import { useTenantStore } from '@/stores/tenant.store'
import { useToast } from '@/stores/toast.store'

const props = defineProps<{
  commande: Commande

  /** Parc de machines (états à jour), chargé par la page parente avec la commande. */
  machines: Machine[]

  /** Lance la recherche dès l'ouverture (arrivée juste après la création). */
  autoSearch?: boolean
}>()

const emit = defineEmits<{ changed: [] }>()

const tenant = useTenantStore()
const toast = useToast()
const confirm = useConfirm()

const machineById = computed(() => new Map(props.machines.map(machine => [machine.id, machine])))
const stateOf = (row: CommandeMachine) => machineById.value.get(row.machine_id)?.etat_operationnel ?? null

const cycle = useMachineCycle(() => emit('changed'))

// --- Lignes de la commande : seules les lignes en cours comptent --------------------------------

/** Lignes encore actives : ni terminées ni déchargées (une ancienne ligne active ne compte plus). */
const activeRows = computed(() => props.commande.machines.filter(row => row.actif && !row.fin_reelle && !row.dechargee_le))
const pastRows = computed(() => props.commande.machines.filter(row => !activeRows.value.includes(row)))

/** Lignes dont la machine est réellement liée à cette commande : seules celles-ci ont des actions. */
const linkedIds = computed(() => new Set(ligneLiee(props.commande, props.machines).map(row => row.id)))
const isLinked = (row: CommandeMachine) => linkedIds.value.has(row.id)

// --- Ce qu'il reste à affecter ---------------------------------------------------------------------

/** Étape à affecter : lavage pour une commande reçue, séchage pour une commande en attente de séchage. */
const pendingStep = computed(() => {
  // Charge restante après un cycle interrompu ou des charges successives : l'étape reste à affecter.
  if (props.commande.a_reaffecter && props.commande.etape)
    return props.commande.etape

  if (props.commande.statut === 'attente_sechage')
    return 'sechage'

  if (props.commande.statut !== 'recue')
    return null

  if (props.commande.lavage)
    return 'lavage'

  return props.commande.sechage ? 'sechage' : null
})

// --- Recommandation --------------------------------------------------------------------------------

const recommendation = ref<Recommandation | null>(null)
const searching = ref(false)
const searchError = ref('')

/** Pourquoi la recommandation vient d'être relancée : une machine prise, ou du linge lavé à sécher. */
const relaunch = ref<'taken' | null>(null)

/** Message affiché après un refus de réservation (machines devenues indisponibles). */
const assignNotice = ref('')

let controller: AbortController | null = null

async function search(taken = false) {
  if (!tenant.currentId || searching.value)
    return

  controller?.abort()

  const current = new AbortController()

  controller = current
  searching.value = true
  searchError.value = ''

  try {
    const result = await pressingApi.recommandation(tenant.currentId, props.commande.id, current.signal)

    if (!current.signal.aborted) {
      recommendation.value = result
      relaunch.value = taken ? 'taken' : null
    }
  }
  catch (cause) {
    if (!current.signal.aborted)
      searchError.value = pressingError(cause)
  }
  finally {
    if (controller === current)
      searching.value = false
  }
}

onScopeDispose(() => controller?.abort())

onMounted(() => {
  if (props.autoSearch && pendingStep.value)
    search()
})

// Changement d'étape : l'ancienne recommandation n'a plus de sens. Après un lavage terminé avec
// séchage demandé, la recommandation du sèche-linge est relancée seule.
watch(() => `${props.commande.statut}|${props.commande.a_reaffecter}`, () => {
  recommendation.value = null
  relaunch.value = null
  assignNotice.value = ''

  if (props.commande.statut === 'attente_sechage')
    search()
})

const stepLabel = computed(() => {
  const etape = recommendation.value?.etape ?? pendingStep.value

  return etape ? ETAPE_LABELS[etape] : ''
})

const waitBlocked = (option: OptionAffectation) => option.machines.some(machine => machine.attente_min > 0)

const OPTION_TITLE: Record<OptionAffectation['type'], string> = {
  machine_unique: 'Une seule machine',
  repartition: 'Répartition sur plusieurs machines',
  partielle: 'Charges successives',
}

/** Heure de libération la plus proche parmi les machines de la catégorie concernée. */
const nextRelease = computed(() => {
  const category = recommendation.value?.etape === 'sechage' ? 'seche_linge' : 'lave_linge'

  const times = props.machines
    .filter(machine => machine.categorie === category && machine.fin_estimee && new Date(machine.fin_estimee).getTime() > Date.now())
    .map(machine => machine.fin_estimee as string)
    .sort()

  return times[0] ?? null
})

// --- Réservation ---------------------------------------------------------------------------------

/** Réserve exactement les machines de l'option affichée (identifiants et programmes). */
/** Machines libres de la bonne catégorie, avec le programme le plus court compatible avec le linge. */
const freeOptions = computed(() => {
  const category = pendingStep.value === 'sechage' ? 'seche_linge' : 'lave_linge'

  return props.machines
    .filter(machine => machine.actif && machine.categorie === category && machine.etat_operationnel === 'libre')
    .flatMap(machine => {
      const compatibles = machine.programmes
        .filter(item => programmeCompatible(item.types_linge, props.commande.types_linge))
        .sort((a, b) => a.duree_min - b.duree_min)

      return compatibles[0] ? [{ machine, programme: compatibles[0].nom }] : []
    })
    .sort((a, b) => a.machine.nom.localeCompare(b.machine.nom, 'fr', { numeric: true }))
})

const manualOpen = ref(false)

const manualAssigning = useSubmit(async (machineId: string, programme: string) => {
  if (!tenant.currentId)
    throw new Error('no tenant')

  return pressingApi.affecter(tenant.currentId, props.commande.id, {
    machine_ids: [machineId],
    programmes: { [machineId]: programme },
    accepter_partiel: false,
  })
})

async function assignManual(item: { machine: Machine; programme: string }) {
  const accepted = await confirm({
    title: `Réserver ${item.machine.nom} pour ${props.commande.numero} ?`,
    text: `La machine sera réservée pour le ${stepLabel.value.toLowerCase()} avec le programme « ${item.programme} ». Le cycle ne démarre qu'à votre signal.`,
    confirmLabel: 'Réserver',
  })

  if (!accepted)
    return

  if (await manualAssigning.submit(item.machine.id, item.programme)) {
    toast.success(`Machine réservée pour ${props.commande.numero} : ${item.machine.nom}.`)
    manualOpen.value = false
    recommendation.value = null
    emit('changed')
  }
}

const assigning = useSubmit(async (option: OptionAffectation) => {
  if (!tenant.currentId)
    throw new Error('no tenant')

  return pressingApi.affecter(tenant.currentId, props.commande.id, {
    machine_ids: option.machines.map(machine => machine.machine_id),
    programmes: Object.fromEntries(option.machines.map(machine => [machine.machine_id, machine.programme])),

    // Une option « charges successives » remplit chaque machine à sa capacité : le reste reste à affecter.
    accepter_partiel: option.type === 'partielle',
  })
})

async function assign(option: OptionAffectation) {
  const names = option.machines.map(machine => machine.nom)
  const count = names.length

  const accepted = await confirm({
    title: `Réserver ${count > 1 ? `${count} machines` : 'cette machine'} pour ${props.commande.numero} ?`,
    text: `${names.join(', ')} ${count > 1 ? 'seront réservées' : 'sera réservée'} pour le ${stepLabel.value.toLowerCase()}. Le cycle ne démarre qu'à votre signal.`,
    confirmLabel: 'Réserver',
  })

  if (!accepted)
    return

  assignNotice.value = ''

  if (await assigning.submit(option)) {
    toast.success(`${count > 1 ? 'Machines réservées' : 'Machine réservée'} pour ${props.commande.numero} : ${names.join(', ')}.`)
    recommendation.value = null
    emit('changed')

    return
  }

  const failure = assigning.error.value

  // Machine prise entre-temps : on regarde l'état réel, on nomme les machines indisponibles, puis on relance.
  if (isApiError(failure) && failure.status === 409 && tenant.currentId) {
    const fresh = await pressingApi.machines(tenant.currentId, {}).catch(() => null)
    const etats = new Map((fresh ?? []).map(machine => [machine.id, machine.etat_operationnel]))
    const indisponibles = option.machines.filter(machine => (etats.get(machine.machine_id) ?? 'libre') !== 'libre').map(machine => machine.nom)

    assignNotice.value = indisponibles.length
      ? `${indisponibles.join(', ')} ${indisponibles.length > 1 ? 'ne sont plus disponibles' : 'n\'est plus disponible'}. Voici une nouvelle recommandation.`
      : `${pressingError(failure)} Voici une nouvelle recommandation.`

    emit('changed')
    await search(true)

    return
  }

  assignNotice.value = pressingError(failure)
}

// --- Démarrage d'un cycle ------------------------------------------------------------------------

const startRow = ref<CommandeMachine | null>(null)
const startOpen = ref(false)
const program = ref('')

const startMachine = computed(() => startRow.value ? machineById.value.get(startRow.value.machine_id) ?? null : null)

/** Seuls les programmes qui conviennent au linge de la commande sont proposés. */
const programItems = computed(() => (startMachine.value?.programmes ?? [])
  .filter(item => programmeCompatible(item.types_linge, props.commande.types_linge))
  .map(item => ({
    value: item.nom,
    title: `${item.nom} · ${formatMinutes(item.duree_min)}${item.intervention_humaine ? ' · intervention requise' : ''}`,
  })))

function openStart(row: CommandeMachine) {
  startRow.value = row

  const choices = (machineById.value.get(row.machine_id)?.programmes ?? [])
    .filter(item => programmeCompatible(item.types_linge, props.commande.types_linge))
    .map(item => item.nom)

  program.value = row.programme && choices.includes(row.programme) ? row.programme : (choices[0] ?? '')
  startOpen.value = true
}

const starting = useSubmit(async () => {
  if (!tenant.currentId || !startRow.value)
    throw new Error('no machine')

  return pressingApi.startCycle(tenant.currentId, startRow.value.machine_id, props.commande.id, program.value)
})

/** Le dialogue sert de confirmation : pas de deuxième question. */
async function start() {
  const name = startRow.value?.machine_nom ?? 'la machine'

  if (await starting.submit()) {
    toast.success(`Le cycle démarre sur ${name}.`)
    startOpen.value = false
    emit('changed')

    return
  }

  // Refus du serveur (machine plus libre, programme incompatible...) : on ferme, on affiche le motif, on relit l'écran.
  startOpen.value = false
  toast.error(pressingError(starting.error.value))
  emit('changed')
}

const programRules = [(value: string) => !!value || 'Choisissez un programme.']

// --- Interruption (panne en cours de cycle) -----------------------------------------------------

const interruptRow = ref<CommandeMachine | null>(null)
const interruptOpen = ref(false)
const motifPanne = ref('')

const interrupting = useSubmit(async () => {
  if (!tenant.currentId || !interruptRow.value)
    throw new Error('no machine')

  return pressingApi.interrompre(tenant.currentId, interruptRow.value.machine_id, motifPanne.value.trim())
})

function openInterrupt(row: CommandeMachine) {
  interruptRow.value = row
  motifPanne.value = ''
  interrupting.reset()
  interruptOpen.value = true
}

async function interrupt() {
  const name = interruptRow.value?.machine_nom ?? 'la machine'

  if (await interrupting.submit()) {
    toast.success(`Le cycle de ${name} est interrompu.`)
    interruptOpen.value = false
    emit('changed')
  }
}

const motifRules = [(value: string) => value.trim().length >= 3 || 'Indiquez le motif de la panne (3 caractères au moins).']

// --- Cycles : libellés et cibles ----------------------------------------------------------------

const targetOf = (row: CommandeMachine) => {
  const machine = machineById.value.get(row.machine_id)

  return machine ? toTarget(machine) : { id: row.machine_id, nom: row.machine_nom ?? 'la machine', etat: 'libre' as const }
}

const iconOf = (row: CommandeMachine) => CATEGORY_INFO[row.etape === 'sechage' ? 'seche_linge' : 'lave_linge'].icon

const weightText = computed(() => props.commande.poids_grams ? `${(props.commande.poids_grams / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 3 })} kg` : 'cette commande')
</script>

<template>
  <div>
    <!-- Machines en cours sur la commande -->
    <div
      v-if="activeRows.length"
      class="d-flex flex-column gap-3 mb-2"
      data-testid="affectation-machines"
    >
      <div
        v-for="row in activeRows"
        :key="row.id"
        class="row-card pa-4"
      >
        <div class="d-flex flex-wrap align-center gap-3">
          <VAvatar
            :color="stateOf(row) ? STATE_INFO[stateOf(row)!].color : 'secondary'"
            variant="tonal"
            rounded
          >
            <VIcon :icon="iconOf(row)" />
          </VAvatar>
          <div class="min-w-0 flex-grow-1">
            <div class="text-subtitle-1 font-weight-semibold">
              {{ row.machine_nom }}
              <VChip
                size="x-small"
                label
                variant="tonal"
                class="ms-1"
              >
                {{ ETAPE_LABELS[row.etape] }}
              </VChip>
            </div>
            <div class="text-body-2 text-medium-emphasis">
              {{ formatCapacity(row.charge_kg) }}<template v-if="row.programme">
                · {{ row.programme }}
              </template><template v-if="row.duree_min">
                · {{ formatMinutes(row.duree_min) }}
              </template>
              <template v-if="row.debut_reel">
                · démarré à {{ formatHeure(row.debut_reel) }}
              </template>
              <template v-else-if="row.debut_prevu">
                · début prévu à {{ formatHeure(row.debut_prevu) }}
              </template>
            </div>
          </div>
          <MachineStateChip
            v-if="stateOf(row)"
            :state="stateOf(row)!"
          />
        </div>

        <p
          v-if="!isLinked(row)"
          class="text-body-2 text-warning mt-3 mb-0"
          data-testid="affectation-non-liee"
        >
          Cette machine n'est plus réservée pour cette commande : elle est utilisée ailleurs. Aucune action n'est proposée ici.
        </p>

        <div
          v-else
          class="d-flex flex-wrap gap-2 mt-3"
        >
          <VBtn
            v-if="stateOf(row) === 'reservee'"
            size="large"
            class="action-btn"
            prepend-icon="ri-play-circle-line"
            data-testid="cycle-start"
            @click="openStart(row)"
          >
            Démarrer le cycle
          </VBtn>
          <VBtn
            v-else-if="stateOf(row) === 'en_cycle'"
            size="large"
            class="action-btn"
            variant="tonal"
            prepend-icon="ri-check-double-line"
            :loading="cycle.busy.value.has(row.machine_id)"
            data-testid="cycle-finish"
            @click="cycle.finish(targetOf(row))"
          >
            Terminer le cycle
          </VBtn>
          <VBtn
            v-if="stateOf(row) === 'en_cycle'"
            size="large"
            class="action-btn"
            variant="outlined"
            color="error"
            prepend-icon="ri-pause-circle-line"
            data-testid="cycle-interrupt"
            @click="openInterrupt(row)"
          >
            Déclarer une panne
          </VBtn>
          <VBtn
            v-if="stateOf(row) === 'cycle_termine' || stateOf(row) === 'attente_dechargement'"
            size="large"
            class="action-btn"
            variant="tonal"
            color="warning"
            prepend-icon="ri-inbox-unarchive-line"
            :loading="cycle.busy.value.has(row.machine_id)"
            data-testid="cycle-unload"
            @click="cycle.unload(targetOf(row))"
          >
            {{ unloadLabel(stateOf(row)!) }}
          </VBtn>
        </div>
      </div>
    </div>

    <div
      v-if="pastRows.length"
      class="text-body-2 text-medium-emphasis mb-3"
    >
      <div
        v-for="row in pastRows"
        :key="row.id"
      >
        <VIcon
          icon="ri-check-line"
          size="16"
          class="me-1"
        />{{ ETAPE_LABELS[row.etape] }} : {{ row.machine_nom }}
        <template v-if="row.duree_min">
          · {{ formatMinutes(row.duree_min) }} prévues
        </template>
        <template v-if="row.fin_reelle">
          · terminé à {{ formatHeure(row.fin_reelle) }}
        </template>
        <template v-if="row.dechargee_le">
          · déchargé à {{ formatHeure(row.dechargee_le) }}
        </template>
      </div>
    </div>

    <!-- Linge lavé : le séchage est à choisir -->
    <VAlert
      v-if="commande.statut === 'attente_sechage'"
      type="warning"
      variant="tonal"
      icon="ri-temp-hot-line"
      class="mb-3"
      data-testid="affectation-sechage-banner"
    >
      <div class="font-weight-semibold mb-2">
        Linge lavé : choisir le sèche-linge
      </div>
      <VBtn
        size="large"
        class="action-btn"
        prepend-icon="ri-magic-line"
        :loading="searching"
        data-testid="affectation-sechage-search"
        @click="search"
      >
        Chercher le sèche-linge
      </VBtn>
    </VAlert>

    <!-- Recherche de machines -->
    <template v-if="pendingStep">
      <div
        v-if="!recommendation"
        class="search-box pa-5 text-center"
      >
        <VAvatar
          color="primary"
          variant="tonal"
          size="56"
          class="mb-3"
        >
          <VIcon
            icon="ri-magic-line"
            size="30"
          />
        </VAvatar>
        <div class="text-h6">
          {{ pendingStep === 'sechage' ? 'Choisir un sèche-linge' : 'Choisir les machines' }}
        </div>
        <p
          v-if="commande.a_reaffecter && commande.charge_restante_kg"
          class="text-body-2 font-weight-medium mb-2"
          data-testid="affectation-reste"
        >
          Il reste {{ formatKgValue(commande.charge_restante_kg) }} à affecter.
        </p>
        <p class="text-body-2 text-medium-emphasis mx-auto mb-4 search-box__text">
          Marinade compare les machines libres selon la charge de {{ weightText }}, les programmes compatibles avec le linge et la durée.
        </p>
        <VBtn
          size="large"
          class="action-btn"
          prepend-icon="ri-search-eye-line"
          :loading="searching"
          data-testid="affectation-search"
          @click="search"
        >
          {{ commande.a_reaffecter ? 'Affecter le reste' : 'Chercher la meilleure machine' }}
        </VBtn>
        <VAlert
          v-if="searchError"
          type="error"
          variant="tonal"
          class="mt-4 text-start"
        >
          {{ searchError }}
        </VAlert>
      </div>

      <template v-else>
        <div class="d-flex flex-wrap align-center justify-space-between gap-3 mb-3">
          <div class="text-subtitle-1 font-weight-medium">
            Recherche pour le {{ stepLabel.toLowerCase() }}
          </div>
          <VBtn
            size="small"
            variant="text"
            prepend-icon="ri-refresh-line"
            :loading="searching"
            @click="search"
          >
            Relancer la recherche
          </VBtn>
        </div>

        <VAlert
          v-if="assignNotice"
          type="warning"
          variant="tonal"
          class="mb-3"
          data-testid="affectation-notice"
          closable
          @click:close="assignNotice = ''"
        >
          {{ assignNotice }}
        </VAlert>
        <VAlert
          v-else-if="relaunch === 'taken'"
          type="info"
          variant="tonal"
          class="mb-3"
        >
          Une machine a été prise entre-temps. Voici une nouvelle recommandation à jour.
        </VAlert>
        <VAlert
          v-if="searchError"
          type="error"
          variant="tonal"
          class="mb-3"
        >
          {{ searchError }}
        </VAlert>

        <!-- Aucune option -->
        <div
          v-if="!recommendation.faisable"
          data-testid="affectation-infaisable"
        >
          <VAlert
            :type="recommendation.action_conseillee === 'attendre' ? 'warning' : 'error'"
            variant="tonal"
            :icon="recommendation.action_conseillee === 'attendre' ? 'ri-hourglass-line' : 'ri-user-star-line'"
          >
            <div class="font-weight-semibold mb-1">
              {{ recommendation.action_conseillee === 'attendre' ? 'Attendre une machine' : 'Décision du responsable' }}
            </div>
            <div>{{ recommendation.motif_si_non_faisable }}</div>
            <div
              v-if="recommendation.action_conseillee === 'attendre'"
              class="mt-2"
            >
              <template v-if="nextRelease">
                Une machine de cette catégorie se libère vers <strong>{{ formatHeure(nextRelease) }}</strong> ({{ formatDateHeure(nextRelease) }}).
              </template>
              <template v-else>
                Aucune heure de libération n'est connue pour l'instant : relancez la recherche plus tard.
              </template>
            </div>
            <div
              v-else
              class="mt-2"
            >
              La commande ne peut pas être traitée telle quelle : le responsable doit décider (diviser le linge, réparer une machine ou refuser la commande).
            </div>
          </VAlert>
        </div>

        <!-- Options comparables -->
        <div
          v-else
          class="options"
          data-testid="affectation-options"
        >
          <div
            v-for="(option, index) in recommendation.options"
            :key="index"
            class="option pa-4"
            :class="{ 'option--best': index === 0 }"
          >
            <div class="d-flex flex-wrap align-center gap-2 mb-3">
              <VChip
                v-if="index === 0"
                color="primary"
                size="small"
                label
                variant="flat"
                prepend-icon="ri-medal-line"
              >
                Recommandée
              </VChip>
              <VChip
                v-else
                size="small"
                label
                variant="tonal"
              >
                Option {{ index + 1 }}
              </VChip>
              <span class="text-subtitle-1 font-weight-semibold">{{ OPTION_TITLE[option.type] }}</span>
            </div>

            <div class="d-flex flex-column gap-3">
              <div
                v-for="machine in option.machines"
                :key="machine.machine_id"
                class="machine-line"
              >
                <div class="d-flex flex-wrap align-center gap-2">
                  <span class="font-weight-semibold">{{ machine.nom }}</span>
                  <VIcon
                    v-if="machine.intervention_humaine"
                    icon="ri-user-settings-line"
                    size="18"
                    color="warning"
                    aria-label="Intervention humaine requise"
                  >
                    <VTooltip
                      activator="parent"
                      location="top"
                    >
                      Un opérateur doit intervenir pendant le cycle.
                    </VTooltip>
                  </VIcon>
                </div>
                <dl class="facts">
                  <div>
                    <dt>Charge</dt>
                    <dd>{{ formatCapacity(machine.charge_kg) }}</dd>
                  </div>
                  <div>
                    <dt>Programme</dt>
                    <dd>{{ machine.programme }}</dd>
                  </div>
                  <div>
                    <dt>Durée</dt>
                    <dd>{{ formatMinutes(machine.duree_min) }}</dd>
                  </div>
                  <div>
                    <dt>Début prévu</dt>
                    <dd>{{ formatHeure(machine.debut_prevu) }}</dd>
                  </div>
                  <div>
                    <dt>Attente</dt>
                    <dd :class="{ 'text-warning': machine.attente_min > 0 }">
                      {{ machine.attente_min > 0 ? formatMinutes(machine.attente_min) : 'Aucune' }}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>

            <ul
              v-if="option.raisons.length"
              class="bullets bullets--good mt-3"
            >
              <li
                v-for="reason in option.raisons"
                :key="reason"
              >
                <VIcon
                  icon="ri-checkbox-circle-fill"
                  size="16"
                />{{ reason }}
              </li>
            </ul>
            <ul
              v-if="option.avertissements.length"
              class="bullets bullets--warn mt-2"
            >
              <li
                v-for="warning in option.avertissements"
                :key="warning"
              >
                <VIcon
                  icon="ri-alert-fill"
                  size="16"
                />{{ warning }}
              </li>
            </ul>

            <VBtn
              block
              size="large"
              class="mt-4 action-btn"
              :variant="index === 0 ? 'flat' : 'outlined'"
              prepend-icon="ri-bookmark-line"
              :disabled="waitBlocked(option)"
              :loading="assigning.pending.value"
              data-testid="affectation-assign"
              @click="assign(option)"
            >
              Affecter cette option
            </VBtn>
            <p
              v-if="waitBlocked(option)"
              class="text-caption text-medium-emphasis mt-2 mb-0"
            >
              Une machine de cette option est encore occupée : elle ne peut pas être réservée avant sa libération.
            </p>
          </div>
        </div>

        <!-- Machines écartées -->
        <VExpansionPanels
          v-if="recommendation.machines_exclues?.length"
          variant="accordion"
          class="mt-4"
        >
          <VExpansionPanel>
            <VExpansionPanelTitle>
              <VIcon
                icon="ri-forbid-2-line"
                class="me-2"
              />
              {{ recommendation.machines_exclues.length }} machine{{ recommendation.machines_exclues.length > 1 ? 's' : '' }} écartée{{ recommendation.machines_exclues.length > 1 ? 's' : '' }}
            </VExpansionPanelTitle>
            <VExpansionPanelText>
              <ul class="excluded">
                <li
                  v-for="machine in recommendation.machines_exclues"
                  :key="machine.machine_id"
                >
                  <strong>{{ machine.nom }}</strong> : {{ machine.raison }}
                </li>
              </ul>
            </VExpansionPanelText>
          </VExpansionPanel>
        </VExpansionPanels>
      </template>
    </template>

    <div
      v-if="pendingStep && freeOptions.length"
      class="mt-4"
      data-testid="affectation-manual"
    >
      <VBtn
        variant="outlined"
        size="large"
        class="action-btn"
        prepend-icon="ri-list-check"
        :aria-expanded="manualOpen"
        data-testid="affectation-manual-toggle"
        @click="manualOpen = !manualOpen"
      >
        {{ manualOpen ? 'Masquer les machines libres' : 'Choisir une autre machine' }}
      </VBtn>
      <div
        v-if="manualOpen"
        class="d-flex flex-column gap-2 mt-3"
      >
        <VAlert
          v-if="manualAssigning.message.value"
          type="error"
          variant="tonal"
        >
          {{ manualAssigning.message.value }}
        </VAlert>
        <div
          v-for="item in freeOptions"
          :key="item.machine.id"
          class="row-card pa-3 d-flex flex-wrap align-center gap-3"
        >
          <div class="min-w-0 flex-grow-1">
            <div class="font-weight-semibold">
              {{ item.machine.nom }}
            </div>
            <div class="text-body-2 text-medium-emphasis">
              {{ formatCapacity(item.machine.capacite_kg) }} · {{ item.programme }}
            </div>
          </div>
          <VBtn
            size="large"
            class="action-btn"
            variant="tonal"
            prepend-icon="ri-bookmark-line"
            :loading="manualAssigning.pending.value"
            :data-testid="`affectation-manual-${item.machine.id}`"
            @click="assignManual(item)"
          >
            Réserver
          </VBtn>
        </div>
      </div>
    </div>

    <p
      v-else-if="!activeRows.length && !pastRows.length"
      class="text-body-2 text-medium-emphasis mb-0"
    >
      Cette commande ne passe pas par les machines.
    </p>

    <AppFormDialog
      v-model="startOpen"
      title="Démarrer le cycle"
      :subtitle="startRow ? `${startRow.machine_nom} · commande ${commande.numero}` : undefined"
      icon="ri-play-circle-line"
      submit-label="Démarrer le cycle"
      :loading="starting.pending.value"
      :error="starting.message.value"
      :confirm="false"
      @submit="start"
    >
      <VSelect
        v-model="program"
        :items="programItems"
        label="Programme"
        prepend-inner-icon="ri-settings-4-line"
        :rules="programRules"
        no-data-text="Aucun programme de cette machine ne convient à ce linge."
        data-testid="cycle-program"
      />
      <p class="text-body-2 text-medium-emphasis mb-0 mt-2">
        Seuls les programmes compatibles avec les types de linge de la commande sont proposés. L'heure de début est enregistrée au démarrage.
      </p>
    </AppFormDialog>

    <AppFormDialog
      v-model="interruptOpen"
      title="Déclarer une panne"
      :subtitle="interruptRow ? `${interruptRow.machine_nom} · commande ${commande.numero}` : undefined"
      icon="ri-pause-circle-line"
      submit-label="Interrompre le cycle"
      danger
      :loading="interrupting.pending.value"
      :error="interrupting.error.value ? pressingError(interrupting.error.value) : ''"
      :confirm="false"
      @submit="interrupt"
    >
      <VTextarea
        v-model="motifPanne"
        label="Motif de la panne ou de l'interruption"
        prepend-inner-icon="ri-chat-1-line"
        placeholder="Porte mal fermée, coupure d'eau, erreur de programme..."
        rows="2"
        auto-grow
        counter="500"
        maxlength="500"
        :rules="motifRules"
        data-testid="interrupt-motif"
      />
      <p class="text-body-2 text-medium-emphasis mb-0 mt-2">
        Le cycle s'arrête ici. Le linge est à décharger, puis la charge peut être réaffectée à une autre machine.
      </p>
    </AppFormDialog>
  </div>
</template>

<style scoped>
.row-card,
.option,
.search-box {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 14px;
}

/* Cibles tactiles : au moins 48 px de haut pour les actions de la chaîne. */
.action-btn {
  min-block-size: 48px;
}

.search-box {
  border-style: dashed;
  background: rgba(var(--v-theme-primary), 0.04);
}

.search-box__text {
  max-inline-size: 30rem;
}

.options {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 19rem), 1fr));
  gap: 16px;
  align-items: stretch;
}

.option {
  display: flex;
  flex-direction: column;
}

.option > .v-btn {
  margin-block-start: auto;
}

.option--best {
  border: 2px solid rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.05);
}

.machine-line + .machine-line {
  padding-block-start: 12px;
  border-block-start: 1px dashed rgba(var(--v-border-color), var(--v-border-opacity));
}

.facts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(6.5rem, 1fr));
  gap: 8px 12px;
  margin-block-start: 6px;
}

.facts dt {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.75rem;
}

.facts dd {
  font-size: 0.9375rem;
  font-weight: 500;
  margin: 0;
}

.bullets {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 0;
  list-style: none;
}

.bullets li {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  font-size: 0.875rem;
}

.bullets .v-icon {
  flex: 0 0 auto;
  margin-block-start: 3px;
}

.bullets--good .v-icon {
  color: rgb(var(--v-theme-success));
}

.bullets--warn .v-icon {
  color: rgb(var(--v-theme-warning));
}

.excluded {
  padding-inline-start: 1.25rem;
}
</style>
