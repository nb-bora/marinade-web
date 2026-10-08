import { floorApi } from '../api'
import type { CatalogItem, MenuCategory } from '../types'
import { useAsyncData } from '@/composables/useAsyncData'
import { useTenantStore } from '@/stores/tenant.store'

const PLAT_FALLBACK = 'Plats'
const BOISSON_FALLBACK = 'Boissons'

/** Un dessert part au poste « dessert » ; le reste de la cuisine en cuisine. */
const isDessert = (category: string) => /dessert|glace|patisserie|pâtisserie/i.test(category)

/** Catégories des plats : un menu peut en avoir, et la liste des menus peut être refusée à un rôle. */
async function platCategories(restaurantId: string, signal: AbortSignal) {
  const names = new Map<string, MenuCategory>()

  try {
    const menus = await floorApi.menus(restaurantId, signal)
    const lists = await Promise.all(menus.map(menu => floorApi.menuCategories(menu.id, signal)))

    for (const category of lists.flat())
      names.set(category.id, category)
  }
  catch {
    // Sans les catégories, les plats restent commandables, simplement regroupés sous « Plats ».
  }

  return names
}

/** La carte du restaurant courant (plats + boissons), prête pour la prise de commande. */
export function useCatalog() {
  const tenant = useTenantStore()

  return useAsyncData<CatalogItem[]>(async signal => {
    const restaurantId = tenant.currentId

    if (!restaurantId)
      return []

    const [plats, boissons, categories] = await Promise.all([
      floorApi.plats(restaurantId, signal),
      floorApi.boissons(restaurantId, signal),
      platCategories(restaurantId, signal),
    ])

    const dishes = plats.map<CatalogItem>(plat => {
      const category = (plat.category_id && categories.get(plat.category_id)?.name) || PLAT_FALLBACK

      return {
        id: plat.id,
        name: plat.nom,
        description: plat.description ?? null,
        price: Number(plat.prix),
        currency: plat.devise,
        category,
        kind: 'plat',
        station: isDessert(category) ? 'DESSERT' : 'KITCHEN',
        available: plat.disponible,
        alcohol: false,
      }
    })

    const drinks = boissons.map<CatalogItem>(boisson => ({
      id: boisson.id,
      name: boisson.nom,
      description: boisson.description ?? null,
      price: Number(boisson.prix),
      currency: boisson.devise,
      category: boisson.category?.trim() || BOISSON_FALLBACK,
      kind: 'boisson',
      station: 'BAR',
      available: boisson.disponible,
      alcohol: boisson.alcool,
    }))

    return [...dishes, ...drinks]
  }, { watch: [() => tenant.currentId] })
}
