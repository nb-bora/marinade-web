/**
 * Imports en masse du stock : composants et fiches techniques (recettes).
 *
 * Chaque ligne passe par la route de création (ou de modification) habituelle. Un composant dont
 * le nom existe déjà est mis à jour ; une ligne de recette qui existe déjà voit sa quantité mise à jour.
 */
import { stockApi } from './api'
import type { PlatComposant } from './types'
import { RowError, addCounts, booleanField, combineImports, numberField, requireText, runRows } from '@/lib/sheetImport'
import type { ImportData, ImportDefinition, ImportResult, ImportSheetSpec, ImportTick, RowOutcome } from '@/lib/sheetImport'
import { normalizeKey } from '@/lib/spreadsheet'
import { useTenantStore } from '@/stores/tenant.store'

const restaurantId = () => {
  const id = useTenantStore().currentId

  if (!id)
    throw new Error('no restaurant')

  return id
}

const empty = (): ImportResult => ({ created: 0, updated: 0, issues: [] })

const COMPOSANTS_SHEET: ImportSheetSpec = {
  key: 'composants',
  name: 'Composants',
  optional: true,
  columns: [
    { key: 'nom', label: 'Nom', required: true, hint: 'Nom du composant.', example: 'Riz parfumé' },
    { key: 'type', label: 'Type', hint: 'base, sauce, proteine, legume, boisson, garniture, epice ou un mot de votre choix. Vide : base.', example: 'base' },
    { key: 'unite', label: 'Unité', aliases: ['stock_unite'], hint: 'portion, kg, g, L, cl, pièce... Vide : portion.', example: 'kg' },
    { key: 'prix_supplement', label: 'Supplément', aliases: ['prix', 'prix_supplement'], hint: 'Prix demandé si le client le choisit en supplément, en FCFA. Vide : 0.', example: '500' },
    { key: 'stock', label: 'Stock', aliases: ['stock_initial', 'quantite'], hint: 'Quantité en stock à la création (une entrée de stock est enregistrée). Ignorée pour un composant existant : utilisez les mouvements de stock.', example: '25' },
    { key: 'disponible', label: 'Disponible', hint: 'oui ou non. Vide : oui.', example: 'oui' },
    { key: 'description', label: 'Description', hint: 'Précisions libres.', example: 'Riz long grain' },
  ],
}

const RECETTES_SHEET: ImportSheetSpec = {
  key: 'recettes',
  name: 'Recettes',
  optional: true,
  columns: [
    { key: 'plat', label: 'Plat', required: true, aliases: ['nom_plat'], hint: 'Nom d\'un plat de la carte.', example: 'Poulet DG' },
    { key: 'composant', label: 'Composant', required: true, aliases: ['code_composant', 'nom_composant'], hint: 'Nom d\'un composant (ou de la feuille Composants).', example: 'Riz parfumé' },
    { key: 'quantite', label: 'Quantité', hint: 'Quantité utilisée pour une portion. Vide : 1.', example: '0,15' },
    { key: 'unite', label: 'Unité', hint: 'portion, kg, g, L... Vide : portion.', example: 'kg' },
  ],
}

const COMPOSANTS_NOTE = 'Un composant dont le nom existe déjà est mis à jour ; sinon il est créé. Vous pouvez donc réimporter un fichier corrigé sans créer de doublons.'
const RECETTES_NOTE = 'Recettes : le plat doit déjà exister dans la carte ; une ligne plat + composant qui existe déjà voit sa quantité mise à jour.'

async function runComposants(data: ImportData, tick: ImportTick): Promise<ImportResult> {
  const result = empty()
  const records = data.composants ?? []

  if (records.length === 0)
    return result

  const id = restaurantId()
  const existing = new Map((await stockApi.composants(id)).map(item => [normalizeKey(item.nom), item]))

  addCounts(result, await runRows('Composants', records, async (record): Promise<RowOutcome> => {
    const nom = requireText(record, 'nom', 'Nom')
    const type = (record.values.type || '').trim().toLowerCase()
    const unite = record.values.unite || undefined
    const supplement = numberField(record, 'prix_supplement', 'Supplément', { min: 0 })
    const stock = numberField(record, 'stock', 'Stock', { min: 0 })
    const disponible = booleanField(record, 'disponible', 'Disponible')
    const description = record.values.description || undefined
    const found = existing.get(normalizeKey(nom))

    if (found) {
      await stockApi.updateComposant(found.id, {
        type: type || undefined,
        stock_unite: unite,
        prix_supplement: supplement,
        disponible,
        description,
      })

      return 'updated'
    }

    const created = await stockApi.createComposant(id, {
      nom,
      type: type || 'base',
      devise: 'XAF',
      stock_unite: unite ?? 'portion',
      prix_supplement: supplement ?? 0,
      disponible: disponible ?? true,
      description,
    })

    existing.set(normalizeKey(nom), created)

    if (stock)
      await stockApi.addMovement(created.id, { type: 'entree', quantite: stock, notes: 'Import de fichier' })
  }, result.issues, tick))

  return result
}

async function runRecettes(data: ImportData, tick: ImportTick): Promise<ImportResult> {
  const result = empty()
  const records = data.recettes ?? []

  if (records.length === 0)
    return result

  const id = restaurantId()
  const [plats, composants] = await Promise.all([stockApi.plats(id), stockApi.composants(id)])
  const platByName = new Map(plats.map(item => [normalizeKey(item.nom), item.id]))
  const composantByName = new Map(composants.map(item => [normalizeKey(item.nom), item.id]))
  const linesOf = new Map<string, PlatComposant[]>()

  const load = async (platId: string) => {
    if (!linesOf.has(platId))
      linesOf.set(platId, await stockApi.recipe(platId))

    return linesOf.get(platId) ?? []
  }

  addCounts(result, await runRows('Recettes', records, async (record): Promise<RowOutcome> => {
    const platId = platByName.get(normalizeKey(requireText(record, 'plat', 'Plat')))
    const composantId = composantByName.get(normalizeKey(requireText(record, 'composant', 'Composant')))
    const quantite = numberField(record, 'quantite', 'Quantité', { min: 0 }) ?? 1
    const unite = record.values.unite || 'portion'

    if (!platId)
      throw new RowError('Plat', 'Ce plat n\'existe pas dans la carte.')
    if (!composantId)
      throw new RowError('Composant', 'Ce composant n\'existe pas : ajoutez-le dans la feuille Composants.')

    const lines = await load(platId)

    if (lines.some(line => line.composant_id === composantId)) {
      await stockApi.updateRecipeLine(platId, composantId, { quantite, unite })

      return 'updated'
    }

    lines.push(await stockApi.addRecipeLine(platId, { composant_id: composantId, quantite, unite }))
  }, result.issues, tick))

  return result
}

export function composantsImport(): ImportDefinition {
  return {
    title: 'Importer des composants',
    description: 'Téléchargez un modèle vierge, remplissez-le, puis importez vos composants en une fois.',
    fileName: 'modele-import-composants',
    sheets: [COMPOSANTS_SHEET],
    notes: [COMPOSANTS_NOTE],
    run: runComposants,
  }
}

export function recettesImport(): ImportDefinition {
  return {
    title: 'Importer des recettes',
    description: 'Téléchargez un modèle vierge, indiquez pour chaque plat les composants et quantités, puis importez.',
    fileName: 'modele-import-recettes',
    sheets: [RECETTES_SHEET],
    notes: [RECETTES_NOTE],
    run: runRecettes,
  }
}

/** Composants puis recettes dans un seul classeur : les recettes retrouvent les composants tout juste créés. */
export function stockImport(): ImportDefinition {
  const head = {
    title: 'Importer le stock',
    description: 'Un seul classeur pour vos composants et vos fiches techniques.',
    fileName: 'modele-import-stock',
  }

  return combineImports(head, composantsImport(), recettesImport())
}
