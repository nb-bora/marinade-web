import type { components } from '@/lib/api/schema'

type Schemas = components['schemas']

export type Ticket = Schemas['TicketResponse']
export type TicketStatus = Schemas['TicketStatus']

/** Les postes de production que l'écran sait afficher (l'emballage n'a pas d'écran). */
export type Station = 'KITCHEN' | 'BAR' | 'DESSERT'

/** Une ligne d'un ticket, telle que le serveur la range dans `items_jsonb`. */
export interface TicketLine {
  name: string
  quantity: number
  notes: string | null
}

/** Les trois colonnes de l'écran. « Servi » fait quitter le ticket de l'écran. */
export type Lane = 'QUEUED' | 'IN_PREPARATION' | 'READY'

/** Événement poussé par le serveur : on ne s'en sert que comme signal « quelque chose a changé ». */
export interface KdsEvent {
  type?: string
  [key: string]: unknown
}
