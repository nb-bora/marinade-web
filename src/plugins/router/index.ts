import type { App } from 'vue'
import type { RouteRecordRaw } from 'vue-router'
import { createRouter, createWebHistory } from 'vue-router'
import { container } from '@/container'
import { createAccessGuard } from '@/lib/router/guards'
import { PATHS, safeRedirect } from '@/lib/router/paths'
import { collectRoutes, discoverFeatures } from '@/lib/module/registry'
import { useSessionStore } from '@/stores/session.store'
import { useTenantStore } from '@/stores/tenant.store'

export const features = discoverFeatures()

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
  })(to)
})

router.afterEach(to => {
  document.title = to.meta.title ? `${to.meta.title} · Marinade` : 'Marinade'
})

export default function (app: App) {
  app.use(router)

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
