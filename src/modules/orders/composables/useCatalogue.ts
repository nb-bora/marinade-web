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
  let inflight: Promise<void> | null = null

  async function load(restaurantId: string): Promise<void> {
    loading.value = true
    error.value = null

    try {
      const [foods, drinks] = await Promise.all([ordersApi.plats(restaurantId), ordersApi.boissons(restaurantId)])

      // Le restaurant a pu changer pendant la requête : on ne garde pas la carte d'un autre.
      if (tenant.currentId !== restaurantId)
        return

      plats.value = foods
      boissons.value = drinks
      loadedFor = restaurantId
    }
    catch (cause) {
      error.value = cause
    }
    finally {
      loading.value = false
      inflight = null
    }
  }

  /**
   * Charge la carte si elle ne l'est pas déjà pour ce restaurant. `force` la recharge : à l'ouverture
   * de l'ajout d'article, pour ne pas proposer un plat devenu indisponible depuis le premier chargement.
   */
  function ensure(force = false): Promise<void> {
    const restaurantId = tenant.currentId

    if (!restaurantId || (!force && loadedFor === restaurantId))
      return Promise.resolve()

    inflight ??= load(restaurantId)

    return inflight
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
