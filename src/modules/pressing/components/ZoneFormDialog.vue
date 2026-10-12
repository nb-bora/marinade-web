<!-- Création et modification d'une zone du plan : nom, type, couleur, position et taille en pourcentage. -->
<script setup lang="ts">
import { pressingApi } from '../api'
import { ZONE_COLORS, ZONE_ICON, ZONE_INFO, ZONE_OPTIONS, pressingError } from '../labels'
import type { Zone, ZoneType, ZoneWrite } from '../types'
import { useSubmit } from '@/composables/useSubmit'
import { useTenantStore } from '@/stores/tenant.store'
import { useToast } from '@/stores/toast.store'

const props = defineProps<{
  zone: Zone | null

  /** Zones existantes : la nouvelle zone se pose dans un emplacement encore libre. */
  zones: Zone[]
}>()

const emit = defineEmits<{ saved: [zone: Zone] }>()
const open = defineModel<boolean>({ required: true })

const tenant = useTenantStore()
const toast = useToast()

const nom = ref('')
const type = ref<ZoneType>('lavage')
const couleur = ref('#3B82F6')
const x = ref('')
const y = ref('')
const w = ref('')
const h = ref('')
const colorTouched = ref(false)

const isEdit = computed(() => props.zone !== null)

const QUADRANTS = [
  { x: 4, y: 8, w: 44, h: 40 },
  { x: 52, y: 8, w: 44, h: 40 },
  { x: 4, y: 52, w: 44, h: 40 },
  { x: 52, y: 52, w: 44, h: 40 },
]

const overlaps = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

/** Premier quart du plan qui ne recouvre aucune zone existante. */
function freeSlot() {
  return QUADRANTS.find(slot => props.zones.every(zone => !overlaps(slot, zone))) ?? { x: 20, y: 20, w: 40, h: 40 }
}

const number = (value: string) => Number(value.trim().replace(',', '.'))

const { submit, pending, error, apiError, reset } = useSubmit(async () => {
  const restaurantId = tenant.currentId

  if (!restaurantId)
    return

  const body: ZoneWrite = {
    nom: nom.value.trim(),
    type: type.value,
    couleur: couleur.value.toUpperCase(),
    x: number(x.value),
    y: number(y.value),
    w: number(w.value),
    h: number(h.value),
  }

  const saved = props.zone
    ? await pressingApi.updateZone(restaurantId, props.zone.id, body)
    : await pressingApi.createZone(restaurantId, body)

  toast.success(isEdit.value ? `La zone « ${saved.nom} » est modifiée.` : `La zone « ${saved.nom} » est créée.`)
  open.value = false
  emit('saved', saved)
})

const nameError = computed(() => apiError.value?.kind === 'conflict' ? pressingError(error.value) : apiError.value?.fieldMessage('nom'))
const globalError = computed(() => error.value && !nameError.value ? pressingError(error.value) : '')

watch(nom, () => {
  if (apiError.value?.kind === 'conflict')
    reset()
})

watch(open, isOpen => {
  if (!isOpen)
    return

  reset()

  const zone = props.zone
  const slot = freeSlot()

  nom.value = zone?.nom ?? ''
  type.value = zone?.type ?? 'lavage'
  couleur.value = zone?.couleur ?? ZONE_INFO[zone?.type ?? 'lavage'].color
  colorTouched.value = !!zone
  x.value = String(zone?.x ?? slot.x)
  y.value = String(zone?.y ?? slot.y)
  w.value = String(zone?.w ?? slot.w)
  h.value = String(zone?.h ?? slot.h)
})

// Une zone neuve prend la couleur habituelle de son type tant qu'on n'en a pas choisi une autre.
watch(type, value => {
  if (!colorTouched.value)
    couleur.value = ZONE_INFO[value].color
})

function pick(color: string) {
  colorTouched.value = true
  couleur.value = color
}

const nomRules = [(value: string) => (value.trim().length >= 1 && value.trim().length <= 120) || 'Donnez un nom à la zone, de 1 à 120 caractères.']
const colorRules = [(value: string) => /^#[0-9A-F]{6}$/i.test(value.trim()) || 'La couleur s\'écrit #RRGGBB, par exemple #3B82F6.']

const percent = (label: string, minimum: number) => (value: string) => {
  const text = value.trim().replace(',', '.')
  const parsed = Number(text)

  return (text !== '' && Number.isFinite(parsed) && parsed >= minimum && parsed <= 100) || `${label} : un pourcentage entre ${minimum} et 100.`
}

const geometryRule = () => {
  const [px, py, pw, ph] = [x.value, y.value, w.value, h.value].map(number)

  return (px + pw <= 100.0001 && py + ph <= 100.0001) || 'La zone dépasse du plan : la position plus la taille ne peuvent pas dépasser 100 %.'
}
</script>

<template>
  <AppFormDialog
    v-model="open"
    :title="isEdit ? `Modifier la zone ${zone?.nom ?? ''}` : 'Nouvelle zone'"
    :subtitle="isEdit ? undefined : 'Un espace du local : lavage, séchage, réception, pliage...'"
    :submit-label="isEdit ? 'Enregistrer' : 'Créer'"
    :confirm-title="isEdit ? 'Enregistrer cette zone ?' : 'Créer cette zone ?'"
    :confirm-text="isEdit ? `Les changements apportés à « ${nom.trim()} » seront enregistrés.` : `La zone « ${nom.trim()} » sera ajoutée au plan.`"
    icon="ri-layout-grid-line"
    :max-width="640"
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
          label="Nom de la zone"
          prepend-inner-icon="ri-price-tag-3-line"
          placeholder="Lavage, Séchage, Réception..."
          :rules="nomRules"
          :error-messages="nameError"
          maxlength="120"
          autofocus
          data-testid="zone-nom"
        />
      </VCol>
      <VCol
        cols="12"
        sm="5"
      >
        <VSelect
          v-model="type"
          :items="ZONE_OPTIONS"
          label="Type de zone"
          :prepend-inner-icon="ZONE_ICON[type]"
          :hint="ZONE_INFO[type].hint"
          persistent-hint
        />
      </VCol>

      <VCol cols="12">
        <div class="text-subtitle-2 mb-2">
          Couleur
        </div>
        <div
          class="d-flex flex-wrap gap-2 mb-3"
          role="radiogroup"
          aria-label="Couleur de la zone"
        >
          <button
            v-for="color in ZONE_COLORS"
            :key="color"
            type="button"
            role="radio"
            class="zone-swatch"
            :class="{ 'zone-swatch--active': couleur.toUpperCase() === color }"
            :style="{ background: color }"
            :aria-checked="couleur.toUpperCase() === color"
            :aria-label="`Couleur ${color}`"
            @click="pick(color)"
          />
        </div>
        <VTextField
          v-model="couleur"
          label="Code couleur"
          prepend-inner-icon="ri-palette-line"
          :rules="colorRules"
          maxlength="7"
          @update:model-value="colorTouched = true"
        />
      </VCol>

      <VCol cols="12">
        <div class="text-subtitle-2 mb-1">
          Position et taille sur le plan
        </div>
        <p class="text-body-2 text-medium-emphasis mb-0">
          En pourcentage du plan. Vous pourrez aussi déplacer et redimensionner la zone à la main avec le bouton « Aménager ».
        </p>
      </VCol>
      <VCol
        cols="6"
        sm="3"
      >
        <VTextField
          v-model="x"
          label="Horizontale"
          prepend-inner-icon="ri-arrow-left-right-line"
          inputmode="decimal"
          suffix="%"
          :rules="[percent('Position horizontale', 0), geometryRule]"
        />
      </VCol>
      <VCol
        cols="6"
        sm="3"
      >
        <VTextField
          v-model="y"
          label="Verticale"
          prepend-inner-icon="ri-arrow-up-down-line"
          inputmode="decimal"
          suffix="%"
          :rules="[percent('Position verticale', 0)]"
        />
      </VCol>
      <VCol
        cols="6"
        sm="3"
      >
        <VTextField
          v-model="w"
          label="Largeur"
          prepend-inner-icon="ri-expand-width-line"
          inputmode="decimal"
          suffix="%"
          :rules="[percent('Largeur', 1)]"
        />
      </VCol>
      <VCol
        cols="6"
        sm="3"
      >
        <VTextField
          v-model="h"
          label="Hauteur"
          prepend-inner-icon="ri-expand-height-line"
          inputmode="decimal"
          suffix="%"
          :rules="[percent('Hauteur', 1)]"
        />
      </VCol>
    </VRow>
  </AppFormDialog>
</template>

<style scoped>
.zone-swatch {
  inline-size: 32px;
  block-size: 32px;
  border: 2px solid transparent;
  border-radius: 50%;
  box-shadow: inset 0 0 0 2px rgb(var(--v-theme-surface));
  cursor: pointer;
  transition: transform 0.12s ease;
}

.zone-swatch:hover {
  transform: scale(1.1);
}

.zone-swatch--active {
  border-color: rgb(var(--v-theme-on-surface));
}

.zone-swatch:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}
</style>
