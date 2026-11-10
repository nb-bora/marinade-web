<!--
  Disponibilité d'un article dans un tableau : interrupteur pour la direction, simple pastille sinon.
  Le clic et la touche Entrée/Espace ne remontent pas à la ligne (qui ouvrirait la fiche).
-->
<script setup lang="ts">
defineProps<{
  available: boolean
  canWrite: boolean

  /** Nom de l'article, pour l'étiquette lue par les lecteurs d'écran. */
  name: string

  /** Cet article est en cours d'enregistrement. */
  busy: boolean

  /** Une autre bascule est en cours : on attend qu'elle finisse. */
  locked: boolean
}>()

defineEmits<{ toggle: [] }>()
</script>

<template>
  <div
    class="d-inline-flex"
    @click.stop
    @keydown.enter.stop
    @keydown.space.stop
  >
    <VSwitch
      v-if="canWrite"
      :model-value="available"
      :loading="busy"
      :disabled="locked"
      :aria-label="available ? `Rendre ${name} indisponible` : `Rendre ${name} disponible`"
      color="success"
      density="compact"
      hide-details
      @update:model-value="$emit('toggle')"
    />
    <AppStatusChip
      v-else
      :label="available ? 'Disponible' : 'Indisponible'"
      :tone="available ? 'success' : 'neutral'"
    />
  </div>
</template>
