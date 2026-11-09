import { describeError } from '@/lib/http/errorMessages'
import { isApiError } from '@/lib/http/errors'
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

  /** Réservation close : le nom est barré dans les listes. */
  closed: boolean
}

/**
 * Couleurs d'état convenues : en attente = ambre, confirmée = vert, arrivée = bleu,
 * terminée = neutre, absente = rouge, annulée = neutre barré. Le libellé est toujours visible.
 */
const PRESENTATION: Record<ReservationStatusId, StatusPresentation> = {
  pending: { label: 'En attente', tone: 'warning', color: 'warning', icon: 'ri-time-line', closed: false },
  confirmed: { label: 'Confirmée', tone: 'success', color: 'success', icon: 'ri-checkbox-circle-line', closed: false },
  checked_in: { label: 'Arrivée', tone: 'info', color: 'info', icon: 'ri-user-received-line', closed: false },
  completed: { label: 'Terminée', tone: 'neutral', color: 'secondary', icon: 'ri-flag-line', closed: true },
  cancelled: { label: 'Annulée', tone: 'neutral', color: 'secondary', icon: 'ri-close-circle-line', closed: true },
  no_show: { label: 'Absente', tone: 'error', color: 'error', icon: 'ri-user-unfollow-line', closed: true },
}

const UNKNOWN: StatusPresentation = { label: 'Inconnue', tone: 'neutral', color: 'secondary', icon: 'ri-question-line', closed: true }

export const isKnownStatus = (status: string): status is ReservationStatusId =>
  (RESERVATION_STATUSES as readonly string[]).includes(status)

export const presentStatus = (status: string): StatusPresentation =>
  isKnownStatus(status) ? PRESENTATION[status] : UNKNOWN

/** Une réservation encore à venir ou en cours (confirmer, annuler, noter l'arrivée). */
export const isOpen = (status: string) => status === 'pending' || status === 'confirmed'

/** Ce qui ne prend plus de place en salle. */
export const isDead = (status: string) => status === 'cancelled' || status === 'no_show'

export type ReservationAction = 'confirm' | 'checkin' | 'noshow' | 'complete' | 'edit' | 'cancel'

export const ACTION_LABELS: Record<ReservationAction, string> = {
  confirm: 'Confirmer',
  checkin: 'Noter l\'arrivée',
  noshow: 'Absent',
  complete: 'Terminer',
  edit: 'Modifier',
  cancel: 'Annuler',
}

/**
 * Actions proposées pour un état, dans l'ordre d'usage. « Absent » n'apparaît qu'une fois
 * l'heure prévue passée : avant, ce serait prématuré.
 */
export function actionsFor(status: string, context: { starts: Date; now: Date }): ReservationAction[] {
  const late = context.now.getTime() >= context.starts.getTime()
  const absence: ReservationAction[] = late ? ['noshow'] : []

  if (status === 'pending')
    return ['confirm', 'checkin', ...absence, 'edit', 'cancel']
  if (status === 'confirmed')
    return ['checkin', ...absence, 'edit', 'cancel']
  if (status === 'checked_in')
    return ['complete', 'edit']

  return []
}

/** Action principale (mise en avant) pour un état, s'il y en a une. */
export const primaryActionFor = (status: string): ReservationAction | null => {
  if (status === 'pending')
    return 'confirm'

  if (status === 'confirmed')
    return 'checkin'

  if (status === 'checked_in')
    return 'complete'

  return null
}

/**
 * Un refus de la gestion peut être forcé (capacité, horaires, date passée). Un chevauchement
 * sur une table ne le peut pas : aucune action « forcer » ne lui est proposée.
 */
export function isForcable(message: string): boolean {
  return /capacité|horaires d'ouverture|est passée/i.test(message) && !/déjà réservée|réservée dans la prochaine/i.test(message)
}

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

/** Mots de la liste d'attente au pluriel selon le nombre de groupes. */
export const groupsLabel = (count: number) => `${count} groupe${count > 1 ? 's' : ''}`

/**
 * Message affiché après une action. Les refus métier (400 à 422) portent un message français
 * du serveur : on le montre tel quel, avec la raison (table, capacité, horaires). Le reste
 * passe par les messages génériques du client.
 */
export function messageOf(error: unknown): string {
  if (isApiError(error) && error.status >= 400 && error.status < 500 && error.status !== 401 && error.status !== 403)
    return error.message

  return describeError(error)
}
