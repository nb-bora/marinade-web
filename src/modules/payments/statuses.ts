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
