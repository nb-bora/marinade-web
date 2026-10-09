import type {
  CustomerType,
  InvoiceStatus,
  OrderStatus,
  ProductionStation,
  SessionStatus,
  TableStatus,
} from './types'
import type { StatusTone } from '@/ui/AppStatusChip.vue'

interface Presentation {
  label: string
  tone: StatusTone
  icon: string
}

/** État d'une table à l'écran : les quatre statuts du back, plus « soldée » (voir `tableState`). */
export type TableState = TableStatus | 'settled'

export const TABLE_STATE: Record<TableState, Presentation> = {
  libre: { label: 'Libre', tone: 'success', icon: 'ri-checkbox-circle-line' },
  occupee: { label: 'Occupée', tone: 'error', icon: 'ri-restaurant-2-line' },
  reservee: { label: 'Réservée', tone: 'info', icon: 'ri-bookmark-line' },
  maintenance: { label: 'Hors service', tone: 'neutral', icon: 'ri-tools-line' },
  settled: { label: 'À libérer', tone: 'warning', icon: 'ri-hand-coin-line' },
}

export const TABLE_STATUS_OPTIONS = (['libre', 'occupee', 'reservee', 'maintenance'] as const)
  .map(value => ({ value, title: TABLE_STATE[value].label }))

export const tableStatusOf = (statut: string): TableState =>
  statut in TABLE_STATE ? statut as TableState : 'libre'

export const SESSION_STATUS: Record<SessionStatus, Presentation> = {
  OPEN: { label: 'Ouverte', tone: 'info', icon: 'ri-door-open-line' },
  ACTIVE: { label: 'En cours', tone: 'warning', icon: 'ri-restaurant-line' },
  PAYMENT_PENDING: { label: 'Paiement en attente', tone: 'warning', icon: 'ri-hourglass-line' },
  PARTIALLY_PAID: { label: 'Partiellement payée', tone: 'warning', icon: 'ri-pie-chart-2-line' },
  SETTLED: { label: 'Soldée', tone: 'success', icon: 'ri-checkbox-circle-line' },
  CLOSED: { label: 'Clôturée', tone: 'neutral', icon: 'ri-lock-line' },
}

export const INVOICE_STATUS: Record<InvoiceStatus, Presentation> = {
  DRAFT: { label: 'Brouillon', tone: 'neutral', icon: 'ri-draft-line' },
  ISSUED: { label: 'À payer', tone: 'warning', icon: 'ri-file-list-3-line' },
  PARTIALLY_PAID: { label: 'Partiellement payée', tone: 'warning', icon: 'ri-pie-chart-2-line' },
  PAID: { label: 'Payée', tone: 'success', icon: 'ri-checkbox-circle-line' },
  CANCELLED: { label: 'Annulée', tone: 'neutral', icon: 'ri-close-circle-line' },
  REFUNDED: { label: 'Remboursée', tone: 'info', icon: 'ri-refund-2-line' },
}

export const ORDER_STATUS: Record<OrderStatus, Presentation> = {
  DRAFT: { label: 'Brouillon', tone: 'neutral', icon: 'ri-draft-line' },
  PENDING_PAYMENT: { label: 'À payer', tone: 'warning', icon: 'ri-hourglass-line' },
  CONFIRMED: { label: 'Prise en compte', tone: 'info', icon: 'ri-check-line' },
  SENT_TO_PRODUCTION: { label: 'En préparation', tone: 'warning', icon: 'ri-fire-line' },
  READY: { label: 'Prête', tone: 'success', icon: 'ri-notification-3-line' },
  SERVED: { label: 'Servie', tone: 'success', icon: 'ri-restaurant-2-line' },
  COMPLETED: { label: 'Terminée', tone: 'success', icon: 'ri-checkbox-circle-line' },
  CANCELLED: { label: 'Annulée', tone: 'error', icon: 'ri-close-circle-line' },
  REFUNDED: { label: 'Remboursée', tone: 'info', icon: 'ri-refund-2-line' },
}

export const STATION_LABEL: Record<ProductionStation, string> = {
  KITCHEN: 'Cuisine',
  BAR: 'Bar',
  DESSERT: 'Dessert',
  PACKAGING: 'Emballage',
}

/** Postes proposés à la prise de commande en salle (l'emballage est réservé à la vente à emporter). */
export const STATION_OPTIONS: { value: ProductionStation; title: string }[] = [
  { value: 'KITCHEN', title: STATION_LABEL.KITCHEN },
  { value: 'BAR', title: STATION_LABEL.BAR },
  { value: 'DESSERT', title: STATION_LABEL.DESSERT },
]

export const CUSTOMER_TYPE_LABEL: Record<CustomerType, string> = {
  GUEST: 'Invité',
  REGISTERED: 'Enregistré',
  VIP: 'VIP',
  BUSINESS: 'Entreprise',
  HOTEL_GUEST: 'Client de l\'hôtel',
}

export const present = <K extends string>(map: Record<K, Presentation>, key: string): Presentation =>
  (map as Record<string, Presentation | undefined>)[key] ?? { label: key, tone: 'neutral', icon: 'ri-question-line' }

export const plural = (count: number, one: string, many: string = `${one}s`) => `${count} ${count > 1 ? many : one}`

/** Ce que le plan de salle montre d'une table : sa couleur (thème Vuetify) et son libellé. */
export type PlanState = 'free' | 'busy' | 'paying' | 'reserved' | 'maintenance' | 'settled'

export const PLAN_STATE: Record<PlanState, { label: string; color: string; hint: string }> = {
  free: { label: 'Libre', color: 'success', hint: 'Touchez pour ouvrir une session' },
  busy: { label: 'Occupée', color: 'warning', hint: 'Touchez pour voir les détails' },
  paying: { label: 'En paiement', color: 'error', hint: 'Touchez pour régler' },
  reserved: { label: 'Réservée', color: 'info', hint: 'Réservée pour des clients attendus' },
  maintenance: { label: 'Hors service', color: 'secondary', hint: 'Touchez pour la remettre en service' },
  settled: { label: 'À libérer', color: 'warning', hint: 'Addition réglée : touchez pour libérer' },
}
