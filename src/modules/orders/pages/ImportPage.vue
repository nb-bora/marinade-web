<script setup lang="ts">
import { ordersApi } from '../api'
import { useTenantStore } from '@/stores/tenant.store'
import { useToast } from '@/stores/toast.store'
import { RowError, numberField, requireText, runRows } from '@/lib/sheetImport'
import type { ImportData, ImportIssue, ImportResult, ImportSheetSpec } from '@/lib/sheetImport'
import { normalizeKey } from '@/lib/spreadsheet'
import type { SheetRecord } from '@/lib/spreadsheet'

const tenant = useTenantStore()
const toast = useToast()
const router = useRouter()

const SHEETS: ImportSheetSpec[] = [
  {
    key: 'commandes',
    name: 'Commandes',
    columns: [
      { key: 'commande', label: 'Commande', aliases: ['reference', 'numero'] },
      { key: 'table', label: 'Table' },
      { key: 'article', label: 'Article', required: true, aliases: ['plat', 'boisson'] },
      { key: 'quantite', label: 'Quantité', required: true },
      { key: 'notes', label: 'Notes' },
    ],
  },
]

/**
 * Les lignes qui portent la même valeur dans « Commande » forment une seule commande
 * (une ligne par article). Sans valeur, chaque ligne devient sa propre commande.
 */
async function run(data: ImportData): Promise<ImportResult> {
  const restaurantId = tenant.currentId

  if (!restaurantId)
    throw new Error('no restaurant')

  const [tables, plats, boissons] = await Promise.all([
    ordersApi.tables(restaurantId),
    ordersApi.plats(restaurantId),
    ordersApi.boissons(restaurantId),
  ])

  const tableByNumber = new Map(tables.map(item => [normalizeKey(item.numero), item.id]))
  const platByName = new Map(plats.map(item => [normalizeKey(item.nom), item.id]))
  const boissonByName = new Map(boissons.map(item => [normalizeKey(item.nom), item.id]))

  const groups = new Map<string, SheetRecord[]>()

  for (const record of data.commandes ?? []) {
    const key = record.values.commande || `ligne-${record.row}`

    groups.set(key, [...groups.get(key) ?? [], record])
  }

  const issues: ImportIssue[] = []
  let created = 0

  for (const records of groups.values()) {
    let commandeId: string | undefined

    created += await runRows('Commandes', records, async record => {
      const article = normalizeKey(requireText(record, 'article', 'Article'))
      const platId = platByName.get(article)
      const boissonId = platId ? undefined : boissonByName.get(article)
      const quantite = numberField(record, 'quantite', 'Quantité', { required: true, min: 1, integer: true }) ?? 1
      const tableNumber = record.values.table

      if (!platId && !boissonId)
        throw new RowError('Article', 'Cet article n\'existe ni dans les plats ni dans les boissons.')

      const tableId = tableNumber ? tableByNumber.get(normalizeKey(tableNumber)) : undefined

      if (tableNumber && !tableId)
        throw new RowError('Table', 'Cette table n\'existe pas.')

      commandeId ??= (await ordersApi.create(restaurantId, { statut: 'en_cours', table_id: tableId })).id

      await ordersApi.addItem(commandeId, {
        plat_id: platId,
        boisson_id: boissonId,
        quantite,
        supplement_ids: [],
        notes: record.values.notes || undefined,
      })
    }, issues)
  }

  return { created, issues }
}

async function onDone(result: ImportResult) {
  if (result.created > 0)
    toast.success(`${result.created} ligne${result.created > 1 ? 's' : ''} de commande importée${result.created > 1 ? 's' : ''}.`)

  if (result.created > 0 && result.issues.length === 0)
    await router.push('/commandes')
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

    <AppImportPanel
      :sheets="SHEETS"
      :run="run"
      @done="onDone"
    />
  </div>
</template>
