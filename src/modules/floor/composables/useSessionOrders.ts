import type { Ref } from 'vue'
import type { SentOrder } from '../types'

const keyOf = (sessionId: string) => `marinade.floor.orders.${sessionId}`

function read(sessionId: string): SentOrder[] {
  try {
    const raw = window.localStorage.getItem(keyOf(sessionId))
    const parsed: unknown = raw ? JSON.parse(raw) : []

    return Array.isArray(parsed) ? parsed as SentOrder[] : []
  }
  catch {
    return []
  }
}

function write(sessionId: string, orders: SentOrder[]) {
  try {
    window.localStorage.setItem(keyOf(sessionId), JSON.stringify(orders))
  }
  catch {
    // Stockage indisponible : l'addition reste exacte (elle vient du serveur), seul l'historique local est perdu.
  }
}

/**
 * Commandes passées depuis cet appareil pour une session.
 *
 * Le back ne sait pas lister les commandes d'une session : seule l'addition (facture)
 * est lisible. On garde donc, dans ce navigateur, ce que la réponse de chaque commande a
 * renvoyé, pour que le serveur voie ce qu'il a envoyé en cuisine.
 */
export function useSessionOrders(sessionId: Ref<string>) {
  const orders = ref<SentOrder[]>(read(sessionId.value))

  watch(sessionId, id => {
    orders.value = read(id)
  })

  function add(order: SentOrder) {
    orders.value = [order, ...orders.value.filter(known => known.id !== order.id)]
    write(sessionId.value, orders.value)
  }

  function forget(id: string) {
    try {
      window.localStorage.removeItem(keyOf(id))
    }
    catch {
      // Rien à faire : l'entrée sera simplement ignorée.
    }
  }

  return { orders, add, forget }
}
