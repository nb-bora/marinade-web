import type { Lane, Station, Ticket, TicketLine, TicketStatus } from './types'

export interface StationInfo {
  value: Station
  title: string

  /** Libellé court pour le bandeau d'un poste, ex. « la cuisine ». */
  place: string
  icon: string
}

export const STATIONS: readonly StationInfo[] = [
  { value: 'KITCHEN', title: 'Cuisine', place: 'la cuisine', icon: 'ri-restaurant-2-line' },
  { value: 'BAR', title: 'Bar', place: 'le bar', icon: 'ri-goblet-line' },
  { value: 'DESSERT', title: 'Desserts', place: 'les desserts', icon: 'ri-cake-3-line' },
]

export const stationTitle = (station: string) => STATIONS.find(item => item.value === station)?.title ?? station

export interface LaneInfo {
  value: Lane
  title: string
  icon: string

  /** Couleur Vuetify de l'en-tête de colonne. */
  color: 'info' | 'warning' | 'success'
  empty: string

  /** Étape suivante : libellé du gros bouton, statut visé, icône. */
  action: { label: string; next: TicketStatus; icon: string }
}

export const LANES: readonly LaneInfo[] = [
  {
    value: 'QUEUED',
    title: 'À préparer',
    icon: 'ri-inbox-line',
    color: 'info',
    empty: 'Aucune commande en attente.',
    action: { label: 'Commencer', next: 'IN_PREPARATION', icon: 'ri-fire-line' },
  },
  {
    value: 'IN_PREPARATION',
    title: 'En préparation',
    icon: 'ri-fire-line',
    color: 'warning',
    empty: 'Rien en cours pour le moment.',
    action: { label: 'Prêt', next: 'READY', icon: 'ri-check-line' },
  },
  {
    value: 'READY',
    title: 'Prêt',
    icon: 'ri-check-double-line',
    color: 'success',
    empty: 'Les plats prêts à servir apparaîtront ici.',
    action: { label: 'Servi', next: 'SERVED', icon: 'ri-check-double-line' },
  },
]

/** Seuils du minuteur, en minutes : orange après 10, rouge après 20. */
export const WARNING_MINUTES = 10
export const ALERT_MINUTES = 20

export type Urgency = 'normal' | 'warning' | 'alert'

export function urgencyOf(elapsedMs: number): Urgency {
  const minutes = elapsedMs / 60_000

  if (minutes >= ALERT_MINUTES)
    return 'alert'

  return minutes >= WARNING_MINUTES ? 'warning' : 'normal'
}

/** `754000` → « 12:34 » ; au-delà d'une heure « 1:02:03 ». */
export function formatElapsed(elapsedMs: number): string {
  const total = Math.max(0, Math.floor(elapsedMs / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const two = (value: number) => String(value).padStart(2, '0')

  return hours > 0 ? `${hours}:${two(minutes)}:${two(seconds)}` : `${two(minutes)}:${two(seconds)}`
}

/** Heure de création d'un ticket, en millisecondes. */
export const ticketTime = (value: string) => new Date(value).getTime()

/** Lignes d'un ticket, en tolérant les champs absents de `items_jsonb`. */
export function linesOf(ticket: Ticket): TicketLine[] {
  return (ticket.items_jsonb ?? []).map(raw => {
    const name = raw.product_name ?? raw.name
    const quantity = Number(raw.quantity)
    const notes = typeof raw.notes === 'string' ? raw.notes.trim() : ''

    return {
      name: typeof name === 'string' && name ? name : 'Article',
      quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
      notes: notes || null,
    }
  })
}

/** Numéro court et lisible d'une commande, pour que la salle et le passe se comprennent. */
export const orderNumber = (ticket: Ticket) => ticket.order_id.replaceAll('-', '').slice(0, 4).toUpperCase()
