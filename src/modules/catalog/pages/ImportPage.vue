<script setup lang="ts">
import { catalogApi } from '../api'
import { useTenantStore } from '@/stores/tenant.store'
import { useToast } from '@/stores/toast.store'
import { booleanField, numberField, requireText, runRows } from '@/lib/sheetImport'
import type { ImportData, ImportIssue, ImportResult, ImportSheetSpec } from '@/lib/sheetImport'

const tenant = useTenantStore()
const toast = useToast()
const router = useRouter()

const SHEETS: ImportSheetSpec[] = [
  {
    key: 'plats',
    name: 'Plats',
    optional: true,
    columns: [
      { key: 'nom', label: 'Nom', required: true },
      { key: 'prix', label: 'Prix', required: true },
      { key: 'temps_preparation', label: 'Temps de préparation', aliases: ['temps'] },
      { key: 'disponible', label: 'Disponible' },
      { key: 'description', label: 'Description' },
    ],
  },
  {
    key: 'boissons',
    name: 'Boissons',
    optional: true,
    columns: [
      { key: 'nom', label: 'Nom', required: true },
      { key: 'prix', label: 'Prix', required: true },
      { key: 'categorie', label: 'Catégorie', aliases: ['category'] },
      { key: 'alcool', label: 'Alcool' },
      { key: 'disponible', label: 'Disponible' },
      { key: 'description', label: 'Description' },
    ],
  },
]

/** Pas de route d'import en masse côté serveur : une création par ligne, erreurs recueillies. */
async function run(data: ImportData): Promise<ImportResult> {
  const restaurantId = tenant.currentId

  if (!restaurantId)
    throw new Error('no restaurant')

  const issues: ImportIssue[] = []
  let created = 0

  created += await runRows('Plats', data.plats ?? [], record => catalogApi.createPlat(restaurantId, {
    nom: requireText(record, 'nom', 'Nom'),
    prix: numberField(record, 'prix', 'Prix', { required: true, min: 1 }) ?? 0,
    temps_preparation: numberField(record, 'temps_preparation', 'Temps de préparation', { min: 0, integer: true }),
    disponible: booleanField(record, 'disponible', 'Disponible'),
    description: record.values.description || undefined,
  }), issues)

  created += await runRows('Boissons', data.boissons ?? [], record => catalogApi.createBoisson(restaurantId, {
    nom: requireText(record, 'nom', 'Nom'),
    prix: numberField(record, 'prix', 'Prix', { required: true, min: 1 }) ?? 0,
    category: record.values.categorie || undefined,
    alcool: booleanField(record, 'alcool', 'Alcool'),
    disponible: booleanField(record, 'disponible', 'Disponible'),
    description: record.values.description || undefined,
  }), issues)

  return { created, issues }
}

async function onDone(result: ImportResult) {
  if (result.created > 0)
    toast.success(`${result.created} article${result.created > 1 ? 's' : ''} ajouté${result.created > 1 ? 's' : ''} à la carte.`)

  if (result.created > 0 && result.issues.length === 0)
    await router.push('/catalog/plats')
}
</script>

<template>
  <div>
    <AppPageHeader
      title="Importer la carte"
      subtitle="Ajoutez vos plats et vos boissons depuis un fichier Excel."
    >
      <template #actions>
        <VBtn
          variant="tonal"
          prepend-icon="ri-arrow-left-line"
          to="/catalog/plats"
        >
          Retour aux plats
        </VBtn>
      </template>
    </AppPageHeader>

    <AppEmptyState
      v-if="!tenant.can('management')"
      icon="ri-lock-line"
      title="Import réservé à la gestion"
      text="Demandez au responsable du restaurant d'importer ce fichier."
    />
    <AppImportPanel
      v-else
      :sheets="SHEETS"
      :run="run"
      @done="onDone"
    />
  </div>
</template>
