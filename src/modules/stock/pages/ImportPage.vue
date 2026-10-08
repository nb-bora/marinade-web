<script setup lang="ts">
import { stockApi } from '../api'
import { useTenantStore } from '@/stores/tenant.store'
import { useToast } from '@/stores/toast.store'
import { RowError, booleanField, numberField, requireText, runRows } from '@/lib/sheetImport'
import type { ImportData, ImportIssue, ImportResult, ImportSheetSpec } from '@/lib/sheetImport'
import { normalizeKey } from '@/lib/spreadsheet'

const tenant = useTenantStore()
const toast = useToast()
const router = useRouter()

const SHEETS: ImportSheetSpec[] = [
  {
    key: 'composants',
    name: 'Composants',
    optional: true,
    columns: [
      { key: 'nom', label: 'Nom', required: true },
      { key: 'type', label: 'Type', required: true },
      { key: 'unite', label: 'Unité', aliases: ['stock_unite'] },
      { key: 'prix_supplement', label: 'Supplément', aliases: ['prix', 'prix_supplement'] },
      { key: 'disponible', label: 'Disponible' },
      { key: 'description', label: 'Description' },
    ],
  },
  {
    key: 'recettes',
    name: 'Recettes',
    optional: true,
    columns: [
      { key: 'plat', label: 'Plat', required: true },
      { key: 'composant', label: 'Composant', required: true },
      { key: 'quantite', label: 'Quantité' },
      { key: 'unite', label: 'Unité' },
    ],
  },
]

/**
 * Le serveur n'offre pas de route d'import en masse : chaque ligne passe par la route de
 * création habituelle, les composants d'abord pour que les recettes puissent les retrouver.
 */
async function run(data: ImportData): Promise<ImportResult> {
  const restaurantId = tenant.currentId

  if (!restaurantId)
    throw new Error('no restaurant')

  const issues: ImportIssue[] = []
  let created = 0

  created += await runRows('Composants', data.composants ?? [], record => stockApi.createComposant(restaurantId, {
    nom: requireText(record, 'nom', 'Nom'),
    type: requireText(record, 'type', 'Type'),
    devise: 'XAF',
    stock_unite: record.values.unite || 'portion',
    prix_supplement: numberField(record, 'prix_supplement', 'Supplément', { min: 0 }) ?? 0,
    disponible: booleanField(record, 'disponible', 'Disponible') ?? true,
    description: record.values.description || undefined,
  }), issues)

  const recipes = data.recettes ?? []

  if (recipes.length > 0) {
    const [plats, composants] = await Promise.all([stockApi.plats(restaurantId), stockApi.composants(restaurantId)])
    const platByName = new Map(plats.map(item => [normalizeKey(item.nom), item.id]))
    const composantByName = new Map(composants.map(item => [normalizeKey(item.nom), item.id]))

    created += await runRows('Recettes', recipes, record => {
      const platId = platByName.get(normalizeKey(requireText(record, 'plat', 'Plat')))
      const composantId = composantByName.get(normalizeKey(requireText(record, 'composant', 'Composant')))

      if (!platId)
        throw new RowError('Plat', 'Ce plat n\'existe pas dans la carte.')
      if (!composantId)
        throw new RowError('Composant', 'Ce composant n\'existe pas : ajoutez-le dans la feuille Composants.')

      return stockApi.addRecipeLine(platId, {
        composant_id: composantId,
        quantite: numberField(record, 'quantite', 'Quantité', { min: 0 }) ?? 1,
        unite: record.values.unite || 'portion',
      })
    }, issues)
  }

  return { created, issues }
}

async function onDone(result: ImportResult) {
  if (result.created > 0)
    toast.success(`${result.created} ligne${result.created > 1 ? 's' : ''} importée${result.created > 1 ? 's' : ''}.`)

  // La liste se recharge à l'ouverture : le stock affiché est celui d'après l'import.
  if (result.created > 0 && result.issues.length === 0)
    await router.push('/stock/composants')
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
    <AppImportPanel
      v-else
      :sheets="SHEETS"
      :run="run"
      @done="onDone"
    />
  </div>
</template>
