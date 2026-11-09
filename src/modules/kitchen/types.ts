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

/** Les colonnes de travail de l'écran. Le « servi » n'est pas une colonne : c'est un rappel possible. */
export type Lane = 'QUEUED' | 'IN_PREPARATION' | 'READY'

/** « Tout le service » : total d'un article, tous tickets à faire confondus. */
export interface ArticleTotal {
  name: string
  quantity: number
}
