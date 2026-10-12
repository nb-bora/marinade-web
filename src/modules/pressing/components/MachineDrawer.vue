<!--
  « Fiche machine » : tiroir latéral sur ordinateur, feuille du bas sur téléphone. Réutilisé par le
  plan et par le parc ; le contenu est `MachineSheet`.
-->
<script setup lang="ts">
import { onKeyStroke } from '@vueuse/core'
import { useDisplay } from 'vuetify'
import type { Machine, Zone } from '../types'
import MachineSheet from './MachineSheet.vue'

defineProps<{
  zones: Zone[]
  canWrite: boolean
  revision?: number
  startTab?: 'fiche' | 'etat' | 'maintenance' | 'historique'
}>()

const emit = defineEmits<{
  changed: []
  edit: [machine: Machine]
}>()

/** Identifiant de la machine affichée ; `null` ferme la fiche. */
const machineId = defineModel<string | null>({ required: true })

const { smAndDown } = useDisplay()

const isOpen = computed({
  get: () => machineId.value !== null,
  set: open => {
    if (!open)
      machineId.value = null
  },
})

onKeyStroke('Escape', () => {
  if (isOpen.value)
    isOpen.value = false
})
</script>

<template>
  <VBottomSheet
    v-if="smAndDown"
    v-model="isOpen"
    inset
    scrollable
    class="machine-drawer machine-drawer--sheet"
  >
    <VCard class="machine-drawer__card">
      <MachineSheet
        v-if="machineId"
        :machine-id="machineId"
        :zones="zones"
        :can-write="canWrite"
        :revision="revision"
        :start-tab="startTab"
        @close="isOpen = false"
        @changed="emit('changed')"
        @edit="emit('edit', $event)"
      />
    </VCard>
  </VBottomSheet>

  <VNavigationDrawer
    v-else
    v-model="isOpen"
    location="end"
    temporary
    width="460"
    class="machine-drawer"
  >
    <MachineSheet
      v-if="machineId"
      :machine-id="machineId"
      :zones="zones"
      :can-write="canWrite"
      :revision="revision"
      :start-tab="startTab"
      @close="isOpen = false"
      @changed="emit('changed')"
      @edit="emit('edit', $event)"
    />
  </VNavigationDrawer>
</template>

<style scoped>
.machine-drawer__card {
  display: flex;
  flex-direction: column;
  block-size: min(88vh, 720px);
  border-end-end-radius: 0;
  border-end-start-radius: 0;
}
</style>
