import { ordersApi } from '../api'
import type { Boisson, CommandeItem, Plat } from '../types'
import { useTenantStore } from '@/stores/tenant.store'

/**
 * Plats et boissons du restaurant, chargés à la première utilisation : une ligne de commande
 * ne porte que l'identifiant de l'article, pas son nom.
 */
export function useCatalogue() {
  const tenant = useTenantStore()

  const plats = ref<Plat[]>([])
  const boissons = ref<Boisson[]>([])
  const loading = ref(false)
  const error = ref<unknown>(null)

  let loadedFor: string | null = null

  async function ensure(): Promise<void> {
    const restaurantId = tenant.currentId

    if (!restaurantId || loadedFor === restaurantId)
      return

    loading.value = true
    error.value = null

    try {
      const [foods, drinks] = await Promise.all([ordersApi.plats(restaurantId), ordersApi.boissons(restaurantId)])

      plats.value = foods
      boissons.value = drinks
      loadedFor = restaurantId
    }
    catch (cause) {
      error.value = cause
    }
    finally {
      loading.value = false
    }
  }

  const names = computed(() => new Map<string, string>([
    ...plats.value.map(plat => [plat.id, plat.nom] as [string, string]),
    ...boissons.value.map(boisson => [boisson.id, boisson.nom] as [string, string]),
  ]))

  /** Nom d'une ligne : celui du plat ou de la boisson, ou de la formule enregistrée avec la ligne. */
  function nameOf(item: CommandeItem): string {
    const id = item.plat_id ?? item.boisson_id

    if (id && names.value.has(id))
      return names.value.get(id)!

    const formula = item.details_jsonb?.combinaison

    if (typeof formula === 'string')
      return formula

    return item.combinaison_id ? 'Formule' : 'Article'
  }

  return { plats, boissons, loading, error, ensure, nameOf }
}
