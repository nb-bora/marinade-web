import { describe, expect, it, vi } from 'vitest'
import type { RouteLocationNormalized } from 'vue-router'
import { createAccessGuard } from './guards'
import type { GuardContext } from './guards'
import { PATHS, safeRedirect } from './paths'
import type { Capability } from '@/lib/api/types'

function route(meta: Record<string, unknown> = {}, fullPath = '/x'): RouteLocationNormalized {
  return { meta, fullPath } as unknown as RouteLocationNormalized
}

function context(overrides: Partial<GuardContext> = {}): GuardContext {
  return {
    restoreSession: async () => {},
    isAuthenticated: () => true,
    isPlatformAdmin: () => false,
    loadRestaurants: async () => {},
    hasRestaurant: () => true,
    can: () => true,
    ...overrides,
  }
}

const run = (ctx: GuardContext, to: RouteLocationNormalized) => createAccessGuard(ctx)(to)

describe('garde d\'accès', () => {
  it('laisse passer une page publique sans rien demander au serveur', async () => {
    const loadRestaurants = vi.fn()

    await expect(run(context({ isAuthenticated: () => false, loadRestaurants }), route({ public: true }))).resolves.toBe(true)
    expect(loadRestaurants).not.toHaveBeenCalled()
  })

  it('renvoie un visiteur vers la connexion en retenant la page demandée', async () => {
    const result = await run(context({ isAuthenticated: () => false }), route({}, '/payments?x=1'))

    expect(result).toEqual({ path: PATHS.login, query: { redirect: '/payments?x=1' } })
  })

  it('ne retient pas l\'accueil comme redirection', async () => {
    const result = await run(context({ isAuthenticated: () => false }), route({}, PATHS.home))

    expect(result).toEqual({ path: PATHS.login, query: {} })
  })

  it('renvoie un utilisateur connecté loin des pages réservées aux visiteurs', async () => {
    await expect(run(context(), route({ guestOnly: true }))).resolves.toEqual({ path: PATHS.home })
    await expect(run(context({ isAuthenticated: () => false }), route({ guestOnly: true }))).resolves.toBe(true)
  })

  it('réserve les pages plateforme aux administrateurs', async () => {
    await expect(run(context(), route({ platformAdmin: true }))).resolves.toEqual({ path: PATHS.forbidden })
    await expect(run(context({ isPlatformAdmin: () => true }), route({ platformAdmin: true }))).resolves.toBe(true)
  })

  it('envoie vers la création du restaurant quand il n\'y en a aucun', async () => {
    await expect(run(context({ hasRestaurant: () => false }), route())).resolves.toEqual({ path: PATHS.setup })
    await expect(run(context({ hasRestaurant: () => false }), route({ withoutRestaurant: true }))).resolves.toBe(true)
  })

  it('refuse une page dont le droit manque', async () => {
    const can = (capability: Capability) => capability !== 'cash_desk'

    await expect(run(context({ can }), route({ capability: 'cash_desk' }))).resolves.toEqual({ path: PATHS.forbidden })
    await expect(run(context({ can }), route({ capability: 'stock' }))).resolves.toBe(true)
  })

  it('signale un serveur injoignable plutôt que de prétendre qu\'il n\'y a pas de restaurant', async () => {
    const unreachable = async () => {
      throw new Error('network')
    }

    const result = await run(context({ loadRestaurants: unreachable }), route())

    expect(result).toEqual({ path: PATHS.unavailable })
  })
})

describe('safeRedirect', () => {
  it.each([
    ['/payments', '/payments'],
    ['/payments?x=1', '/payments?x=1'],
    ['https://evil.example', PATHS.home],
    ['//evil.example', PATHS.home],
    ['javascript:alert(1)', PATHS.home],
    [undefined, PATHS.home],
    [['/a'], PATHS.home],
  ])('%s → %s', (input, expected) => {
    expect(safeRedirect(input)).toBe(expected)
  })
})
