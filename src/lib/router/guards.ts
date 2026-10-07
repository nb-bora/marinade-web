import type { RouteLocationNormalized, RouteLocationRaw } from 'vue-router'
import { PATHS } from './paths'
import type { Capability } from '@/lib/api/types'

/** Ce que les gardes ont besoin de savoir, sans dépendre des stores eux-mêmes. */
export interface GuardContext {

  /** Retrouve la session au premier chargement. */
  restoreSession: () => Promise<void>
  isAuthenticated: () => boolean
  isPlatformAdmin: () => boolean

  /** Charge les restaurants de l'utilisateur ; rejette si le serveur est injoignable. */
  loadRestaurants: () => Promise<void>
  hasRestaurant: () => boolean
  can: (capability: Capability) => boolean
}

/** Renvoie `true` pour laisser passer, ou la destination vers laquelle rediriger. */
export type AccessGuard = (to: RouteLocationNormalized) => Promise<true | RouteLocationRaw>

/**
 * Garde d'accès, dans l'ordre :
 *   page publique → visiteur seulement → connexion → admin → restaurant → droit.
 * Les droits viennent du serveur ; la garde n'en connaît aucun.
 */
export function createAccessGuard(context: GuardContext): AccessGuard {
  return async to => {
    await context.restoreSession()

    if (to.meta.public)
      return true

    if (to.meta.guestOnly)
      return context.isAuthenticated() ? { path: PATHS.home } : true

    if (!context.isAuthenticated()) {
      return {
        path: PATHS.login,
        query: to.fullPath === PATHS.home ? {} : { redirect: to.fullPath },
      }
    }

    if (to.meta.platformAdmin && !context.isPlatformAdmin())
      return { path: PATHS.forbidden }

    if (to.meta.withoutRestaurant)
      return true

    try {
      await context.loadRestaurants()
    }
    catch {
      return { path: PATHS.unavailable }
    }

    if (!context.hasRestaurant())
      return { path: PATHS.setup }

    if (to.meta.capability && !context.can(to.meta.capability))
      return { path: PATHS.forbidden }

    return true
  }
}
