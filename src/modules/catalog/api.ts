import type {
  Boisson,
  BoissonCreate,
  BoissonUpdate,
  Menu,
  MenuCategory,
  MenuCategoryCreate,
  MenuCategoryUpdate,
  MenuCreate,
  MenuUpdate,
  Plat,
  PlatCreate,
  PlatUpdate,
} from './types'
import { container } from '@/container'
import type { HttpClient } from '@/lib/http/HttpClient'

const BASE = '/v1/restaurants'

/** Taille maximale d'une page côté serveur. */
const PAGE = 500

/** La carte du restaurant : menus, catégories, plats et boissons (en-tête `X-Tenant-ID`). */
export class CatalogApi {
  constructor(private readonly http: HttpClient) {}

  /** Parcourt toutes les pages d'une liste : la carte d'un restaurant tient rarement sur une seule. */
  private async all<T>(path: string, signal?: AbortSignal): Promise<T[]> {
    const items: T[] = []

    for (let skip = 0; ; skip += PAGE) {
      const page = await this.http.get<T[]>(path, { signal, query: { skip, limit: PAGE } })

      items.push(...page)
      if (page.length < PAGE)
        return items
    }
  }

  // Menus
  menus(restaurantId: string, signal?: AbortSignal) {
    return this.all<Menu>(`${BASE}/${restaurantId}/menus`, signal)
  }

  createMenu(restaurantId: string, body: MenuCreate) {
    return this.http.post<Menu>(`${BASE}/${restaurantId}/menus`, body)
  }

  updateMenu(menuId: string, body: MenuUpdate) {
    return this.http.put<Menu>(`${BASE}/menus/${menuId}`, body)
  }

  // Catégories
  categories(menuId: string, signal?: AbortSignal) {
    return this.all<MenuCategory>(`${BASE}/menus/${menuId}/categories`, signal)
  }

  createCategory(menuId: string, body: MenuCategoryCreate) {
    return this.http.post<MenuCategory>(`${BASE}/menus/${menuId}/categories`, body)
  }

  updateCategory(categoryId: string, body: MenuCategoryUpdate) {
    return this.http.put<MenuCategory>(`${BASE}/categories/${categoryId}`, body)
  }

  // Plats
  plats(restaurantId: string, signal?: AbortSignal) {
    return this.all<Plat>(`${BASE}/${restaurantId}/plats`, signal)
  }

  plat(platId: string, signal?: AbortSignal) {
    return this.http.get<Plat>(`${BASE}/plats/${platId}`, { signal })
  }

  createPlat(restaurantId: string, body: PlatCreate) {
    return this.http.post<Plat>(`${BASE}/${restaurantId}/plats`, body)
  }

  updatePlat(platId: string, body: PlatUpdate) {
    return this.http.put<Plat>(`${BASE}/plats/${platId}`, body)
  }

  // Boissons
  boissons(restaurantId: string, signal?: AbortSignal) {
    return this.all<Boisson>(`${BASE}/${restaurantId}/boissons`, signal)
  }

  boisson(boissonId: string, signal?: AbortSignal) {
    return this.http.get<Boisson>(`${BASE}/boissons/${boissonId}`, { signal })
  }

  createBoisson(restaurantId: string, body: BoissonCreate) {
    return this.http.post<Boisson>(`${BASE}/${restaurantId}/boissons`, body)
  }

  updateBoisson(boissonId: string, body: BoissonUpdate) {
    return this.http.put<Boisson>(`${BASE}/boissons/${boissonId}`, body)
  }
}

export const catalogApi = new CatalogApi(container.http)
