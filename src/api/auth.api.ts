import type { TokenResponse, TwoFactorRecoveryCodes, TwoFactorSetup, UserCreate, UserResponse } from '@/lib/api/types'
import type { HttpClient } from '@/lib/http/HttpClient'

export interface LoginInput {
  email: string
  password: string
  twoFactorCode?: string
}

/** Routes `/v1/auth/*`. Aucune ne dépend d'un restaurant. */
export class AuthApi {
  constructor(private readonly http: HttpClient) {}

  login({ email, password, twoFactorCode }: LoginInput) {
    return this.http.post<TokenResponse>(
      '/v1/auth/login',
      { email, password, two_factor_code: twoFactorCode || undefined },
      { anonymous: true, withoutTenant: true },
    )
  }

  register(input: UserCreate) {
    return this.http.post<UserResponse>('/v1/auth/register', input, { anonymous: true, withoutTenant: true })
  }

  /** Le jeton de rafraîchissement voyage en paramètre d'URL (contrat du back). */
  refresh(refreshToken: string) {
    return this.http.post<TokenResponse>('/v1/auth/refresh', undefined, {
      anonymous: true,
      withoutTenant: true,
      query: { refresh_token: refreshToken },
    })
  }

  logout() {
    return this.http.post<void>('/v1/auth/logout', undefined, { withoutTenant: true })
  }

  forgotPassword(email: string) {
    return this.http.post<void>('/v1/auth/forgot-password', { email }, { anonymous: true, withoutTenant: true })
  }

  resetPassword(token: string, newPassword: string) {
    return this.http.post<void>(
      '/v1/auth/reset-password',
      { token, new_password: newPassword },
      { anonymous: true, withoutTenant: true },
    )
  }

  verifyEmail(token: string) {
    return this.http.post<void>('/v1/auth/verify-email', { token }, { anonymous: true, withoutTenant: true })
  }

  sendVerificationEmail() {
    return this.http.post<void>('/v1/auth/send-verification-email', undefined, { withoutTenant: true })
  }

  setupTwoFactor() {
    return this.http.post<TwoFactorSetup>('/v1/auth/2fa/setup', undefined, { withoutTenant: true })
  }

  confirmTwoFactor(token: string) {
    return this.http.post<void>('/v1/auth/2fa/confirm', { token }, { withoutTenant: true })
  }

  disableTwoFactor(password: string) {
    return this.http.post<void>('/v1/auth/2fa/disable', { password }, { withoutTenant: true })
  }

  regenerateRecoveryCodes(password: string) {
    return this.http.post<TwoFactorRecoveryCodes>('/v1/auth/2fa/recovery-codes', { password }, { withoutTenant: true })
  }
}
