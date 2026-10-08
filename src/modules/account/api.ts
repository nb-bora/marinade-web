import { container } from '@/container'
import type { HttpClient } from '@/lib/http/HttpClient'

/**
 * Vérification du numéro de téléphone du compte. Ces routes ne dépendent d'aucun restaurant :
 * on n'envoie donc pas `X-Tenant-ID`.
 */
export class PhoneVerificationApi {
  constructor(private readonly http: HttpClient) {}

  /** Envoie un code à 6 chiffres par SMS au téléphone du compte. */
  sendCode() {
    return this.http.post<void>('/v1/auth/send-verification-phone', undefined, { withoutTenant: true })
  }

  verify(code: string) {
    return this.http.post<void>('/v1/auth/verify-phone', { code }, { withoutTenant: true })
  }
}

export const phoneVerificationApi = new PhoneVerificationApi(container.http)
