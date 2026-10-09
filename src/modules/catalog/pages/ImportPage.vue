<script setup lang="ts">
import { catalogImport } from '../imports'
import { useTenantStore } from '@/stores/tenant.store'
import { useToast } from '@/stores/toast.store'
import type { ImportResult } from '@/lib/sheetImport'

const tenant = useTenantStore()
const toast = useToast()
const definition = catalogImport()

/** Rien à recharger ici : les listes se chargent à l'ouverture. */
function onImported(result: ImportResult) {
  toast.success(`${result.created + result.updated} ligne${result.created + result.updated > 1 ? 's' : ''} enregistrée${result.created + result.updated > 1 ? 's' : ''} dans la carte.`)
}
</script>

<template>
  <div>
    <AppPageHeader
      title="Importer la carte"
      subtitle="Ajoutez vos menus, vos plats et vos boissons depuis un fichier Excel."
    >
      <template #actions>
        <VBtn
          variant="tonal"
          prepend-icon="ri-arrow-left-line"
          to="/catalog/menus"
        >
          Retour aux menus
        </VBtn>
      </template>
    </AppPageHeader>

    <AppEmptyState
      v-if="!tenant.can('management')"
      icon="ri-lock-line"
      title="Import réservé à la gestion"
      text="Demandez au responsable du restaurant d'importer ce fichier."
    />
    <AppImportSection
      v-else
      v-bind="definition"
      @imported="onImported"
    />
  </div>
</template>
