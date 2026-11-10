import type { PaymentStatus } from '@/lib/api/types'
import { PAYMENT_STATUSES } from '@/lib/api/types'
import type { StatusTone } from '@/ui/AppStatusChip.vue'

interface StatusPresentation {
  label: string
  tone: StatusTone
  icon: string
}

/** Comment chaque statut Easy Transact se présente à l'écran. */
const PRESENTATION: Record<PaymentStatus, StatusPresentation> = {
  initiated: { label: 'Initié', tone: 'neutral', icon: 'ri-time-line' },
  pending: { label: 'En attente', tone: 'warning', icon: 'ri-hourglass-line' },
  processing: { label: 'En cours', tone: 'info', icon: 'ri-loader-4-line' },
  success: { label: 'Réussi', tone: 'success', icon: 'ri-checkbox-circle-line' },
  failed: { label: 'Échoué', tone: 'error', icon: 'ri-close-circle-line' },
  timeout: { label: 'Délai dépassé', tone: 'error', icon: 'ri-timer-line' },
  reversed: { label: 'Annulé', tone: 'warning', icon: 'ri-arrow-go-back-line' },
  refunded: { label: 'Remboursé', tone: 'info', icon: 'ri-refund-2-line' },
  expired: { label: 'Expiré', tone: 'neutral', icon: 'ri-calendar-close-line' },
  manual_review: { label: 'À vérifier', tone: 'warning', icon: 'ri-eye-line' },
}

const UNKNOWN: StatusPresentation = { label: 'Inconnu', tone: 'neutral', icon: 'ri-question-line' }

export const isKnownStatus = (status: string): status is PaymentStatus =>
  (PAYMENT_STATUSES as readonly string[]).includes(status)

export const presentStatus = (status: string): StatusPresentation =>
  isKnownStatus(status) ? PRESENTATION[status] : { ...UNKNOWN, label: status }

/** Statuts d'un paiement encore en route : le webhook peut encore arriver. */
export const IN_FLIGHT: readonly PaymentStatus[] = ['initiated', 'pending', 'processing']

export const isInFlight = (status: string) => (IN_FLIGHT as readonly string[]).includes(status)

export const STATUS_OPTIONS = PAYMENT_STATUSES.map(value => ({ value, title: PRESENTATION[value].label }))

export type StatusGroupId = 'all' | 'success' | 'pending' | 'failed' | 'other'

/**
 * Les dix statuts de la passerelle, regroupés en quatre familles que le caissier comprend d'un coup
 * d'œil : réussis, en attente, échecs, à vérifier. `all` ne filtre rien.
 */
export const STATUS_GROUPS: { id: StatusGroupId; title: string; statuses: readonly PaymentStatus[] }[] = [
  { id: 'all', title: 'Toutes', statuses: [] },
  { id: 'success', title: 'Réussies', statuses: ['success'] },
  { id: 'pending', title: 'En attente', statuses: IN_FLIGHT },
  { id: 'failed', title: 'Échecs', statuses: ['failed', 'timeout', 'expired'] },
  { id: 'other', title: 'À vérifier', statuses: ['manual_review', 'reversed', 'refunded'] },
]

export const statusesOfGroup = (id: StatusGroupId): PaymentStatus[] =>
  [...(STATUS_GROUPS.find(group => group.id === id)?.statuses ?? [])]

/** Nombre de transactions d'une famille, d'après le résumé de la période (`by_status`). */
export function countOfGroup(byStatus: Record<string, { count: number }> | undefined, id: StatusGroupId): number {
  if (!byStatus)
    return 0

  if (id === 'all')
    return Object.values(byStatus).reduce((sum, entry) => sum + entry.count, 0)

  return statusesOfGroup(id).reduce((sum, status) => sum + (byStatus[status]?.count ?? 0), 0)
}
