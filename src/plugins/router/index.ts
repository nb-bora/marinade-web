import type { App } from 'vue'
import type { RouteRecordRaw } from 'vue-router'
import { createRouter, createWebHistory } from 'vue-router'
import { container } from '@/container'
import { createAccessGuard } from '@/lib/router/guards'
import { PATHS, safeRedirect } from '@/lib/router/paths'
import type { EstablishmentType } from '@/lib/module/types'
import { collectRoutes, discoverFeatures, homePaths } from '@/lib/module/registry'
import { useSessionStore } from '@/stores/session.store'
import { useTenantStore } from '@/stores/tenant.store'
import { useToast } from '@/stores/toast.store'

export const features = discoverFeatures()

const homes = homePaths(features)

const homeFor = (type: EstablishmentType) => homes[type] ?? PATHS.home

const WRONG_ESTABLISHMENT = {
  restaurant: 'Cette page est réservée aux pressings : votre établissement est un restaurant.',
  pressing: 'Cette page est réservée aux restaurants : votre établissement est un pressing.',
} as const

function buildRoutes(): RouteRecordRaw[] {
  const { default: withMenu, blank } = collectRoutes(features)

  return [
    { path: '/', redirect: PATHS.home },
    { path: '/', component: () => import('@/layouts/default.vue'), children: withMenu },
    { path: '/', component: () => import('@/layouts/blank.vue'), children: blank },
  ]
}

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: buildRoutes(),
  scrollBehavior: () => ({ top: 0 }),
})

router.beforeEach(to => {
  const session = useSessionStore()
  const tenant = useTenantStore()

  return createAccessGuard({
    restoreSession: () => session.restore(),
    isAuthenticated: () => session.isAuthenticated,
    isPlatformAdmin: () => session.isPlatformAdmin,
    loadRestaurants: () => tenant.loaded ? Promise.resolve() : tenant.load(),
    hasRestaurant: () => tenant.hasRestaurant,
    can: capability => tenant.can(capability),
    establishment: () => tenant.typeEtablissement,
    homeFor,

    // `wanted` est le type de la page : on prévient l'utilisateur de l'autre type.
    onWrongEstablishment: (_type, wanted) => useToast().info(WRONG_ESTABLISHMENT[wanted === 'pressing' ? 'restaurant' : 'pressing']),
  })(to)
})

router.afterEach(to => {
  document.title = to.meta.title ? `${to.meta.title} · Marinade` : 'Marinade'
})

export default function (app: App) {
  app.use(router)

  // Changer d'établissement (restaurant → pressing) depuis une page de l'autre type : retour à l'accueil.
  watch(() => useTenantStore().typeEtablissement, type => {
    const wanted = router.currentRoute.value.meta.etablissement

    if (wanted && wanted !== type)
      router.replace({ path: homeFor(type) })
  })

  // Session définitivement perdue (jeton de rafraîchissement refusé) : retour à la connexion
  // en gardant la page où l'on était pour y revenir après reconnexion.
  container.refresher.expired.subscribe(() => {
    useSessionStore().end()

    const here = router.currentRoute.value

    if (here.meta.public || here.meta.guestOnly)
      return

    router.replace({ path: PATHS.login, query: { redirect: safeRedirect(here.fullPath) } })
  })
}
