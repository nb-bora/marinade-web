<script setup lang="ts">
import { commandesImport } from '../imports'
import { useToast } from '@/stores/toast.store'
import type { ImportResult } from '@/lib/sheetImport'

const toast = useToast()
const definition = commandesImport()

function onImported(result: ImportResult) {
  toast.success(`${result.created} ligne${result.created > 1 ? 's' : ''} de commande importée${result.created > 1 ? 's' : ''}.`)
}
</script>

<template>
  <div>
    <AppPageHeader
      title="Importer des commandes"
      subtitle="Saisie en masse de commandes de l'ancien circuit depuis un fichier Excel."
    >
      <template #actions>
        <VBtn
          variant="tonal"
          prepend-icon="ri-arrow-left-line"
          to="/commandes"
        >
          Retour aux commandes
        </VBtn>
      </template>
    </AppPageHeader>

    <AppImportSection
      v-bind="definition"
      @imported="onImported"
    />
  </div>
</template>
