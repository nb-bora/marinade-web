/**
 * Import en masse des tables de la salle. Chaque ligne passe par la route de création (ou de
 * modification) habituelle ; une table dont le numéro existe déjà est mise à jour.
 */
import { floorApi } from './api'
import { RowError, addCounts, numberField, requireText, runRows } from '@/lib/sheetImport'
import type { ImportDefinition, ImportResult, ImportSheetSpec, RowOutcome } from '@/lib/sheetImport'
import { normalizeKey } from '@/lib/spreadsheet'
import { useTenantStore } from '@/stores/tenant.store'

const TABLES_SHEET: ImportSheetSpec = {
  key: 'tables',
  name: 'Tables',
  columns: [
    { key: 'numero', label: 'Numéro', required: true, aliases: ['table', 'nom'], hint: 'Le numéro ou le nom de la table, unique dans la salle.', example: 'T1' },
    { key: 'capacite', label: 'Capacité', required: true, aliases: ['places'], hint: 'Nombre de places, entier au moins égal à 1.', example: '4' },
    { key: 'emplacement', label: 'Emplacement', aliases: ['section', 'zone'], hint: 'Où se trouve la table : Salle, Terrasse, Étage...', example: 'Terrasse' },
    { key: 'forme', label: 'Forme', hint: 'rectangle ou rond (vide : inchangée).', example: 'rond' },
  ],
}

const SHAPES: Record<string, 'rectangle' | 'rond'> = {
  rectangle: 'rectangle',
  rectangulaire: 'rectangle',
  carre: 'rectangle',
  rond: 'rond',
  ronde: 'rond',
  circulaire: 'rond',
}

export function tablesImport(): ImportDefinition {
  return {
    title: 'Importer des tables',
    description: 'Téléchargez un modèle vierge, listez les tables de votre salle, puis importez-les en une fois.',
    fileName: 'modele-import-tables',
    sheets: [TABLES_SHEET],
    notes: ['Une table dont le numéro existe déjà est mise à jour ; sinon elle est créée. Vous pouvez donc réimporter un fichier corrigé sans créer de doublons.'],
    async run(data, tick) {
      const result: ImportResult = { created: 0, updated: 0, issues: [] }
      const records = data.tables ?? []
      const id = useTenantStore().currentId

      if (!id)
        throw new Error('no restaurant')
      if (records.length === 0)
        return result

      const existing = new Map((await floorApi.tables(id)).map(table => [normalizeKey(table.numero), table]))

      addCounts(result, await runRows('Tables', records, async (record): Promise<RowOutcome> => {
        const numero = requireText(record, 'numero', 'Numéro')
        const capacite = numberField(record, 'capacite', 'Capacité', { required: true, min: 1, integer: true }) ?? 1
        const emplacement = record.values.emplacement || undefined
        const shapeText = record.values.forme
        const forme = shapeText ? SHAPES[normalizeKey(shapeText)] : undefined

        if (shapeText && !forme)
          throw new RowError('Forme', 'Répondez par « rectangle » ou « rond ».')

        const found = existing.get(normalizeKey(numero))

        if (found) {
          await floorApi.updateTable(found.id, {
            capacite,
            emplacement,
            attributs_jsonb: forme ? { ...found.attributs_jsonb, forme } : undefined,
          })

          return 'updated'
        }

        existing.set(normalizeKey(numero), await floorApi.createTable(id, {
          numero,
          capacite,
          emplacement,
          statut: 'libre',
          attributs_jsonb: forme ? { forme } : undefined,
        }))
      }, result.issues, tick))

      return result
    },
  }
}
