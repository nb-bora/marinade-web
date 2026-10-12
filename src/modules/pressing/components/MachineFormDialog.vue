<!--
  Création et modification d'une machine : fiche technique en cinq onglets (identité, fonctionnement,
  programmes, consommation, notes). Tous les onglets sont rendus pour que la validation les couvre ;
  un point rouge signale un onglet à compléter.
-->
<script setup lang="ts">
import { pressingApi } from '../api'
import { CATEGORY_INFO, CATEGORY_OPTIONS, MODE_INFO, MODE_OPTIONS, pressingError } from '../labels'
import { toDrafts, toProgrammes } from '../programDrafts'
import type { ProgramDraft } from '../programDrafts'
import type { Machine, MachineCategory, MachineMode, MachineWrite, Zone } from '../types'
import ProgramEditor from './ProgramEditor.vue'
import { useSubmit } from '@/composables/useSubmit'
import { useTenantStore } from '@/stores/tenant.store'
import { useToast } from '@/stores/toast.store'

const props = defineProps<{
  machine: Machine | null
  zones: Zone[]

  /** Catégorie proposée à la création (le plan peut ouvrir le formulaire directement sur un sèche-linge). */
  defaultCategory?: MachineCategory
}>()

const emit = defineEmits<{ saved: [machine: Machine] }>()
const open = defineModel<boolean>({ required: true })

const tenant = useTenantStore()
const toast = useToast()

type TabId = 'identite' | 'fonctionnement' | 'programmes' | 'consommation' | 'notes'

const TABS: Array<{ id: TabId; title: string; icon: string }> = [
  { id: 'identite', title: 'Identité', icon: 'ri-profile-line' },
  { id: 'fonctionnement', title: 'Fonctionnement', icon: 'ri-settings-3-line' },
  { id: 'programmes', title: 'Programmes', icon: 'ri-list-check-2' },
  { id: 'consommation', title: 'Consommation', icon: 'ri-flashlight-line' },
  { id: 'notes', title: 'Notes', icon: 'ri-sticky-note-line' },
]

const tab = ref<TabId>('identite')
const touched = ref(false)

const nom = ref('')
const categorie = ref<MachineCategory>('lave_linge')
const marque = ref('')
const modele = ref('')
const numeroSerie = ref('')
const mode = ref<MachineMode>('automatique')
const capacite = ref('')
const miseEnService = ref('')
const zoneId = ref<string | null>(null)
const positionX = ref('')
const positionY = ref('')
const programmes = ref<ProgramDraft[]>([])
const kwh = ref('')
const eau = ref('')
const remarques = ref('')
const contraintes = ref('')

const isEdit = computed(() => props.machine !== null)

const zoneItems = computed(() => [
  { title: 'Aucune zone', value: null },
  ...props.zones.map(zone => ({ title: zone.nom, value: zone.id })),
])

// --- Règles --------------------------------------------------------------------------------------

const decimal = (value: string) => value.trim().replace(',', '.')

const nomRules = [(value: string) => (value.trim().length >= 1 && value.trim().length <= 120) || 'Donnez un nom à la machine, de 1 à 120 caractères.']

const capaciteRule = (value: string) => {
  const text = decimal(value)

  if (!/^\d{1,3}(?:\.\d{1,2})?$/.test(text))
    return 'Saisissez la capacité en kilos avec deux décimales au plus, par exemple 8 ou 8,5.'

  const number = Number(text)

  return (number > 0 && number <= 200) || 'La capacité doit être comprise entre 0,01 et 200 kg.'
}

const optionalDecimal = (max: number, decimals: number, unit: string) => (value: string) => {
  const text = decimal(value)

  if (text === '')
    return true

  const pattern = new RegExp(`^\\d{1,6}(?:\\.\\d{1,${decimals}})?$`)

  return (pattern.test(text) && Number(text) <= max) || `Saisissez un nombre positif en ${unit}, avec ${decimals} décimales au plus.`
}

const kwhRule = optionalDecimal(100000, 3, 'kWh par cycle')
const eauRule = optionalDecimal(100000, 2, 'litres par cycle')

const percentRule = (value: string) => {
  const text = decimal(value)

  return text === '' || (/^\d{1,3}(?:\.\d{1,2})?$/.test(text) && Number(text) <= 100) || 'Saisissez un pourcentage entre 0 et 100.'
}

const lengthRule = (max: number) => (value: string) => value.length <= max || `${max} caractères au plus.`

const modeConflict = computed(() => mode.value !== 'semi_automatique' && programmes.value.some(program => program.humaine))

// --- Onglets à compléter ----------------------------------------------------------------------------

const programmeIssue = computed(() => {
  if (categorie.value === 'seche_linge' && programmes.value.length === 0)
    return true

  if (modeConflict.value)
    return true

  return programmes.value.some(program => {
    const duree = Number(program.duree)

    return program.nom.trim() === '' || !/^\d+$/.test(program.duree.trim()) || duree < 1 || duree > 720
      || program.etapes.some(step => step.nom.trim() === '' || !/^\d+$/.test(step.duree.trim()) || Number(step.duree) < 1 || Number(step.duree) > 720)
  })
})

const issues = computed<Record<TabId, boolean>>(() => ({
  identite: nomRules[0](nom.value) !== true,
  fonctionnement: capaciteRule(capacite.value) !== true || percentRule(positionX.value) !== true || percentRule(positionY.value) !== true || modeConflict.value,
  programmes: programmeIssue.value,
  consommation: kwhRule(kwh.value) !== true || eauRule(eau.value) !== true,
  notes: remarques.value.length > 1000 || contraintes.value.length > 1000,
}))

// --- Envoi -----------------------------------------------------------------------------------------

const orNull = (value: string) => value.trim() || null

const { submit, pending, error, apiError, reset } = useSubmit(async () => {
  const restaurantId = tenant.currentId

  if (!restaurantId)
    return

  const body: MachineWrite = {
    nom: nom.value.trim(),
    categorie: categorie.value,
    marque: orNull(marque.value),
    modele: orNull(modele.value),
    numero_serie: orNull(numeroSerie.value),
    type_fonctionnement: mode.value,
    capacite_kg: decimal(capacite.value),
    programmes: toProgrammes(programmes.value),
    zone_id: zoneId.value,
    position_x: positionX.value.trim() ? Number(decimal(positionX.value)) : null,
    position_y: positionY.value.trim() ? Number(decimal(positionY.value)) : null,
    conso_electrique_kwh_cycle: kwh.value.trim() ? decimal(kwh.value) : null,
    conso_eau_litres_cycle: eau.value.trim() ? decimal(eau.value) : null,
    date_mise_en_service: miseEnService.value || null,
    remarques: orNull(remarques.value),
    contraintes: orNull(contraintes.value),
  }

  const saved = props.machine
    ? await pressingApi.updateMachine(restaurantId, props.machine.id, body)
    : await pressingApi.createMachine(restaurantId, body)

  toast.success(isEdit.value ? `« ${saved.nom} » est modifiée.` : `« ${saved.nom} » est ajoutée au parc.`)
  open.value = false
  emit('saved', saved)
})

// Un nom déjà pris (409) s'affiche sous le champ, les autres refus dans le bandeau du bas.
const nameError = computed(() => apiError.value?.kind === 'conflict' ? pressingError(error.value) : apiError.value?.fieldMessage('nom'))
const capacityError = computed(() => apiError.value?.fieldMessage('capacite_kg'))
const globalError = computed(() => error.value && !nameError.value ? pressingError(error.value) : '')

watch(nom, () => {
  if (apiError.value?.kind === 'conflict')
    reset()
})

// --- Ouverture ------------------------------------------------------------------------------------

watch(open, isOpen => {
  if (!isOpen)
    return

  reset()

  const machine = props.machine

  tab.value = 'identite'
  nom.value = machine?.nom ?? ''
  categorie.value = machine?.categorie ?? props.defaultCategory ?? 'lave_linge'
  marque.value = machine?.marque ?? ''
  modele.value = machine?.modele ?? ''
  numeroSerie.value = machine?.numero_serie ?? ''
  mode.value = machine?.type_fonctionnement ?? 'automatique'
  capacite.value = machine ? String(Number(machine.capacite_kg)).replace('.', ',') : ''
  miseEnService.value = machine?.date_mise_en_service ?? ''
  zoneId.value = machine?.zone_id ?? null
  positionX.value = machine?.position_x != null ? String(machine.position_x).replace('.', ',') : ''
  positionY.value = machine?.position_y != null ? String(machine.position_y).replace('.', ',') : ''
  programmes.value = machine ? toDrafts(machine.programmes) : []
  kwh.value = machine?.conso_electrique_kwh_cycle ? String(Number(machine.conso_electrique_kwh_cycle)).replace('.', ',') : ''
  eau.value = machine?.conso_eau_litres_cycle ? String(Number(machine.conso_eau_litres_cycle)).replace('.', ',') : ''
  remarques.value = machine?.remarques ?? ''
  contraintes.value = machine?.contraintes ?? ''

  touched.value = false
  nextTick(() => {
    touched.value = false
  })
})

// Les points rouges n'apparaissent qu'une fois la saisie commencée.
watch([nom, categorie, mode, capacite, positionX, positionY, kwh, eau, remarques, contraintes, programmes], () => {
  touched.value = true
}, { deep: true, flush: 'post' })

const hint = computed(() => MODE_INFO[mode.value].hint)
</script>

<template>
  <AppFormDialog
    v-model="open"
    :title="isEdit ? `Modifier ${machine?.nom ?? 'la machine'}` : 'Nouvelle machine'"
    :subtitle="isEdit ? undefined : 'La fiche technique d\'un lave-linge ou d\'un sèche-linge du pressing.'"
    :submit-label="isEdit ? 'Enregistrer' : 'Créer'"
    :confirm-title="isEdit ? 'Enregistrer les modifications ?' : 'Ajouter cette machine ?'"
    :confirm-text="isEdit ? `La fiche de « ${nom.trim()} » sera mise à jour.` : `« ${nom.trim()} » sera ajoutée au parc, libre et active.`"
    icon="ri-t-shirt-air-line"
    :loading="pending"
    :error="globalError"
    :max-width="900"
    @submit="submit"
  >
    <VTabs
      v-model="tab"
      show-arrows
      class="machine-tabs mb-5"
    >
      <VTab
        v-for="item in TABS"
        :key="item.id"
        :value="item.id"
        :prepend-icon="item.icon"
      >
        {{ item.title }}
        <VBadge
          v-if="touched && issues[item.id]"
          dot
          color="error"
          inline
          class="ms-1"
          aria-label="À compléter"
        />
      </VTab>
    </VTabs>

    <VWindow
      v-model="tab"
      :touch="false"
    >
      <!-- Identité -->
      <VWindowItem
        value="identite"
        eager
      >
        <VRow>
          <VCol cols="12">
            <div class="text-subtitle-2 mb-2">
              Type de machine
            </div>
            <div
              class="d-flex flex-column flex-sm-row gap-3"
              role="radiogroup"
              aria-label="Type de machine"
            >
              <VCard
                v-for="option in CATEGORY_OPTIONS"
                :key="option.value"
                :variant="categorie === option.value ? 'tonal' : 'outlined'"
                :color="categorie === option.value ? 'primary' : undefined"
                class="pa-3 flex-grow-1 choice-card"
                role="radio"
                :aria-checked="categorie === option.value"
                tabindex="0"
                @click="categorie = option.value"
                @keydown.enter.prevent="categorie = option.value"
                @keydown.space.prevent="categorie = option.value"
              >
                <div class="d-flex align-center gap-3">
                  <VAvatar
                    :color="CATEGORY_INFO[option.value].color"
                    variant="tonal"
                    rounded
                  >
                    <VIcon :icon="CATEGORY_INFO[option.value].icon" />
                  </VAvatar>
                  <div>
                    <div class="text-subtitle-1 font-weight-semibold">
                      {{ option.title }}
                    </div>
                    <div class="text-body-2 text-medium-emphasis">
                      {{ option.value === 'lave_linge' ? 'Lave le linge : un cercle sur le plan.' : 'Sèche le linge : un carré sur le plan.' }}
                    </div>
                  </div>
                </div>
              </VCard>
            </div>
          </VCol>
          <VCol cols="12">
            <VTextField
              v-model="nom"
              label="Nom de la machine"
              prepend-inner-icon="ri-price-tag-3-line"
              placeholder="Lave-linge 1, Sèche-linge du fond..."
              :rules="nomRules"
              :error-messages="nameError"
              maxlength="120"
              data-testid="machine-nom"
            />
          </VCol>
          <VCol
            cols="12"
            sm="6"
          >
            <VTextField
              v-model="marque"
              label="Marque"
              prepend-inner-icon="ri-building-2-line"
              maxlength="120"
            />
          </VCol>
          <VCol
            cols="12"
            sm="6"
          >
            <VTextField
              v-model="modele"
              label="Modèle"
              prepend-inner-icon="ri-barcode-box-line"
              maxlength="120"
            />
          </VCol>
          <VCol cols="12">
            <VTextField
              v-model="numeroSerie"
              label="Numéro de série"
              prepend-inner-icon="ri-hashtag"
              maxlength="120"
            />
          </VCol>
        </VRow>
      </VWindowItem>

      <!-- Fonctionnement -->
      <VWindowItem
        value="fonctionnement"
        eager
      >
        <VRow>
          <VCol
            cols="12"
            sm="6"
          >
            <VSelect
              v-model="mode"
              :items="MODE_OPTIONS"
              item-value="value"
              label="Type de fonctionnement"
              prepend-inner-icon="ri-settings-3-line"
              :hint="hint"
              persistent-hint
              :error-messages="modeConflict ? 'Un programme demande une intervention humaine : choisissez semi-automatique.' : undefined"
            />
          </VCol>
          <VCol
            cols="12"
            sm="6"
          >
            <VTextField
              v-model="capacite"
              label="Capacité (kg)"
              prepend-inner-icon="ri-scales-3-line"
              inputmode="decimal"
              placeholder="8"
              suffix="kg"
              :rules="[capaciteRule]"
              :error-messages="capacityError"
              hint="Charge maximale de linge sec, de 0,01 à 200 kg."
              persistent-hint
              data-testid="machine-capacite"
            />
          </VCol>
          <VCol
            cols="12"
            sm="6"
          >
            <VTextField
              v-model="miseEnService"
              label="Date de mise en service"
              prepend-inner-icon="ri-calendar-line"
              type="date"
            />
          </VCol>
          <VCol
            cols="12"
            sm="6"
          >
            <VSelect
              v-model="zoneId"
              :items="zoneItems"
              label="Zone"
              prepend-inner-icon="ri-layout-grid-line"
              hint="La zone où la machine est installée."
              persistent-hint
            />
          </VCol>
          <VCol cols="12">
            <div class="text-subtitle-2 mb-1">
              Position sur le plan
            </div>
            <p class="text-body-2 text-medium-emphasis mb-3">
              Facultatif. Le plus simple est de placer la machine en glissant son icône sur le plan, mais vous pouvez aussi saisir sa position en pourcentage de la largeur et de la hauteur.
            </p>
          </VCol>
          <VCol
            cols="12"
            sm="6"
          >
            <VTextField
              v-model="positionX"
              label="Position horizontale (%)"
              prepend-inner-icon="ri-arrow-left-right-line"
              inputmode="decimal"
              :rules="[percentRule]"
            />
          </VCol>
          <VCol
            cols="12"
            sm="6"
          >
            <VTextField
              v-model="positionY"
              label="Position verticale (%)"
              prepend-inner-icon="ri-arrow-up-down-line"
              inputmode="decimal"
              :rules="[percentRule]"
            />
          </VCol>
        </VRow>
      </VWindowItem>

      <!-- Programmes -->
      <VWindowItem
        value="programmes"
        eager
      >
        <ProgramEditor
          v-model="programmes"
          :category="categorie"
          :mode="mode"
          @make-semi="mode = 'semi_automatique'"
        />
      </VWindowItem>

      <!-- Consommation -->
      <VWindowItem
        value="consommation"
        eager
      >
        <p class="text-body-2 text-medium-emphasis mb-4">
          Facultatif : les consommations moyennes d'un cycle, pour suivre le coût d'exploitation de la machine.
        </p>
        <VRow>
          <VCol
            cols="12"
            sm="6"
          >
            <VTextField
              v-model="kwh"
              label="Électricité par cycle (kWh)"
              prepend-inner-icon="ri-flashlight-line"
              inputmode="decimal"
              suffix="kWh"
              :rules="[kwhRule]"
            />
          </VCol>
          <VCol
            cols="12"
            sm="6"
          >
            <VTextField
              v-model="eau"
              label="Eau par cycle (litres)"
              prepend-inner-icon="ri-drop-line"
              inputmode="decimal"
              suffix="L"
              :rules="[eauRule]"
            />
          </VCol>
        </VRow>
      </VWindowItem>

      <!-- Notes -->
      <VWindowItem
        value="notes"
        eager
      >
        <VRow>
          <VCol cols="12">
            <VTextarea
              v-model="remarques"
              label="Remarques"
              prepend-inner-icon="ri-sticky-note-line"
              rows="3"
              auto-grow
              counter="1000"
              :rules="[lengthRule(1000)]"
              hint="Ce que l'équipe doit savoir de cette machine."
              persistent-hint
            />
          </VCol>
          <VCol cols="12">
            <VTextarea
              v-model="contraintes"
              label="Contraintes d'utilisation"
              prepend-inner-icon="ri-error-warning-line"
              rows="3"
              auto-grow
              counter="1000"
              :rules="[lengthRule(1000)]"
              hint="Linge à éviter, charge maximale conseillée, précautions..."
              persistent-hint
            />
          </VCol>
        </VRow>
      </VWindowItem>
    </VWindow>
  </AppFormDialog>
</template>

<style scoped>
.choice-card {
  cursor: pointer;
}

.choice-card:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}

.machine-tabs {
  border-block-end: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
</style>
