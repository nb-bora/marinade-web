<!-- Ajouter une ou plusieurs tables d'un coup (numérotées à la suite) dans une zone d'un niveau. -->
<script setup lang="ts">
import type { NewTables } from '../composables/useFloorDesigner'
import type { LevelDef, PlacementShape } from '../layout'
import { nextTableNumbers } from '../layout'
import { required } from '@/lib/validation'

const props = defineProps<{

  /** Niveaux proposés ; le choix du niveau n'apparaît que s'il y en a plusieurs. */
  levels: LevelDef[]
  defaultLevel: string

  /** Zones proposées pour un niveau ; une zone nouvelle peut aussi être saisie. */
  zonesOf: (levelId: string) => string[]

  /** Numéros déjà utilisés dans le restaurant, pour afficher la numérotation prévue. */
  existing: string[]
  save: (levelId: string, spec: NewTables) => Promise<boolean>
}>()

const open = defineModel<boolean>({ required: true })

const level = ref('')
const zone = ref('')
const prefix = ref('T')
const count = ref<number | string>(1)
const capacity = ref<number | string>(4)
const shape = ref<PlacementShape | 'auto'>('auto')
const pending = ref(false)

const SHAPES: { value: PlacementShape | 'auto'; title: string }[] = [
  { value: 'auto', title: 'Auto' },
  { value: 'round', title: 'Ronde' },
  { value: 'square', title: 'Carrée' },
  { value: 'rect', title: 'Longue' },
]

const zones = computed(() => props.zonesOf(level.value))
const levelName = computed(() => props.levels.find(item => item.id === level.value)?.nom ?? '')

watch(open, isOpen => {
  if (!isOpen)
    return

  level.value = props.levels.some(item => item.id === props.defaultLevel) ? props.defaultLevel : props.levels[0].id
  zone.value = zones.value[0] ?? 'Salle'
  count.value = 1
  capacity.value = 4
  shape.value = 'auto'
})

// Changer de niveau propose les zones de ce niveau, sauf si la zone saisie y existe déjà.
watch(level, () => {
  if (zone.value && !zones.value.some(name => name.toLowerCase() === zone.value.toLowerCase()))
    zone.value = zones.value[0] ?? zone.value
})

const total = computed(() => Number(count.value))

const preview = computed(() => {
  if (!Number.isInteger(total.value) || total.value < 1 || total.value > 60 || !prefix.value.trim())
    return ''

  const numbers = nextTableNumbers(props.existing, prefix.value.trim(), total.value)

  return total.value === 1 ? `Table ${numbers[0]}` : `Tables ${numbers[0]} à ${numbers[numbers.length - 1]}`
})

const between = (min: number, max: number) => (value: unknown) =>
  (Number.isInteger(Number(value)) && Number(value) >= min && Number(value) <= max) || `Saisissez un entier entre ${min} et ${max}.`

async function submit() {
  pending.value = true

  try {
    const ok = await props.save(level.value, {
      prefix: prefix.value.trim(),
      count: total.value,
      capacity: Number(capacity.value),
      zone: zone.value.trim(),
      shape: shape.value === 'auto' ? undefined : shape.value,
    })

    if (ok)
      open.value = false
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <AppFormDialog
    v-model="open"
    title="Ajouter des tables"
    :subtitle="levels.length > 1 ? 'Elles sont numérotées à la suite et rangées sur les places libres du niveau choisi.' : `Au niveau « ${levelName} ». Elles sont numérotées à la suite et rangées sur les places libres du plan.`"
    icon="ri-layout-grid-line"
    submit-label="Créer"
    :loading="pending"
    @submit="submit"
  >
    <VRow>
      <VCol
        v-if="levels.length > 1"
        cols="12"
      >
        <VSelect
          v-model="level"
          :items="levels"
          item-value="id"
          item-title="nom"
          label="Niveau"
          prepend-inner-icon="ri-stack-line"
        />
      </VCol>
      <VCol
        cols="12"
        sm="6"
      >
        <VCombobox
          v-model="zone"
          :items="zones"
          label="Zone"
          prepend-inner-icon="ri-map-pin-line"
          placeholder="Salle, Terrasse 2…"
          :rules="[required]"
          maxlength="50"
          hint="Choisissez une zone du niveau ou saisissez-en une nouvelle."
          persistent-hint
        />
      </VCol>
      <VCol
        cols="6"
        sm="3"
      >
        <VTextField
          v-model="prefix"
          label="Préfixe"
          prepend-inner-icon="ri-price-tag-3-line"
          :rules="[required]"
          maxlength="10"
          autocomplete="off"
        />
      </VCol>
      <VCol
        cols="6"
        sm="3"
      >
        <VTextField
          v-model="count"
          label="Nombre"
          prepend-inner-icon="ri-hashtag"
          type="number"
          inputmode="numeric"
          min="1"
          max="60"
          :rules="[between(1, 60)]"
        />
      </VCol>
      <VCol
        cols="12"
        sm="6"
      >
        <VTextField
          v-model="capacity"
          label="Places par table"
          prepend-inner-icon="ri-armchair-line"
          type="number"
          inputmode="numeric"
          min="1"
          max="30"
          :rules="[between(1, 30)]"
        />
      </VCol>
      <VCol
        cols="12"
        sm="6"
      >
        <div class="text-body-2 text-medium-emphasis mb-1">
          Forme des tables
        </div>
        <AppSegmented
          v-model="shape"
          :options="SHAPES"
          label="Forme des tables"
        />
      </VCol>
      <VCol
        v-if="preview"
        cols="12"
      >
        <VAlert
          type="info"
          variant="tonal"
          density="compact"
          icon="ri-list-ordered"
        >
          {{ preview }}
        </VAlert>
      </VCol>
    </VRow>
  </AppFormDialog>
</template>
