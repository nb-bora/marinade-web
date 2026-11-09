import type { RestaurantCreate } from '@/lib/api/types'

/**
 * L'établissement saisi pendant l'inscription, gardé le temps de recevoir et saisir le code
 * d'activation : le compte n'est utilisable (donc le restaurant créable) qu'après activation.
 *
 * `sessionStorage` : propre à l'onglet, effacé à sa fermeture, jamais envoyé au serveur. Aucun
 * secret n'y est mis (pas de mot de passe). Si le stockage est indisponible, on perd seulement
 * ce confort : l'utilisateur retrouve la page « Finalisons votre établissement ».
 */
export const PENDING_RESTAURANT_KEY = 'marinade.pending_restaurant'

export function savePendingRestaurant(input: RestaurantCreate, storage: Storage = window.sessionStorage): void {
  try {
    storage.setItem(PENDING_RESTAURANT_KEY, JSON.stringify(input))
  }
  catch {
    // Navigation privée ou quota : on continue sans.
  }
}

/** Lit puis efface l'établissement en attente : il ne doit être créé qu'une seule fois. */
export function takePendingRestaurant(storage: Storage = window.sessionStorage): RestaurantCreate | null {
  try {
    const raw = storage.getItem(PENDING_RESTAURANT_KEY)

    storage.removeItem(PENDING_RESTAURANT_KEY)

    if (!raw)
      return null

    const parsed = JSON.parse(raw) as unknown

    if (typeof parsed !== 'object' || parsed === null || typeof (parsed as { name?: unknown }).name !== 'string')
      return null

    return parsed as RestaurantCreate
  }
  catch {
    return null
  }
}
