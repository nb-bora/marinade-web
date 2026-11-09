<!-- Créer un niveau (étage) ou le renommer. -->
<script setup lang="ts">
import type { LevelDef } from '../layout'
import { required } from '@/lib/validation'

const props = defineProps<{

  /** Le niveau à renommer ; `null` pour en créer un. */
  level: LevelDef | null

  /** Enregistre et rend `true` si c'est fait (le dialogue se ferme alors). */
  save: (nom: string) => Promise<boolean>
}>()

const open = defineModel<boolean>({ required: true })

const nom = ref('')
const pending = ref(false)

watch(open, isOpen => {
  if (isOpen)
    nom.value = props.level?.nom ?? ''
})

async function submit() {
  pending.value = true

  try {
    if (await props.save(nom.value))
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
    :title="level ? `Renommer « ${level.nom} »` : 'Nouveau niveau'"
    subtitle="Un niveau est un étage, une mezzanine ou un toit-terrasse, aménagé séparément."
    icon="ri-stack-line"
    :submit-label="level ? 'Enregistrer' : 'Créer'"
    :loading="pending"
    @submit="submit"
  >
    <VTextField
      v-model="nom"
      label="Nom du niveau"
      prepend-inner-icon="ri-stack-line"
      placeholder="Étage 1, Mezzanine, Rooftop…"
      :rules="[required]"
      maxlength="40"
      autocomplete="off"
      autofocus
    />
  </AppFormDialog>
</template>
