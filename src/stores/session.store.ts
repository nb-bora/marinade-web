import { defineStore } from 'pinia'
import type { LoginInput } from '@/api/auth.api'
import { container } from '@/container'
import type { UserResponse } from '@/lib/api/types'

/** Qui est connecté. Les restaurants et leurs droits sont dans le store `tenant`. */
export const useSessionStore = defineStore('session', () => {
  const user = ref<UserResponse | null>(null)
  let restoring: Promise<void> | null = null

  const isAuthenticated = computed(() => user.value !== null)
  const isPlatformAdmin = computed(() => user.value?.role === 'admin')
  const displayName = computed(() => user.value ? `${user.value.first_name} ${user.value.last_name}`.trim() : '')

  const initials = computed(() =>
    user.value ? `${user.value.first_name[0] ?? ''}${user.value.last_name[0] ?? ''}`.toUpperCase() : '',
  )

  /** Retrouve la session au chargement de la page (une seule fois, tous appelants confondus). */
  function restore(): Promise<void> {
    restoring ??= (async () => {
      if (!container.tokens.read())
        return

      try {
        user.value = await container.account.me()
      }
      catch {
        // Jetons refusés et non renouvelables : on repart d'une session vide.
        container.tokens.clear()
        user.value = null
      }
    })()

    return restoring
  }

  /**
   * Ouvre une session. Une erreur `ApiError` dont `details.two_factor_required` est vrai
   * signifie qu'il faut redemander la connexion avec le code de la 2FA.
   */
  async function login(input: LoginInput, remember: boolean): Promise<void> {
    const tokens = await container.auth.login(input)

    container.tokens.write({ accessToken: tokens.access_token, refreshToken: tokens.refresh_token }, remember)

    try {
      user.value = await container.account.me()
      restoring = Promise.resolve()
    }
    catch (error) {
      container.tokens.clear()
      throw error
    }
  }

  /** Fin de session locale (déconnexion, ou jeton définitivement refusé). */
  function end(): void {
    container.tokens.clear()
    user.value = null
    restoring = null
  }

  async function logout(): Promise<void> {
    try {
      await container.auth.logout()
    }
    catch {
      // Le serveur n'a pas pu révoquer les jetons : on quitte quand même localement.
    }

    end()
  }

  function setUser(updated: UserResponse): void {
    user.value = updated
  }

  return { user, isAuthenticated, isPlatformAdmin, displayName, initials, restore, login, logout, end, setUser }
})
