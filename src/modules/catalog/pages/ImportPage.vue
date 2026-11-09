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
  const saved = result.created + result.updated
  const plural = saved > 1 ? 's' : ''

  toast.success(`${saved} ligne${plural} enregistrée${plural} dans la carte.`)
}
</script>

<template>
  <div class="catalog-import">
    <AppHero
      eyebrow="Carte"
      title="Importer la carte"
      subtitle="Menus, catégories, plats et boissons : un seul classeur, avec un aperçu avant toute écriture."
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
    </AppHero>

    <AppEmptyState
      v-if="!tenant.can('management')"
      class="mt-5"
      icon="ri-lock-line"
      title="Import réservé à la gestion"
      text="Demandez au responsable du restaurant d'importer ce fichier."
    />
    <AppImportSection
      v-else
      class="mt-5"
      compact
      hide-columns
      v-bind="definition"
      @imported="onImported"
    />
  </div>
</template>
