import type { components } from '@/lib/api/schema'

type Schemas = components['schemas']

export type Table = Schemas['TableResponse']
export type TableCreate = Schemas['TableCreate']
export type TableUpdate = Schemas['TableUpdate']

export type ServiceSession = Schemas['SessionResponse']
export type SessionCreate = Schemas['SessionCreate']
export type SessionStatus = Schemas['SessionStatus']

export type Customer = Schemas['CustomerResponse']
export type CustomerCreate = Schemas['CustomerCreate']
export type CustomerType = Schemas['CustomerType']

export type Invoice = Schemas['InvoiceResponse']
export type InvoiceStatus = Schemas['InvoiceStatus']

export type Order = Schemas['OrderResponse']
export type OrderCreate = Schemas['OrderCreate']
export type OrderItemCreate = Schemas['OrderItemCreate']
export type OrderItem = Schemas['OrderItemResponse']
export type OrderStatus = Schemas['RosOrderStatus']
export type ProductionStation = Schemas['ProductionStation']

export type Plat = Schemas['PlatResponse']
export type Boisson = Schemas['BoissonResponse']
export type Menu = Schemas['MenuResponse']
export type MenuCategory = Schemas['MenuCategoryResponse']

/** Statuts d'une table (le back les type en chaîne libre : voir `TableStatut` côté serveur). */
export const TABLE_STATUSES = ['libre', 'occupee', 'reservee', 'maintenance'] as const

export type TableStatus = typeof TABLE_STATUSES[number]

/** Sessions encore ouvertes (celles que renvoie `GET /sessions`). */
export const ACTIVE_SESSION_STATUSES: readonly SessionStatus[] = ['OPEN', 'ACTIVE', 'PAYMENT_PENDING', 'PARTIALLY_PAID']

/**
 * Une commande envoyée depuis cet appareil. Le back répond à la création avec `items: []` :
 * on garde donc ce que le panier contenait, plus le statut et le total que le serveur a renvoyés.
 */
export interface SentOrder {
  id: string
  sentAt: string
  status: OrderStatus
  total: string
  lines: { name: string; quantity: number; notes: string; station: ProductionStation }[]
}

/** Un article de la carte, plat ou boisson, tel que la prise de commande le manipule. */
export interface CatalogItem {
  id: string
  name: string
  description: string | null
  price: number
  currency: string
  category: string
  kind: 'plat' | 'boisson'
  station: ProductionStation
  available: boolean
  alcohol: boolean
}

/** Une ligne du panier en cours de saisie. */
export interface CartLine {
  item: CatalogItem
  quantity: number
  notes: string
  station: ProductionStation
}

/** Ce que le plan de salle sait d'une table : sa fiche, sa session active et son addition. */
export interface TableView {
  table: Table
  session: ServiceSession | null

  /** Reste à payer de la session (facture), ou `null` tant qu'aucune commande n'est passée. */
  amountDue: number | null
  total: number | null
  covers: number | null
}
