/** Petit émetteur typé : un événement, des abonnés, aucune dépendance. */
export class Signal<T = void> {
  private readonly listeners = new Set<(payload: T) => void>()

  /** S'abonne ; renvoie la fonction de désabonnement. */
  subscribe(listener: (payload: T) => void): () => void {
    this.listeners.add(listener)

    return () => this.listeners.delete(listener)
  }

  emit(payload: T): void {
    for (const listener of [...this.listeners])
      listener(payload)
  }
}
