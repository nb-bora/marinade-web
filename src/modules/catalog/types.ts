import type { components } from '@/lib/api/schema'

type Schemas = components['schemas']

export type Menu = Schemas['MenuResponse']
export type MenuCreate = Schemas['MenuCreate']
export type MenuUpdate = Schemas['MenuUpdate']

export type MenuCategory = Schemas['MenuCategoryResponse']
export type MenuCategoryCreate = Schemas['MenuCategoryCreate']
export type MenuCategoryUpdate = Schemas['MenuCategoryUpdate']

export type Plat = Schemas['PlatResponse']

/** Seuls le nom et le prix sont obligatoires : le serveur fixe le reste par défaut. */
export type PlatCreate = Pick<Schemas['PlatCreate'], 'nom' | 'prix'> & Partial<Omit<Schemas['PlatCreate'], 'nom' | 'prix'>>
export type PlatUpdate = Schemas['PlatUpdate']

export type Boisson = Schemas['BoissonResponse']
export type BoissonCreate = Pick<Schemas['BoissonCreate'], 'nom' | 'prix'> & Partial<Omit<Schemas['BoissonCreate'], 'nom' | 'prix'>>
export type BoissonUpdate = Schemas['BoissonUpdate']

/** Une catégorie accompagnée du menu qui la porte (pour les filtres et les listes). */
export interface CategoryWithMenu extends MenuCategory {
  menuName: string
}
