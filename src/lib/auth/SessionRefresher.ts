import type { TokenStore, Tokens } from './TokenStore'
import { Signal } from '@/lib/events'
import type { UnauthorizedRecovery } from '@/lib/http/HttpClient'

export type RefreshFunction = (refreshToken: string) => Promise<Tokens>

/**
 * Rétablit la session quand le jeton d'accès a expiré.
 *
 * Le jeton de rafraîchissement du back est à usage unique (il est remplacé à chaque
 * usage). Deux requêtes qui reçoivent un 401 en même temps ne doivent donc pas toutes
 * deux le présenter : la seconde échouerait et déconnecterait l'utilisateur à tort.
 * Un seul rafraîchissement est en vol à la fois ; tous les appelants attendent le même.
 */
export class SessionRefresher implements UnauthorizedRecovery {
  /** Émis quand la session est définitivement perdue. */
  readonly expired = new Signal()

  private inFlight: Promise<boolean> | null = null

  constructor(
    private readonly tokens: TokenStore,
    private readonly refresh: RefreshFunction,
  ) {}

  recover(): Promise<boolean> {
    this.inFlight ??= this.run().finally(() => {
      this.inFlight = null
    })

    return this.inFlight
  }

  private async run(): Promise<boolean> {
    const current = this.tokens.read()

    if (!current) {
      this.expired.emit()

      return false
    }

    const persistent = this.tokens.isPersistent()

    try {
      const renewed = await this.refresh(current.refreshToken)

      this.tokens.write(renewed, persistent)

      return true
    }
    catch {
      // Un autre onglet a pu renouveler la session entre-temps : ses jetons sont valides.
      const latest = this.tokens.read()

      if (latest && latest.refreshToken !== current.refreshToken)
        return true

      this.tokens.clear()
      this.expired.emit()

      return false
    }
  }
}
