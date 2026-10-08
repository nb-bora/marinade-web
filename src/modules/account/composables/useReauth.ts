import { container } from '@/container'
import { useSessionStore } from '@/stores/session.store'

/** Une ré-authentification reste valable quelques minutes, le temps d'une opération sensible. */
const VALID_MS = 5 * 60 * 1000

const verifiedAt = ref(0)

/**
 * Vérifie le mot de passe de l'utilisateur connecté avant une opération sensible. Le serveur
 * n'offre pas de route dédiée : on rejoue la connexion et on jette les jetons reçus.
 */
export function useReauth() {
  const session = useSessionStore()

  async function verify(password: string): Promise<void> {
    if (!session.user)
      throw new Error('no session')

    await container.auth.login({ email: session.user.email, password })
    verifiedAt.value = Date.now()
  }

  const isRecent = () => Date.now() - verifiedAt.value < VALID_MS

  const forget = () => {
    verifiedAt.value = 0
  }

  return { verify, isRecent, forget }
}
