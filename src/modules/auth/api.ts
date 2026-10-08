import { container } from '@/container'
import type { components } from '@/lib/api/schema'
import type { HttpClient } from '@/lib/http/HttpClient'

export type PublicTier = components['schemas']['SubscriptionTierResponse']

export interface PhoneCodeSent {
  message?: string

  /** Renvoyé seulement par un serveur de développement : jamais en production. */
  verification_code?: string
}

/** Routes utiles à l'inscription, hors du client d'authentification partagé. */
export class RegistrationApi {
  constructor(private readonly http: HttpClient) {}

  /** Les offres sont publiques : on peut les présenter avant même d'avoir un compte. */
  tiers(signal?: AbortSignal) {
    return this.http.get<PublicTier[]>('/v1/subscriptions/tiers', { anonymous: true, withoutTenant: true, signal })
  }

  sendPhoneCode() {
    return this.http.post<PhoneCodeSent>('/v1/auth/send-verification-phone', undefined, { withoutTenant: true })
  }

  verifyPhone(code: string) {
    return this.http.post<void>('/v1/auth/verify-phone', { code }, { withoutTenant: true })
  }
}

export const registrationApi = new RegistrationApi(container.http)
