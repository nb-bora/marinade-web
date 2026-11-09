<!-- Créer une zone (salle, terrasse, bar, salon…) ou la modifier. -->
<script setup lang="ts">
import type { LevelDef, ZoneDef, ZoneType } from '../layout'
import { ZONE_TYPES, guessZoneType } from '../layout'
import { required } from '@/lib/validation'

const props = defineProps<{

  /** La zone à modifier ; `null` pour en créer une. */
  zone: ZoneDef | null
  levels: LevelDef[]

  /** Niveau proposé pour une nouvelle zone. */
  defaultLevel: string
  save: (zone: ZoneDef) => Promise<boolean>
}>()

const open = defineModel<boolean>({ required: true })

const nom = ref('')
const type = ref<ZoneType>('salle')
const niveau = ref('')
const typeTouched = ref(false)
const pending = ref(false)

watch(open, isOpen => {
  if (!isOpen)
    return

  nom.value = props.zone?.nom ?? ''
  type.value = props.zone?.type ?? 'salle'
  niveau.value = props.zone?.niveau ?? props.defaultLevel
  typeTouched.value = !!props.zone
})

// « Terrasse 2 » → type terrasse, tant que l'utilisateur n'a pas choisi lui-même.
watch(nom, value => {
  if (!typeTouched.value)
    type.value = guessZoneType(value)
})

async function submit() {
  pending.value = true

  try {
    if (await props.save({ nom: nom.value, type: type.value, niveau: niveau.value }))
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
    :title="zone ? `Modifier la zone « ${zone.nom} »` : 'Nouvelle zone'"
    subtitle="Les tables d'une même zone sont regroupées dans un cadre sur le plan."
    icon="ri-layout-masonry-line"
    :submit-label="zone ? 'Enregistrer' : 'Créer'"
    :loading="pending"
    @submit="submit"
  >
    <VRow>
      <VCol
        cols="12"
        sm="6"
      >
        <VTextField
          v-model="nom"
          label="Nom de la zone"
          prepend-inner-icon="ri-map-pin-line"
          placeholder="Terrasse 2, Salle du fond…"
          :rules="[required]"
          maxlength="50"
          autocomplete="off"
          autofocus
        />
      </VCol>
      <VCol
        cols="12"
        sm="6"
      >
        <VSelect
          v-model="type"
          :items="ZONE_TYPES"
          item-value="value"
          item-title="title"
          label="Type de zone"
          prepend-inner-icon="ri-shapes-line"
          @update:model-value="typeTouched = true"
        />
      </VCol>
      <VCol cols="12">
        <VSelect
          v-model="niveau"
          :items="levels"
          item-value="id"
          item-title="nom"
          label="Niveau"
          prepend-inner-icon="ri-stack-line"
          :hint="zone ? 'Changer de niveau déplace aussi les tables de la zone.' : undefined"
          persistent-hint
        />
      </VCol>
    </VRow>
  </AppFormDialog>
</template>
