import type { ArticleTotal, Lane, Station, Ticket, TicketLine, TicketStatus } from './types'

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

/** Une action sur un ticket : libellé du gros bouton, statut visé, icône. */
export interface TicketAction {
  label: string
  next: TicketStatus
  icon: string
}

export interface LaneInfo {
  value: Lane
  title: string

  /** Libellé court, pour les onglets d'un téléphone. */
  short: string
  subtitle: string
  icon: string

  /** Couleur de la colonne (fond de l'en-tête et du bouton d'action). */
  tone: 'info' | 'warning' | 'success'
  empty: string
}

export const LANES: readonly LaneInfo[] = [
  {
    value: 'QUEUED',
    title: 'À préparer',
    short: 'À faire',
    subtitle: 'Commandes reçues, pas encore commencées',
    icon: 'ri-inbox-line',
    tone: 'info',
    empty: 'Aucune commande en attente.',
  },
  {
    value: 'IN_PREPARATION',
    title: 'En préparation',
    short: 'En cours',
    subtitle: 'En cours de cuisson ou de préparation',
    icon: 'ri-fire-line',
    tone: 'warning',
    empty: 'Rien en cours pour le moment.',
  },
  {
    value: 'READY',
    title: 'Prêt à servir',
    short: 'Prêt',
    subtitle: 'À porter en salle maintenant',
    icon: 'ri-check-double-line',
    tone: 'success',
    empty: 'Les plats prêts à servir apparaîtront ici.',
  },
]

/** Action suivante d'un ticket ouvert ou prêt : `null` quand il n'y a plus rien à faire. */
const NEXT_ACTION: Partial<Record<TicketStatus, TicketAction>> = {
  QUEUED: { label: 'Commencer', next: 'IN_PREPARATION', icon: 'ri-fire-line' },
  IN_PREPARATION: { label: 'Prêt', next: 'READY', icon: 'ri-check-line' },
  READY: { label: 'Servi', next: 'SERVED', icon: 'ri-check-double-line' },
}

export function nextAction(ticket: Pick<Ticket, 'status'>): TicketAction | null {
  return NEXT_ACTION[ticket.status] ?? null
}

/** Un ticket « à faire » (compté dans les indicateurs et la vue « tout le service »). */
export const isOpen = (ticket: Pick<Ticket, 'status'>) =>
  ticket.status === 'QUEUED' || ticket.status === 'IN_PREPARATION'

/** Seuils du minuteur, en minutes : orange après 10, rouge après 20. */
export const WARNING_MINUTES = 10
export const ALERT_MINUTES = 20

/** Un ticket « servi » peut être rappelé pendant ce délai (serveur : même fenêtre). */
export const RECALL_WINDOW_MS = 2 * 60_000

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

/** Temps restant pour rappeler un ticket servi ; 0 une fois la fenêtre passée. */
export function recallRemainingMs(ticket: Pick<Ticket, 'served_at'>, now: number): number {
  if (!ticket.served_at)
    return 0

  return Math.max(0, RECALL_WINDOW_MS - (now - ticketTime(ticket.served_at)))
}

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

/** Totaux par article, les plus demandés d'abord (à quantité égale, ordre alphabétique). */
export function aggregateByArticle(tickets: readonly Ticket[]): ArticleTotal[] {
  const totals = new Map<string, number>()

  for (const ticket of tickets) {
    for (const line of linesOf(ticket))
      totals.set(line.name, (totals.get(line.name) ?? 0) + line.quantity)
  }

  return [...totals]
    .map(([name, quantity]) => ({ name, quantity }))
    .sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name, 'fr'))
}

/** Attente du ticket le plus ancien, en millisecondes (0 s'il n'y en a pas). */
export function longestWaitMs(tickets: readonly Ticket[], now: number): number {
  return tickets.reduce((longest, ticket) => Math.max(longest, now - ticketTime(ticket.created_at)), 0)
}

/** Où servir le ticket : « Table 4 · Terrasse », ou « Sans table » (comptoir, à emporter). */
export function placeOf(ticket: Pick<Ticket, 'table_label' | 'zone'>): string {
  if (!ticket.table_label)
    return 'Sans table'

  return ticket.zone ? `${ticket.table_label} · ${ticket.zone}` : ticket.table_label
}

/** Numéro court et lisible d'une commande, pour que la salle et le passe se comprennent. */
export const orderNumber = (ticket: Ticket) => ticket.order_id.replaceAll('-', '').slice(0, 4).toUpperCase()
