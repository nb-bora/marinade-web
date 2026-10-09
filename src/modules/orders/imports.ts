/**
 * Import en masse de commandes (reprise de l'ancien circuit). Les lignes qui portent la même valeur
 * dans « commande » forment une seule commande ; sans valeur, chaque ligne devient sa propre commande.
 * Une commande n'a pas de nom unique : l'import ne fait que créer, il ne met rien à jour.
 */
import { ordersApi } from './api'
import { RowError, numberField, requireText, runRows } from '@/lib/sheetImport'
import type { ImportDefinition, ImportIssue, ImportResult, ImportSheetSpec } from '@/lib/sheetImport'
import { normalizeKey } from '@/lib/spreadsheet'
import type { SheetRecord } from '@/lib/spreadsheet'
import { useTenantStore } from '@/stores/tenant.store'

const COMMANDES_SHEET: ImportSheetSpec = {
  key: 'commandes',
  name: 'Commandes',
  columns: [
    { key: 'commande', label: 'Commande', aliases: ['reference', 'numero'], hint: 'Référence qui regroupe les lignes d\'une même commande. Vide : une commande par ligne.', example: 'C-001' },
    { key: 'table', label: 'Table', hint: 'Numéro d\'une table existante (vide : à emporter).', example: 'T1' },
    { key: 'article', label: 'Article', required: true, aliases: ['plat', 'boisson'], hint: 'Nom exact d\'un plat ou d\'une boisson de la carte.', example: 'Poulet DG' },
    { key: 'quantite', label: 'Quantité', required: true, hint: 'Nombre d\'articles, entier au moins égal à 1.', example: '2' },
    { key: 'notes', label: 'Notes', hint: 'Précision pour la cuisine.', example: 'Sans piment' },
  ],
}

export function commandesImport(): ImportDefinition {
  return {
    title: 'Importer des commandes',
    description: 'Téléchargez un modèle vierge, saisissez une ligne par article, puis importez les commandes.',
    fileName: 'modele-import-commandes',
    sheets: [COMMANDES_SHEET],
    notes: ['Les plats, boissons et tables cités doivent déjà exister. Chaque import crée de nouvelles commandes : ne réimportez pas deux fois le même fichier.'],
    async run(data, tick) {
      const restaurantId = useTenantStore().currentId

      if (!restaurantId)
        throw new Error('no restaurant')

      const result: ImportResult = { created: 0, updated: 0, issues: [] }
      const records = data.commandes ?? []

      if (records.length === 0)
        return result

      const [tables, plats, boissons] = await Promise.all([
        ordersApi.tables(restaurantId),
        ordersApi.plats(restaurantId),
        ordersApi.boissons(restaurantId),
      ])

      const tableByNumber = new Map(tables.map(item => [normalizeKey(item.numero), item.id]))
      const platByName = new Map(plats.map(item => [normalizeKey(item.nom), item.id]))
      const boissonByName = new Map(boissons.map(item => [normalizeKey(item.nom), item.id]))

      const groups = new Map<string, SheetRecord[]>()

      for (const record of records) {
        const key = record.values.commande || `ligne-${record.row}`

        groups.set(key, [...groups.get(key) ?? [], record])
      }

      const issues: ImportIssue[] = []

      for (const group of groups.values()) {
        let commandeId: string | undefined

        const counts = await runRows('Commandes', group, async record => {
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
        }, issues, tick)

        result.created += counts.created
      }

      result.issues = issues

      return result
    },
  }
}
