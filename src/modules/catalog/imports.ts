/**
 * Imports en masse de la carte : menus, catégories, plats et boissons.
 *
 * Le serveur n'accepte pas ces classeurs en un envoi : chaque ligne passe par la route de création
 * (ou de modification) habituelle. Un élément dont le nom existe déjà est mis à jour, jamais
 * recréé : on peut donc réimporter un fichier corrigé sans doublons.
 */
import { catalogApi } from './api'
import type { MenuCategory } from './types'
import { RowError, addCounts, booleanField, combineImports, numberField, requireText, runRows } from '@/lib/sheetImport'
import type { ImportData, ImportDefinition, ImportResult, ImportSheetSpec, ImportTick, RowOutcome } from '@/lib/sheetImport'
import { normalizeKey } from '@/lib/spreadsheet'
import type { SheetRecord } from '@/lib/spreadsheet'
import { useTenantStore } from '@/stores/tenant.store'

const restaurantId = () => {
  const id = useTenantStore().currentId

  if (!id)
    throw new Error('no restaurant')

  return id
}

const empty = (): ImportResult => ({ created: 0, updated: 0, issues: [] })

const UPSERT_NOTE = 'Un élément dont le nom existe déjà est mis à jour ; sinon il est créé. Vous pouvez donc réimporter un fichier corrigé sans créer de doublons.'

// --- Menus -------------------------------------------------------------------------------------

const MENUS_SHEET: ImportSheetSpec = {
  key: 'menus',
  name: 'Menus',
  optional: true,
  columns: [
    { key: 'nom', label: 'Nom', required: true, aliases: ['name', 'menu'], hint: 'Nom du menu.', example: 'Carte du midi' },
    { key: 'description', label: 'Description', hint: 'Une phrase pour présenter le menu.', example: 'Les plats servis de 12 h à 15 h' },
    { key: 'actif', label: 'Actif', hint: 'oui ou non. Vide : oui.', example: 'oui' },
  ],
}

const CATEGORIES_SHEET: ImportSheetSpec = {
  key: 'categories',
  name: 'Catégories',
  optional: true,
  columns: [
    { key: 'menu', label: 'Menu', required: true, hint: 'Nom d\'un menu existant ou de la feuille Menus.', example: 'Carte du midi' },
    { key: 'nom', label: 'Nom', required: true, aliases: ['name', 'categorie'], hint: 'Nom de la catégorie.', example: 'Entrées' },
    { key: 'ordre', label: 'Ordre', aliases: ['position'], hint: 'Rang dans le menu (0 en premier). Vide : à la suite des autres.', example: '0' },
  ],
}

async function runMenus(data: ImportData, tick: ImportTick): Promise<ImportResult> {
  const result = empty()
  const records = data.menus ?? []

  if (records.length === 0)
    return result

  const id = restaurantId()
  const existing = new Map((await catalogApi.menus(id)).map(menu => [normalizeKey(menu.name), menu]))
  const once = uniqueInSheet()

  addCounts(result, await runRows('Menus', records, async (record): Promise<RowOutcome> => {
    const name = requireText(record, 'nom', 'Nom')

    once(name, record.row)

    const description = record.values.description || undefined
    const actif = booleanField(record, 'actif', 'Actif')
    const found = existing.get(normalizeKey(name))

    if (found) {
      await catalogApi.updateMenu(found.id, { name, description, actif })

      return 'updated'
    }

    existing.set(normalizeKey(name), await catalogApi.createMenu(id, { name, description, actif: actif ?? true }))
  }, result.issues, tick))

  return result
}

async function runCategories(data: ImportData, tick: ImportTick): Promise<ImportResult> {
  const result = empty()
  const records = data.categories ?? []

  if (records.length === 0)
    return result

  const menus = new Map((await catalogApi.menus(restaurantId())).map(menu => [normalizeKey(menu.name), menu]))
  const categoriesOf = new Map<string, MenuCategory[]>()
  const once = uniqueInSheet()

  const load = async (menuId: string) => {
    if (!categoriesOf.has(menuId))
      categoriesOf.set(menuId, await catalogApi.categories(menuId))

    return categoriesOf.get(menuId) ?? []
  }

  addCounts(result, await runRows('Catégories', records, async (record): Promise<RowOutcome> => {
    const menu = menus.get(normalizeKey(requireText(record, 'menu', 'Menu')))
    const name = requireText(record, 'nom', 'Nom')
    const ordre = numberField(record, 'ordre', 'Ordre', { min: 0, integer: true })

    if (!menu)
      throw new RowError('Menu', 'Ce menu n\'existe pas : ajoutez-le dans la feuille Menus.')

    once(`${menu.id}|${name}`, record.row)

    const siblings = await load(menu.id)
    const found = siblings.find(category => normalizeKey(category.name) === normalizeKey(name))

    if (found) {
      await catalogApi.updateCategory(found.id, { name, ordre })

      return 'updated'
    }

    const next = siblings.length ? Math.max(...siblings.map(category => category.ordre)) + 1 : 0

    siblings.push(await catalogApi.createCategory(menu.id, { name, ordre: ordre ?? next }))
  }, result.issues, tick))

  return result
}

export function menusImport(): ImportDefinition {
  return {
    title: 'Importer des menus',
    description: 'Téléchargez un modèle vierge, remplissez-le, puis importez vos menus et leurs catégories.',
    fileName: 'modele-import-menus',
    sheets: [MENUS_SHEET, CATEGORIES_SHEET],
    notes: [UPSERT_NOTE],
    async run(data, tick) {
      const menus = await runMenus(data, tick)
      const categories = await runCategories(data, tick)

      return {
        created: menus.created + categories.created,
        updated: menus.updated + categories.updated,
        issues: [...menus.issues, ...categories.issues],
      }
    },
  }
}

// --- Plats et boissons --------------------------------------------------------------------------

const PLATS_SHEET: ImportSheetSpec = {
  key: 'plats',
  name: 'Plats',
  optional: true,
  columns: [
    { key: 'nom', label: 'Nom', required: true, hint: 'Nom du plat.', example: 'Poulet DG' },
    { key: 'prix', label: 'Prix', required: true, hint: 'Prix en FCFA, au moins 1.', example: '4500' },
    { key: 'description', label: 'Description', hint: 'Texte affiché au serveur.', example: 'Poulet et plantains mûrs sautés' },
    { key: 'code', label: 'Code', hint: 'Votre référence interne (facultatif).', example: 'PL-001' },
    { key: 'disponible', label: 'Disponible', hint: 'oui ou non. Vide : oui.', example: 'oui' },
    { key: 'temps_preparation', label: 'Temps de préparation', aliases: ['temps'], hint: 'En minutes, nombre entier.', example: '20' },
    { key: 'categorie', label: 'Catégorie', aliases: ['category'], hint: 'Nom d\'une catégorie de menu qui existe déjà.', example: 'Plats' },
    { key: 'menu', label: 'Menu', aliases: ['carte'], hint: 'À renseigner seulement si la catégorie existe dans plusieurs menus.', example: 'Carte du midi' },
  ],
}

const BOISSONS_SHEET: ImportSheetSpec = {
  key: 'boissons',
  name: 'Boissons',
  optional: true,
  columns: [
    { key: 'nom', label: 'Nom', required: true, hint: 'Nom de la boisson.', example: 'Jus de gingembre' },
    { key: 'prix', label: 'Prix', required: true, hint: 'Prix en FCFA, au moins 1.', example: '1000' },
    { key: 'description', label: 'Description', hint: 'Texte affiché au serveur.', example: 'Fait maison, 33 cl' },
    { key: 'code', label: 'Code', hint: 'Votre référence interne (facultatif).', example: 'BO-001' },
    { key: 'disponible', label: 'Disponible', hint: 'oui ou non. Vide : oui.', example: 'oui' },
    { key: 'alcool', label: 'Alcool', hint: 'oui ou non. Vide : non.', example: 'non' },
    { key: 'categorie', label: 'Catégorie', aliases: ['category'], hint: 'Famille libre : Jus, Bières, Vins...', example: 'Jus' },
  ],
}

interface CategoryChoice {
  category: MenuCategory
  menu: string
}

/** Toutes les catégories, par nom, avec le menu qui les porte : une même catégorie peut exister dans plusieurs menus. */
async function categoriesByName(id: string) {
  const menus = await catalogApi.menus(id)
  const lists = await Promise.all(menus.map(menu => catalogApi.categories(menu.id).then(categories => ({ menu, categories }))))
  const byName = new Map<string, CategoryChoice[]>()

  for (const { menu, categories } of lists) {
    for (const category of categories) {
      const key = normalizeKey(category.name)

      byName.set(key, [...(byName.get(key) ?? []), { category, menu: menu.name }])
    }
  }

  return byName
}

/**
 * Un nom ne doit figurer qu'une fois par feuille : sinon la seconde ligne écraserait la première.
 * Renvoie la fonction qui enregistre un nom et refuse le doublon, en citant la ligne d'origine.
 */
export function uniqueInSheet() {
  const rows = new Map<string, number>()

  return (nom: string, row: number) => {
    const key = normalizeKey(nom)
    const first = rows.get(key)

    if (first !== undefined)
      throw new RowError('Nom', `Ce nom figure déjà dans le fichier (ligne ${first}). Gardez une seule ligne par article.`)

    rows.set(key, row)
  }
}

/** Le prix maximal accepté par le serveur (Numeric(10, 2)). */
const PRIX_MAX = 99_999_999.99

/**
 * La catégorie d'un plat : retrouvée par nom. Si le nom existe dans plusieurs menus, la colonne « menu »
 * désigne lequel ; sans elle, l'ambiguïté est signalée plutôt que de deviner.
 */
export function resolveCategory(record: SheetRecord, categories: Map<string, CategoryChoice[]>): MenuCategory | undefined {
  const categoryName = record.values.categorie
  const menuName = record.values.menu

  if (!categoryName) {
    if (menuName)
      throw new RowError('Catégorie', 'Renseignez la catégorie du plat, ou retirez le menu.')

    return undefined
  }

  const candidates = categories.get(normalizeKey(categoryName)) ?? []
  const scoped = menuName ? candidates.filter(choice => normalizeKey(choice.menu) === normalizeKey(menuName)) : candidates

  if (scoped.length === 0) {
    throw new RowError('Catégorie', menuName
      ? 'Cette catégorie n\'existe pas dans ce menu.'
      : 'Cette catégorie n\'existe pas : ajoutez-la dans la feuille Catégories de l\'import des menus.')
  }

  if (scoped.length > 1)
    throw new RowError('Catégorie', 'Plusieurs menus ont une catégorie de ce nom : précisez le menu dans la colonne « menu ».')

  return scoped[0]?.category
}

export function platsImport(): ImportDefinition {
  return {
    title: 'Importer des plats',
    description: 'Téléchargez un modèle vierge, remplissez-le, puis importez vos plats en une fois.',
    fileName: 'modele-import-plats',
    sheets: [PLATS_SHEET],
    notes: [UPSERT_NOTE],
    run: runPlats,
  }
}

export function boissonsImport(): ImportDefinition {
  return {
    title: 'Importer des boissons',
    description: 'Téléchargez un modèle vierge, remplissez-le, puis importez vos boissons en une fois.',
    fileName: 'modele-import-boissons',
    sheets: [BOISSONS_SHEET],
    notes: [UPSERT_NOTE],
    run: runBoissons,
  }
}

async function runPlats(data: ImportData, tick: ImportTick): Promise<ImportResult> {
  const result = empty()
  const records = data.plats ?? []

  if (records.length === 0)
    return result

  const id = restaurantId()
  const existing = new Map((await catalogApi.plats(id)).map(plat => [normalizeKey(plat.nom), plat]))
  const categories = records.some(record => record.values.categorie) ? await categoriesByName(id) : new Map<string, CategoryChoice[]>()
  const once = uniqueInSheet()

  addCounts(result, await runRows('Plats', records, async (record): Promise<RowOutcome> => {
    const nom = requireText(record, 'nom', 'Nom')

    once(nom, record.row)

    const prix = numberField(record, 'prix', 'Prix', { required: true, min: 1, max: PRIX_MAX }) ?? 0
    const tempsPreparation = numberField(record, 'temps_preparation', 'Temps de préparation', { min: 0, integer: true })
    const disponible = booleanField(record, 'disponible', 'Disponible')
    const description = record.values.description || undefined
    const code = record.values.code || undefined
    const category = resolveCategory(record, categories)

    const found = existing.get(normalizeKey(nom))

    if (found) {
      await catalogApi.updatePlat(found.id, {
        prix,
        description,
        disponible,
        temps_preparation: tempsPreparation,
        category_id: category?.id,
        attributs_jsonb: code ? { ...found.attributs_jsonb, code } : undefined,
      })

      return 'updated'
    }

    existing.set(normalizeKey(nom), await catalogApi.createPlat(id, {
      nom,
      prix,
      description,
      disponible,
      temps_preparation: tempsPreparation,
      category_id: category?.id,
      attributs_jsonb: code ? { code } : undefined,
    }))
  }, result.issues, tick))

  return result
}

async function runBoissons(data: ImportData, tick: ImportTick): Promise<ImportResult> {
  const result = empty()
  const records = data.boissons ?? []

  if (records.length === 0)
    return result

  const id = restaurantId()
  const existing = new Map((await catalogApi.boissons(id)).map(boisson => [normalizeKey(boisson.nom), boisson]))
  const once = uniqueInSheet()

  addCounts(result, await runRows('Boissons', records, async (record): Promise<RowOutcome> => {
    const nom = requireText(record, 'nom', 'Nom')

    once(nom, record.row)

    const prix = numberField(record, 'prix', 'Prix', { required: true, min: 1, max: PRIX_MAX }) ?? 0
    const disponible = booleanField(record, 'disponible', 'Disponible')
    const alcool = booleanField(record, 'alcool', 'Alcool')
    const description = record.values.description || undefined
    const category = record.values.categorie || undefined
    const code = record.values.code || undefined
    const found = existing.get(normalizeKey(nom))

    if (found) {
      await catalogApi.updateBoisson(found.id, {
        prix,
        description,
        disponible,
        alcool,
        category,
        attributs_jsonb: code ? { ...found.attributs_jsonb, code } : undefined,
      })

      return 'updated'
    }

    existing.set(normalizeKey(nom), await catalogApi.createBoisson(id, {
      nom,
      prix,
      description,
      disponible,
      alcool,
      category,
      attributs_jsonb: code ? { code } : undefined,
    }))
  }, result.issues, tick))

  return result
}

/** Toute la carte dans un seul classeur : menus, catégories, plats puis boissons (dans cet ordre). */
export function catalogImport(): ImportDefinition {
  const head = {
    title: 'Importer la carte',
    description: 'Un seul classeur pour vos menus, vos catégories, vos plats et vos boissons.',
    fileName: 'modele-import-carte',
  }

  return combineImports(head, menusImport(), platsImport(), boissonsImport())
}
