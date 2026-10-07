export interface Tokens {
  accessToken: string
  refreshToken: string
}

/** Où vivent les jetons de session. Abstraction : navigateur, mémoire (tests)... */
export interface TokenStore {
  read: () => Tokens | null

  /** `persistent` : survit à la fermeture de l'onglet (« Rester connecté »). */
  write: (tokens: Tokens, persistent: boolean) => void
  clear: () => void

  /** Les jetons actuels survivent-ils à la fermeture de l'onglet ? */
  isPersistent: () => boolean
}

const KEY = 'marinade.session'

/**
 * Jetons dans le stockage du navigateur : `localStorage` si l'utilisateur veut rester
 * connecté, `sessionStorage` sinon (effacé à la fermeture de l'onglet). Le jeton d'accès
 * est court (voir ACCESS_TOKEN_EXPIRE_MINUTES) et le jeton de rafraîchissement ne sert
 * qu'une fois : leur vol est borné dans le temps.
 */
export class BrowserTokenStore implements TokenStore {
  constructor(
    private readonly persistentStorage: Storage = window.localStorage,
    private readonly temporaryStorage: Storage = window.sessionStorage,
  ) {}

  read(): Tokens | null {
    for (const storage of [this.temporaryStorage, this.persistentStorage]) {
      const parsed = this.parse(storage)

      if (parsed)
        return parsed
    }

    return null
  }

  write(tokens: Tokens, persistent: boolean): void {
    this.clear()
    ;(persistent ? this.persistentStorage : this.temporaryStorage).setItem(KEY, JSON.stringify(tokens))
  }

  clear(): void {
    this.persistentStorage.removeItem(KEY)
    this.temporaryStorage.removeItem(KEY)
  }

  isPersistent(): boolean {
    return this.persistentStorage.getItem(KEY) !== null
  }

  private parse(storage: Storage): Tokens | null {
    try {
      const value = JSON.parse(storage.getItem(KEY) ?? 'null')

      return value?.accessToken && value?.refreshToken ? value : null
    }
    catch {
      return null
    }
  }
}

/** Version mémoire, pour les tests. */
export class MemoryTokenStore implements TokenStore {
  private tokens: Tokens | null = null
  private persistent = false

  read() {
    return this.tokens
  }

  write(tokens: Tokens, persistent = false) {
    this.tokens = tokens
    this.persistent = persistent
  }

  clear() {
    this.tokens = null
  }

  isPersistent() {
    return this.persistent
  }
}
