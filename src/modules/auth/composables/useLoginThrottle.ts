import { isApiError } from '@/lib/http/errors'

/**
 * Freine les essais de connexion répétés, côté navigateur : après 3 échecs, le formulaire est
 * bloqué 30 secondes (compte à rebours affiché). Ce n'est qu'un confort : le serveur reste
 * l'autorité et applique sa propre limite.
 */
export const LOGIN_ATTEMPTS_KEY = 'marinade.security.login_attempts'
export const MAX_ATTEMPTS = 3
export const LOCK_SECONDS = 30

interface Stored {
  failures: number
  lockedUntil: number
}

function read(): Stored {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOGIN_ATTEMPTS_KEY) ?? 'null') as Partial<Stored> | null

    return { failures: Number(parsed?.failures) || 0, lockedUntil: Number(parsed?.lockedUntil) || 0 }
  }
  catch {
    return { failures: 0, lockedUntil: 0 }
  }
}

function write(value: Stored): void {
  try {
    if (value.failures === 0 && value.lockedUntil === 0)
      localStorage.removeItem(LOGIN_ATTEMPTS_KEY)
    else
      localStorage.setItem(LOGIN_ATTEMPTS_KEY, JSON.stringify(value))
  }
  catch {
    // Stockage indisponible (navigation privée...) : pas de blocage persistant, le serveur limite quand même.
  }
}

export function useLoginThrottle() {
  const state = ref(read())
  const now = ref(Date.now())
  let timer: ReturnType<typeof setInterval> | undefined

  const remaining = computed(() => Math.max(0, Math.ceil((state.value.lockedUntil - now.value) / 1000)))
  const locked = computed(() => remaining.value > 0)

  function tick() {
    now.value = Date.now()
    if (!locked.value && timer) {
      clearInterval(timer)
      timer = undefined
    }
  }

  function watchLock() {
    now.value = Date.now()
    if (locked.value && !timer)
      timer = setInterval(tick, 1000)
  }

  /** À appeler après un refus du serveur ; ignore les pannes réseau et les demandes de code 2FA. */
  function recordFailure(cause: unknown): void {
    if (isApiError(cause) && (cause.kind === 'network' || cause.kind === 'server'))
      return

    const failures = state.value.failures + 1
    const lock = failures >= MAX_ATTEMPTS

    state.value = { failures: lock ? 0 : failures, lockedUntil: lock ? Date.now() + LOCK_SECONDS * 1000 : 0 }
    write(state.value)
    watchLock()
  }

  function reset(): void {
    state.value = { failures: 0, lockedUntil: 0 }
    write(state.value)
  }

  onMounted(watchLock)
  onBeforeUnmount(() => timer && clearInterval(timer))

  return { locked, remaining, recordFailure, reset }
}
