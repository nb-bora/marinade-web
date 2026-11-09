/**
 * Compte à rebours avant de pouvoir redemander un code. Le serveur reste l'autorité (il refuse
 * un envoi trop rapproché) : ce compte à rebours évite seulement un clic inutile.
 */
export function useResendCountdown(initialSeconds = 0) {
  const remaining = ref(0)
  let timer: ReturnType<typeof setInterval> | undefined

  function stop() {
    if (timer !== undefined) {
      clearInterval(timer)
      timer = undefined
    }
  }

  function start(seconds: number) {
    stop()
    remaining.value = Number.isFinite(seconds) ? Math.max(0, Math.ceil(seconds)) : 0

    if (remaining.value === 0)
      return

    timer = setInterval(() => {
      remaining.value = Math.max(0, remaining.value - 1)

      if (remaining.value === 0)
        stop()
    }, 1000)
  }

  start(initialSeconds)
  onScopeDispose(stop)

  const ready = computed(() => remaining.value === 0)

  return { remaining, ready, start }
}
