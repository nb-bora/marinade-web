/// <reference types="vite/client" />

import 'vue-router'
import type { RouteLocationRaw } from 'vue-router'
import type { Capability } from '@/lib/api/types'

declare module 'vue-router' {
  interface RouteMeta {
    /** Titre de l'onglet et de l'en-tête de page. */
    title?: string

    /** `blank` : sans menu (connexion...). Par défaut, la mise en page avec menu. */
    layout?: 'blank' | 'default'

    /** Accessible sans être connecté, connecté ou non. */
    public?: boolean

    /** Réservé aux visiteurs : un utilisateur connecté est renvoyé à l'accueil. */
    guestOnly?: boolean

    /** Connecté mais sans restaurant requis (ex. création du premier restaurant). */
    withoutRestaurant?: boolean

    /** Droit requis dans le restaurant courant (calculé par le serveur). */
    capability?: Capability

    /** Réservé aux administrateurs de la plateforme. */
    platformAdmin?: boolean

    layoutWrapperClasses?: string
    navActiveLink?: RouteLocationRaw
  }
}

declare global {
  interface ImportMetaEnv {
    /** Racine de l'API (défaut `/api`). */
    readonly VITE_API_BASE_URL?: string

    /** Intervalle d'actualisation des écrans en direct, en ms (défaut 10000). */
    readonly VITE_LIVE_POLL_INTERVAL_MS?: string
  }
}

export {}
