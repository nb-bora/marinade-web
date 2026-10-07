/**
 * Configuration d'exécution, lue une seule fois.
 *
 * `VITE_API_BASE_URL` : racine de l'API. Par défaut `/api`, que le serveur de
 * développement relaie vers le back (voir vite.config.ts) et qu'un reverse proxy
 * relaie en production : le navigateur ne parle qu'à sa propre origine.
 */
export interface AppConfig {

  /** Racine HTTP de l'API, sans slash final. */
  apiBaseUrl: string

  /** Racine WebSocket de l'API (même hôte que l'API HTTP), sans slash final. */
  wsBaseUrl: string

  /** Intervalle d'actualisation des écrans « en direct », en millisecondes. */
  livePollIntervalMs: number
}

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '')

function toWebSocketBase(httpBase: string): string {
  const absolute = new URL(httpBase, window.location.origin)

  absolute.protocol = absolute.protocol === 'https:' ? 'wss:' : 'ws:'

  return trimTrailingSlash(absolute.toString())
}

export function readConfig(env: ImportMetaEnv = import.meta.env): AppConfig {
  const apiBaseUrl = trimTrailingSlash(env.VITE_API_BASE_URL || '/api')

  return {
    apiBaseUrl,
    wsBaseUrl: toWebSocketBase(apiBaseUrl),
    livePollIntervalMs: Number(env.VITE_LIVE_POLL_INTERVAL_MS) || 10_000,
  }
}
