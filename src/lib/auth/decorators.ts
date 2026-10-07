import type { TokenStore } from './TokenStore'
import type { PreparedRequest, RequestDecorator } from '@/lib/http/HttpClient'

/** Ajoute `Authorization: Bearer ...` aux requêtes authentifiées. */
export class BearerTokenDecorator implements RequestDecorator {
  constructor(private readonly tokens: TokenStore) {}

  decorate(request: PreparedRequest): void {
    const session = request.anonymous ? null : this.tokens.read()

    if (session)
      request.headers.set('Authorization', `Bearer ${session.accessToken}`)
  }
}

/**
 * Désigne le restaurant de la requête (`X-Tenant-ID`). Un utilisateur qui appartient à
 * plusieurs restaurants DOIT le préciser : c'est ce qui borne la RLS côté base.
 */
export class TenantHeaderDecorator implements RequestDecorator {
  constructor(private readonly currentTenantId: () => string | null) {}

  decorate(request: PreparedRequest): void {
    if (request.anonymous || request.withoutTenant || request.headers.has('X-Tenant-ID'))
      return

    const tenantId = this.currentTenantId()

    if (tenantId)
      request.headers.set('X-Tenant-ID', tenantId)
  }
}
