import { describe, expect, it, vi } from 'vitest'
import { ApiError } from './errors'
import { FetchHttpClient, buildUrl } from './FetchHttpClient'
import { BearerTokenDecorator, TenantHeaderDecorator } from '@/lib/auth/decorators'
import { SessionRefresher } from '@/lib/auth/SessionRefresher'
import { MemoryTokenStore } from '@/lib/auth/TokenStore'

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('buildUrl', () => {
  it('omet les valeurs vides et répète les tableaux', () => {
    const url = buildUrl('/api', '/v1/x', {
      status: ['success', 'failed'],
      reference: '',
      cursor: undefined,
      limit: 50,
      from: new Date('2026-10-07T00:00:00.000Z'),
    })

    expect(url).toBe('/api/v1/x?status=success&status=failed&limit=50&from=2026-10-07T00%3A00%3A00.000Z')
  })

  it('encode les caractères spéciaux', () => {
    expect(buildUrl('/api', 'v1/x', { q: 'a&b c' })).toBe('/api/v1/x?q=a%26b%20c')
  })
})

describe('FetchHttpClient', () => {
  it('ajoute le jeton et le restaurant, sauf pour les appels anonymes', async () => {
    const tokens = new MemoryTokenStore()

    tokens.write({ accessToken: 'ACCESS', refreshToken: 'REFRESH' }, false)

    const fetchImpl = vi.fn(async () => json(200, { ok: true }))

    const http = new FetchHttpClient({
      baseUrl: '/api',
      decorators: [new BearerTokenDecorator(tokens), new TenantHeaderDecorator(() => 'tenant-1')],
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    await http.get('/v1/me')
    await http.get('/v1/public', { anonymous: true })
    await http.get('/v1/account', { withoutTenant: true })

    const headersOf = (call: number) => (fetchImpl.mock.calls[call] as unknown as [string, RequestInit])[1].headers as Headers

    expect(headersOf(0).get('Authorization')).toBe('Bearer ACCESS')
    expect(headersOf(0).get('X-Tenant-ID')).toBe('tenant-1')
    expect(headersOf(1).get('Authorization')).toBeNull()
    expect(headersOf(1).get('X-Tenant-ID')).toBeNull()
    expect(headersOf(2).get('Authorization')).toBe('Bearer ACCESS')
    expect(headersOf(2).get('X-Tenant-ID')).toBeNull()
  })

  it('transforme une réponse en échec en ApiError', async () => {
    const http = new FetchHttpClient({
      baseUrl: '/api',
      fetchImpl: (async () => json(403, { detail: 'Forbidden' })) as unknown as typeof fetch,
    })

    await expect(http.get('/v1/x')).rejects.toMatchObject({ status: 403, kind: 'forbidden' })
  })

  it('signale une panne réseau', async () => {
    const http = new FetchHttpClient({
      baseUrl: '/api',
      fetchImpl: (async () => {
        throw new TypeError('Failed to fetch')
      }) as unknown as typeof fetch,
    })

    await expect(http.get('/v1/x')).rejects.toMatchObject({ status: 0, kind: 'network' })
  })

  it('renvoie undefined pour un 204', async () => {
    const http = new FetchHttpClient({
      baseUrl: '/api',
      fetchImpl: (async () => new Response(null, { status: 204 })) as unknown as typeof fetch,
    })

    await expect(http.post('/v1/logout')).resolves.toBeUndefined()
  })
})

describe('récupération d\'un 401', () => {
  function setup(refresh: () => Promise<{ accessToken: string; refreshToken: string }>) {
    const tokens = new MemoryTokenStore()

    tokens.write({ accessToken: 'OLD', refreshToken: 'R1' }, false)

    const refresher = new SessionRefresher(tokens, refresh)

    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) =>
      (init.headers as Headers).get('Authorization') === 'Bearer NEW'
        ? json(200, { ok: true })
        : json(401, { detail: 'expired' }),
    )

    const http = new FetchHttpClient({
      baseUrl: '/api',
      decorators: [new BearerTokenDecorator(tokens)],
      recovery: refresher,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    return { tokens, refresher, http, fetchImpl }
  }

  it('rafraîchit le jeton puis rejoue la requête une fois', async () => {
    const { http, tokens, fetchImpl } = setup(async () => ({ accessToken: 'NEW', refreshToken: 'R2' }))

    await expect(http.get('/v1/x')).resolves.toEqual({ ok: true })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(tokens.read()).toEqual({ accessToken: 'NEW', refreshToken: 'R2' })
  })

  it('n\'effectue qu\'UN rafraîchissement pour plusieurs requêtes simultanées', async () => {
    const refresh = vi.fn(async () => {
      await new Promise(resolve => setTimeout(resolve, 10))

      return { accessToken: 'NEW', refreshToken: 'R2' }
    })

    const { http } = setup(refresh)

    const results = await Promise.all([http.get('/v1/a'), http.get('/v1/b'), http.get('/v1/c')])

    expect(results).toHaveLength(3)

    // Le jeton de rafraîchissement du back est à usage unique : un second essai échouerait.
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('déconnecte et propage l\'erreur quand le rafraîchissement est refusé', async () => {
    const { http, tokens, refresher } = setup(async () => {
      throw new ApiError({ status: 401, message: 'Invalid or expired refresh token' })
    })

    const expired = vi.fn()

    refresher.expired.subscribe(expired)

    await expect(http.get('/v1/x')).rejects.toMatchObject({ status: 401 })
    expect(tokens.read()).toBeNull()
    expect(expired).toHaveBeenCalledTimes(1)
  })

  it('ne tente pas de récupération pour un appel anonyme (connexion ratée)', async () => {
    const refresh = vi.fn()
    const { http } = setup(refresh)

    await expect(http.post('/v1/auth/login', {}, { anonymous: true })).rejects.toMatchObject({ status: 401 })
    expect(refresh).not.toHaveBeenCalled()
  })

  it('accepte les jetons qu\'un autre onglet vient de renouveler', async () => {
    const tokens = new MemoryTokenStore()

    tokens.write({ accessToken: 'OLD', refreshToken: 'R1' }, false)

    const refresher = new SessionRefresher(tokens, async () => {
      // Pendant l'appel, l'autre onglet a déjà fait tourner le jeton.
      tokens.write({ accessToken: 'NEW', refreshToken: 'R2' }, false)
      throw new ApiError({ status: 401, message: 'Invalid or expired refresh token' })
    })

    await expect(refresher.recover()).resolves.toBe(true)
    expect(tokens.read()?.refreshToken).toBe('R2')
  })
})
