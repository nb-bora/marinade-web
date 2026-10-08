import type { Ref } from 'vue'
import type { OrderedLine } from '../types'

/**
 * Le back ne sait pas lister les commandes d'une session : seule l'addition (facture) est lisible.
 * Le module « salle » garde, dans ce navigateur, ce que chaque commande contenait ; on le lit ici,
 * en lecture seule et sans rien supposer : une entrée inattendue est ignorée.
 */
const keyOf = (sessionId: string) => `marinade.floor.orders.${sessionId}`

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function read(sessionId: string): OrderedLine[] {
  try {
    const raw = window.localStorage.getItem(keyOf(sessionId))
    const orders: unknown = raw ? JSON.parse(raw) : []
    const totals = new Map<string, number>()

    if (!Array.isArray(orders))
      return []

    for (const order of orders) {
      if (!isRecord(order) || order.status === 'CANCELLED' || !Array.isArray(order.lines))
        continue

      for (const line of order.lines) {
        if (isRecord(line) && typeof line.name === 'string' && typeof line.quantity === 'number')
          totals.set(line.name, (totals.get(line.name) ?? 0) + line.quantity)
      }
    }

    return [...totals].map(([name, quantity]) => ({ name, quantity }))
  }
  catch {
    return []
  }
}

/** Articles commandés depuis cet appareil pour la session (vide si inconnus). */
export function useOrderedLines(sessionId: Ref<string>) {
  const lines = ref<OrderedLine[]>(read(sessionId.value))

  watch(sessionId, id => {
    lines.value = read(id)
  })

  const reread = () => {
    lines.value = read(sessionId.value)
  }

  return { lines, reread }
}
