/**
 * Contrat du client HTTP.
 *
 * Tout le code applicatif (dépôts d'API, stores) dépend de cette interface et jamais de
 * `fetch` : on peut la remplacer par un faux dans les tests ou par un autre transport
 * sans toucher un seul appelant (principe d'inversion des dépendances).
 */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export type QueryValue = string | number | boolean | Date | null | undefined

export interface RequestOptions {

  /** Paramètres d'URL. `undefined`, `null` et `''` sont omis ; un tableau répète la clé. */
  query?: Record<string, QueryValue | QueryValue[]>

  /** Corps JSON. */
  body?: unknown

  headers?: Record<string, string>
  signal?: AbortSignal

  /** N'envoie pas le jeton d'accès (connexion, inscription...). */
  anonymous?: boolean

  /** N'envoie pas l'en-tête de restaurant (routes qui ne dépendent d'aucun restaurant). */
  withoutTenant?: boolean
}

export interface HttpClient {
  request: <T>(method: HttpMethod, path: string, options?: RequestOptions) => Promise<T>
  get: <T>(path: string, options?: RequestOptions) => Promise<T>
  post: <T>(path: string, body?: unknown, options?: RequestOptions) => Promise<T>
  put: <T>(path: string, body?: unknown, options?: RequestOptions) => Promise<T>
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) => Promise<T>
  delete: <T>(path: string, options?: RequestOptions) => Promise<T>
}

/** Requête prête à partir, que les décorateurs peuvent enrichir. */
export interface PreparedRequest {
  method: HttpMethod
  url: string
  headers: Headers
  body?: string
  anonymous: boolean
  withoutTenant: boolean
}

/** Ajoute quelque chose à chaque requête (jeton, restaurant, langue...). */
export interface RequestDecorator {
  decorate: (request: PreparedRequest) => void | Promise<void>
}

/**
 * Que faire d'un 401 : tenter de rétablir la session. Renvoie `true` si la requête
 * peut être rejouée une fois.
 */
export interface UnauthorizedRecovery {
  recover: () => Promise<boolean>
}
