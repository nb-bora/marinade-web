/** Chemins que le noyau de l'application connaît (gardes, redirections). */
export const PATHS = {
  home: '/dashboard',
  login: '/login',
  setup: '/setup',
  forbidden: '/forbidden',
  unavailable: '/unavailable',
} as const

/**
 * Cible de redirection après connexion, issue de l'URL : n'accepte qu'un chemin interne.
 * Sans cette vérification, `?redirect=https://autre-site` ferait de la page de connexion
 * un tremplin d'hameçonnage.
 */
export function safeRedirect(value: unknown): string {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')
    ? value
    : PATHS.home
}
