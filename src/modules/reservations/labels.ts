import type { StatusTone } from '@/ui/AppStatusChip.vue'

export const RESERVATION_STATUSES = ['pending', 'confirmed', 'checked_in', 'completed', 'cancelled', 'no_show'] as const

export type ReservationStatusId = typeof RESERVATION_STATUSES[number]

type ThemeColor = 'primary' | 'success' | 'warning' | 'error' | 'info' | 'secondary'

interface StatusPresentation {
  label: string
  tone: StatusTone

  /** Couleur du thème pour les blocs du calendrier. */
  color: ThemeColor
  icon: string
}

/** Comment chaque statut de réservation se présente à l'écran. */
const PRESENTATION: Record<ReservationStatusId, StatusPresentation> = {
  pending: { label: 'En attente', tone: 'warning', color: 'warning', icon: 'ri-time-line' },
  confirmed: { label: 'Confirmée', tone: 'info', color: 'info', icon: 'ri-checkbox-circle-line' },
  checked_in: { label: 'Arrivée', tone: 'success', color: 'success', icon: 'ri-user-received-line' },
  completed: { label: 'Terminée', tone: 'neutral', color: 'secondary', icon: 'ri-flag-line' },
  cancelled: { label: 'Annulée', tone: 'error', color: 'error', icon: 'ri-close-circle-line' },
  no_show: { label: 'Absent', tone: 'neutral', color: 'secondary', icon: 'ri-user-unfollow-line' },
}

const UNKNOWN: StatusPresentation = { label: 'Inconnu', tone: 'neutral', color: 'secondary', icon: 'ri-question-line' }

export const isKnownStatus = (status: string): status is ReservationStatusId =>
  (RESERVATION_STATUSES as readonly string[]).includes(status)

export const presentStatus = (status: string): StatusPresentation =>
  isKnownStatus(status) ? PRESENTATION[status] : { ...UNKNOWN, label: status }

/** Une réservation encore active : on peut la confirmer, l'annuler ou noter l'arrivée. */
export const isOpen = (status: string) => status === 'pending' || status === 'confirmed'

/** Ce qui ne prend plus de place en salle (annulée, absente). */
export const isDead = (status: string) => status === 'cancelled' || status === 'no_show'

export const SOURCE_OPTIONS = [
  { value: 'POS', title: 'Au restaurant' },
  { value: 'PHONE', title: 'Par téléphone' },
  { value: 'WEB', title: 'Par internet' },
]

const SOURCES: Record<string, string> = {
  POS: 'Au restaurant',
  PHONE: 'Par téléphone',
  WEB: 'Par internet',
}

export const sourceLabel = (source: string) => SOURCES[source.toUpperCase()] ?? source

export const DURATION_OPTIONS = [60, 90, 120, 150, 180, 240].map(minutes => ({
  value: minutes,
  title: minutes % 60 === 0 ? `${minutes / 60} h` : `${Math.floor(minutes / 60)} h 30`,
}))

/** `5` → « 5 min », `65` → « 1 h 05 », `0` → « à l'instant ». */
export function formatWait(minutes: number): string {
  const rounded = Math.max(0, Math.round(minutes))

  if (rounded < 1)
    return 'à l\'instant'

  if (rounded < 60)
    return `${rounded} min`

  return `${Math.floor(rounded / 60)} h ${String(rounded % 60).padStart(2, '0')}`
}

/** « 1 couvert », « 4 couverts ». */
export const coversLabel = (count: number) => `${count} couvert${count > 1 ? 's' : ''}`

/** Libellé d'une table. */
export const tableLabel = (numero: string) => `Table ${numero}`
