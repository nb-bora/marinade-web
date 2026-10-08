import { catalogApi } from '../api'
import type { CategoryWithMenu, Menu } from '../types'
import { useAsyncData } from '@/composables/useAsyncData'
import { useTenantStore } from '@/stores/tenant.store'

/**
 * Les menus du restaurant courant et leurs catégories, chargés ensemble (une requête
 * de catégories par menu). Recharge seul quand on change de restaurant.
 */
export function useMenus() {
  const tenant = useTenantStore()

  const { data, loading, error, reload, refresh } = useAsyncData(async signal => {
    const restaurantId = tenant.currentId

    if (!restaurantId)
      return { menus: [] as Menu[], categories: [] as CategoryWithMenu[] }

    const menus = await catalogApi.menus(restaurantId, signal)
    const lists = await Promise.all(menus.map(menu => catalogApi.categories(menu.id, signal)))

    const categories = lists.flatMap((list, index) =>
      list.map(category => ({ ...category, menuName: menus[index].name })))

    return { menus, categories }
  }, { watch: [() => tenant.currentId] })

  const menus = computed(() => data.value?.menus ?? [])

  /** Triées par ordre, puis par nom. */
  const categories = computed(() => [...(data.value?.categories ?? [])]
    .sort((a, b) => a.ordre - b.ordre || a.name.localeCompare(b.name, 'fr')))

  const categoriesOf = (menuId: string) => categories.value.filter(category => category.menu_id === menuId)

  const categoryName = (id: string | null | undefined) =>
    categories.value.find(category => category.id === id)?.name ?? null

  return { menus, categories, categoriesOf, categoryName, loading, error, reload, refresh, loaded: computed(() => data.value !== null) }
}
