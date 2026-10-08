import { floorApi } from '../api'
import type { Invoice } from '../types'

/**
 * Le back répond 404 à « facture de la session » tant qu'aucune commande n'a été passée, et le
 * plan de salle relit ces factures toutes les quelques secondes. Une session que l'on sait
 * sans facture n'est donc relue qu'une fois par minute (sauf commande passée d'ici : voir
 * `markOrdered`), ce qui évite des centaines de 404 pour rien.
 */
const RECHECK_MS = 60_000

const emptySince = new Map<string, number>()

/** Une session vient d'être ouverte : inutile de chercher sa facture. */
export const markEmpty = (sessionId: string) => emptySince.set(sessionId, Date.now())

/** Une commande vient d'y être envoyée : la facture existe. */
export const markOrdered = (sessionId: string) => emptySince.delete(sessionId)

export async function sessionInvoice(restaurantId: string, sessionId: string, signal?: AbortSignal): Promise<Invoice | null> {
  const checkedAt = emptySince.get(sessionId)

  if (checkedAt !== undefined && Date.now() - checkedAt < RECHECK_MS)
    return null

  const invoice = await floorApi.sessionInvoice(restaurantId, sessionId, signal)

  if (invoice)
    emptySince.delete(sessionId)
  else
    emptySince.set(sessionId, Date.now())

  return invoice
}
