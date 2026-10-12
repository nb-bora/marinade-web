import { defineStore } from 'pinia'
import { useSessionStore } from './session.store'
import { container } from '@/container'
import type { Capability, RestaurantAccess } from '@/lib/api/types'
import type { EstablishmentType } from '@/lib/module/types'

const storageKey = (userId: string) => `marinade.restaurant.${userId}`

function readRemembered(userId: string): string | null {
  try {
    return window.localStorage.getItem(storageKey(userId))
  }
  catch {
    return null
  }
}

function remember(userId: string, restaurantId: string): void {
  try {
    window.localStorage.setItem(storageKey(userId), restaurantId)
  }
  catch {
    // Stockage indisponible (navigation privée...) : le choix ne sera pas retenu, c'est tout.
  }
}

/**
 * Les restaurants de l'utilisateur et celui dans lequel il travaille.
 *
 * Les droits (`capabilities`) viennent du serveur : l'interface n'a aucune table de
 * rôles. Changer de restaurant change l'en-tête `X-Tenant-ID` de toutes les requêtes.
 */
export const useTenantStore = defineStore('tenant', () => {
  const session = useSessionStore()

  const restaurants = ref<RestaurantAccess[]>([])
  const currentId = ref<string | null>(null)
  const loaded = ref(false)
  let loading: Promise<void> | null = null

  const current = computed(() => restaurants.value.find(item => item.restaurant_id === currentId.value) ?? null)
  const capabilities = computed(() => new Set<Capability>(current.value?.capabilities ?? []))

  /** Restaurant ou pressing : le menu, les routes et l'accueil en dépendent. */
  const typeEtablissement = computed<EstablishmentType>(() => current.value?.type_etablissement ?? 'restaurant')
  const hasRestaurant = computed(() => current.value !== null)

  const can = (capability: Capability) => capabilities.value.has(capability)

  function apply(id: string | null): void {
    currentId.value = id
    container.tenant.set(id)
  }

  /** Charge la liste (une seule requête en vol) et choisit le restaurant courant. */
  function load(): Promise<void> {
    loading ??= (async () => {
      restaurants.value = await container.account.access({ limit: 100 })

      const userId = session.user?.id
      const remembered = userId ? readRemembered(userId) : null
      const initial = restaurants.value.find(item => item.restaurant_id === remembered) ?? restaurants.value[0]

      apply(initial?.restaurant_id ?? null)
      loaded.value = true
    })().finally(() => {
      loading = null
    })

    return loading
  }

  function select(id: string): void {
    if (!restaurants.value.some(item => item.restaurant_id === id))
      return

    apply(id)

    if (session.user)
      remember(session.user.id, id)
  }

  /** Recharge la liste, par exemple après la création d'un restaurant. */
  async function reload(): Promise<void> {
    loaded.value = false
    await load()
  }

  function reset(): void {
    restaurants.value = []
    loaded.value = false
    apply(null)
  }

  // Toute fin de session (déconnexion, jeton perdu) efface les restaurants en mémoire :
  // l'utilisateur suivant ne doit jamais voir ceux du précédent.
  watch(() => session.user?.id, (id, previous) => {
    if (id !== previous)
      reset()
  })

  return { restaurants, currentId, current, capabilities, typeEtablissement, hasRestaurant, loaded, can, load, reload, select, reset }
})
