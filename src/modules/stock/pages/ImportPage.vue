<script setup lang="ts">
import { stockImport } from '../imports'
import { useTenantStore } from '@/stores/tenant.store'
import { useToast } from '@/stores/toast.store'
import type { ImportResult } from '@/lib/sheetImport'

const tenant = useTenantStore()
const toast = useToast()
const definition = stockImport()

function onImported(result: ImportResult) {
  const count = result.created + result.updated

  toast.success(`${count} ligne${count > 1 ? 's' : ''} enregistrée${count > 1 ? 's' : ''} dans le stock.`)
}
</script>

<template>
  <div>
    <AppPageHeader
      title="Importer le stock"
      subtitle="Ajoutez vos composants et vos fiches techniques depuis un fichier Excel."
    >
      <template #actions>
        <VBtn
          variant="tonal"
          prepend-icon="ri-arrow-left-line"
          to="/stock/composants"
        >
          Retour aux composants
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
