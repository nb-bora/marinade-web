/**
 * Imports Excel du pressing : articles à l'unité, puis combinaisons (jusqu'à cinq articles par
 * ligne). Comme pour la carte, chaque ligne passe par la route habituelle de création ou de
 * modification : un nom déjà connu est mis à jour, jamais recréé.
 */
import { pressingApi } from './api'
import type { Article, Combinaison } from './types'
import { RowError, booleanField, numberField, requireText, runRows } from '@/lib/sheetImport'
import type { ImportData, ImportDefinition, ImportResult, ImportSheetSpec, ImportTick, RowOutcome } from '@/lib/sheetImport'
import { normalizeKey } from '@/lib/spreadsheet'
import type { ColumnSpec } from '@/lib/spreadsheet'
import { useTenantStore } from '@/stores/tenant.store'

const NOTE = 'Un élément dont le nom existe déjà est mis à jour ; sinon il est créé. Vous pouvez donc réimporter un fichier corrigé sans créer de doublons.'
const MAX_ARTICLES = 5

const restaurantId = () => {
  const id = useTenantStore().currentId

  if (!id)
    throw new Error('no restaurant')

  return id
}

const ARTICLES_SHEET: ImportSheetSpec = {
  key: 'articles',
  name: 'Articles',
  columns: [
    { key: 'nom', label: 'Nom', required: true, aliases: ['article', 'name'], hint: 'Nom de la pièce, 120 caractères au plus.', example: 'Drap' },
    { key: 'prix_unitaire', label: 'Prix unitaire', required: true, aliases: ['prix'], hint: 'Prix de la pièce en FCFA, nombre entier (0 accepté).', example: '1000' },
    { key: 'categorie', label: 'Catégorie', aliases: ['category'], hint: 'Famille libre : Linge de lit, Vêtements...', example: 'Linge de lit' },
    { key: 'actif', label: 'Actif', hint: 'oui ou non. Vide : oui.', example: 'oui' },
  ],
}

const EXAMPLE_ARTICLES = ['Drap', 'Taie d\'oreiller', '', '', '']
const EXAMPLE_QUANTITIES = ['1', '2', '', '', '']

const comboColumns = (): ColumnSpec[] =>
  Array.from({ length: MAX_ARTICLES }, (_, index) => {
    const n = index + 1

    return [
      { key: `article_${n}`, label: `Article ${n}`, hint: n === 1 ? 'Nom d\'un article existant.' : 'Facultatif.', example: EXAMPLE_ARTICLES[index] },
      { key: `quantite_${n}`, label: `Quantité ${n}`, hint: 'Nombre entier, au moins 1. Vide : 1.', example: EXAMPLE_QUANTITIES[index] },
    ]
  }).flat()

const COMBINAISONS_SHEET: ImportSheetSpec = {
  key: 'combinaisons',
  name: 'Combinaisons',
  columns: [
    { key: 'nom', label: 'Nom', required: true, aliases: ['combinaison', 'name'], hint: 'Nom de l\'ensemble, unique.', example: 'Drap + taie' },
    { key: 'prix', label: 'Prix', required: true, hint: 'Prix fixé de l\'ensemble en FCFA, nombre entier.', example: '1500' },
    { key: 'actif', label: 'Actif', hint: 'oui ou non. Vide : oui.', example: 'oui' },
    ...comboColumns(),
  ],
}

const empty = (): ImportResult => ({ created: 0, updated: 0, issues: [] })

export function articlesImport(): ImportDefinition {
  return {
    title: 'Importer des articles',
    description: 'Téléchargez un modèle vierge, remplissez-le, puis importez vos pièces à l\'unité en une fois.',
    fileName: 'modele-import-articles-pressing',
    sheets: [ARTICLES_SHEET],
    notes: [NOTE],
    run: runArticles,
  }
}

export function combinaisonsImport(): ImportDefinition {
  return {
    title: 'Importer des combinaisons',
    description: 'Téléchargez un modèle vierge : chaque ligne est un ensemble de un à cinq articles vendus à prix fixe.',
    fileName: 'modele-import-combinaisons-pressing',
    sheets: [COMBINAISONS_SHEET],
    notes: [NOTE, 'Les articles d\'une combinaison doivent déjà exister : importez d\'abord vos articles.'],
    run: runCombinaisons,
  }
}

async function runArticles(data: ImportData, tick: ImportTick): Promise<ImportResult> {
  const result = empty()
  const records = data.articles ?? []

  if (records.length === 0)
    return result

  const id = restaurantId()
  const existing = new Map<string, Article>((await pressingApi.articles(id)).map(article => [normalizeKey(article.nom), article]))

  const counts = await runRows('Articles', records, async (record): Promise<RowOutcome> => {
    const nom = requireText(record, 'nom', 'Nom')
    const prix = numberField(record, 'prix_unitaire', 'Prix unitaire', { required: true, min: 0, integer: true }) ?? 0
    const categorie = record.values.categorie || null
    const actif = booleanField(record, 'actif', 'Actif')

    if (nom.length > 120)
      throw new RowError('Nom', '120 caractères au plus.')

    const found = existing.get(normalizeKey(nom))

    if (found) {
      existing.set(normalizeKey(nom), await pressingApi.updateArticle(id, found.id, { nom, prix_unitaire: prix, categorie, actif: actif ?? found.actif }))

      return 'updated'
    }

    existing.set(normalizeKey(nom), await pressingApi.createArticle(id, { nom, prix_unitaire: prix, categorie, actif: actif ?? true }))
  }, result.issues, tick)

  result.created += counts.created
  result.updated += counts.updated

  return result
}

async function runCombinaisons(data: ImportData, tick: ImportTick): Promise<ImportResult> {
  const result = empty()
  const records = data.combinaisons ?? []

  if (records.length === 0)
    return result

  const id = restaurantId()
  const articles = new Map<string, Article>((await pressingApi.articles(id)).map(article => [normalizeKey(article.nom), article]))
  const existing = new Map<string, Combinaison>((await pressingApi.combinaisons(id)).map(combo => [normalizeKey(combo.nom), combo]))

  const counts = await runRows('Combinaisons', records, async (record): Promise<RowOutcome> => {
    const nom = requireText(record, 'nom', 'Nom')
    const prix = numberField(record, 'prix', 'Prix', { required: true, min: 0, integer: true }) ?? 0
    const actif = booleanField(record, 'actif', 'Actif')
    const totals = new Map<string, number>()

    for (let n = 1; n <= MAX_ARTICLES; n++) {
      const name = record.values[`article_${n}`] ?? ''

      if (!name)
        continue

      const article = articles.get(normalizeKey(name))
      const quantite = numberField(record, `quantite_${n}`, `Quantité ${n}`, { min: 1, integer: true }) ?? 1

      if (!article)
        throw new RowError(`Article ${n}`, `L'article « ${name} » n'existe pas : importez-le d'abord.`)

      totals.set(article.id, (totals.get(article.id) ?? 0) + quantite)
    }

    if (totals.size === 0)
      throw new RowError('Article 1', 'Indiquez au moins un article.')

    const lignes = [...totals].map(([articleId, quantite]) => ({ article_id: articleId, quantite }))
    const found = existing.get(normalizeKey(nom))

    if (found) {
      existing.set(normalizeKey(nom), await pressingApi.updateCombinaison(id, found.id, { nom, prix, lignes, actif: actif ?? found.actif }))

      return 'updated'
    }

    existing.set(normalizeKey(nom), await pressingApi.createCombinaison(id, { nom, prix, lignes, actif: actif ?? true }))
  }, result.issues, tick)

  result.created += counts.created
  result.updated += counts.updated

  return result
}
