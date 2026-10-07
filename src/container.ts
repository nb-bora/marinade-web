/**
 * Racine de composition : le SEUL endroit qui assemble les implémentations concrètes.
 *
 * Tout le reste reçoit des interfaces (`HttpClient`, `TokenStore`...) ou importe les
 * dépôts d'ici. Les tests fabriquent leur propre conteneur avec `createContainer`.
 */
import { AccountApi } from '@/api/account.api'
import { AuthApi } from '@/api/auth.api'
import { PaymentsApi } from '@/api/payments.api'
import { BearerTokenDecorator, TenantHeaderDecorator } from '@/lib/auth/decorators'
import { SessionRefresher } from '@/lib/auth/SessionRefresher'
import { TenantContext } from '@/lib/auth/TenantContext'
import { BrowserTokenStore } from '@/lib/auth/TokenStore'
import type { TokenStore } from '@/lib/auth/TokenStore'
import { readConfig } from '@/lib/config/env'
import type { AppConfig } from '@/lib/config/env'
import { FetchHttpClient } from '@/lib/http/FetchHttpClient'
import type { HttpClient } from '@/lib/http/HttpClient'

export interface Container {
  config: AppConfig
  tokens: TokenStore
  tenant: TenantContext
  refresher: SessionRefresher
  http: HttpClient
  auth: AuthApi
  account: AccountApi
  payments: PaymentsApi
}

export interface ContainerOverrides {
  config?: AppConfig
  tokens?: TokenStore
  fetchImpl?: typeof fetch
}

export function createContainer(overrides: ContainerOverrides = {}): Container {
  const config = overrides.config ?? readConfig()
  const tokens = overrides.tokens ?? new BrowserTokenStore()
  const tenant = new TenantContext()

  // Le rafraîchissement passe par un client à part, sans récupération : un 401 pendant
  // un rafraîchissement ne doit pas en déclencher un autre.
  const bare = new FetchHttpClient({ baseUrl: config.apiBaseUrl, fetchImpl: overrides.fetchImpl })

  const refresher = new SessionRefresher(tokens, async refreshToken => {
    const renewed = await new AuthApi(bare).refresh(refreshToken)

    return { accessToken: renewed.access_token, refreshToken: renewed.refresh_token }
  })

  const http = new FetchHttpClient({
    baseUrl: config.apiBaseUrl,
    decorators: [new BearerTokenDecorator(tokens), new TenantHeaderDecorator(() => tenant.id)],
    recovery: refresher,
    fetchImpl: overrides.fetchImpl,
  })

  return {
    config,
    tokens,
    tenant,
    refresher,
    http,
    auth: new AuthApi(http),
    account: new AccountApi(http),
    payments: new PaymentsApi(http),
  }
}

export const container = createContainer()
