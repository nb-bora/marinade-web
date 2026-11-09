import type { RegistrationResponse, TokenResponse, TwoFactorRecoveryCodes, TwoFactorSetup, UserCreate } from '@/lib/api/types'
import type { HttpClient } from '@/lib/http/HttpClient'

export interface LoginInput {
  email: string
  password: string
  twoFactorCode?: string
}

/** Réponse à « renvoyer le code » : identique que le compte existe ou non. */
export interface ResendActivationResult {
  message: string
  resend_available_in_seconds: number
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

  /**
   * Crée un compte NON activé : un code à 6 chiffres part par e-mail. Si l'adresse correspond à un
   * compte jamais activé, le serveur renvoie le code au lieu d'échouer (même forme de réponse).
   */
  register(input: UserCreate) {
    return this.http.post<RegistrationResponse>('/v1/auth/register', input, { anonymous: true, withoutTenant: true })
  }

  /** Active le compte avec le code reçu par e-mail et ouvre la session. */
  activate(email: string, code: string) {
    return this.http.post<TokenResponse>('/v1/auth/activate', { email, code }, { anonymous: true, withoutTenant: true })
  }

  resendActivation(email: string) {
    return this.http.post<ResendActivationResult>('/v1/auth/resend-activation', { email }, { anonymous: true, withoutTenant: true })
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
