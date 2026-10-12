/**
 * Suivi de la dernière synchronisation réussie d'un écran qui se rafraîchit seul. Un échec silencieux
 * (les données précédentes restent affichées) est signalé, pour ne pas laisser des données périmées
 * sans le dire.
 */
export function useSyncStatus() {
  const lastSync = ref<Date | null>(null)
  const failed = ref(false)

  /** Enveloppe une lecture : `signal` évite de compter comme échec une requête annulée volontairement. */
  function track<T>(request: Promise<T>, signal: AbortSignal): Promise<T> {
    return request.then(value => {
      lastSync.value = new Date()
      failed.value = false

      return value
    }, (cause: unknown) => {
      if (!signal.aborted)
        failed.value = true

      throw cause
    })
  }

  return { lastSync, failed, track }
}
