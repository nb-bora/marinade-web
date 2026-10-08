import type { InvoiceStatus, PaymentMethod, SessionStatus, ShiftStatus } from './types'
import type { StatusTone } from '@/ui/AppStatusChip.vue'

export interface Presentation {
  label: string
  tone: StatusTone
  icon: string
}

export type MethodKind = 'cash' | 'mobile' | 'other'

export interface MethodPresentation {
  label: string
  icon: string
  kind: MethodKind

  /** Couleur du thème Vuetify de la tuile. */
  color: 'success' | 'warning' | 'primary' | 'info' | 'secondary'
}

/** Les moyens de paiement du back (`RosPaymentMethod`), dans l'ordre d'affichage. */
export const METHODS: Record<PaymentMethod, MethodPresentation> = {
  CASH: { label: 'Espèces', icon: 'ri-cash-line', kind: 'cash', color: 'success' },
  MTN_MOMO: { label: 'MTN MoMo', icon: 'ri-smartphone-line', kind: 'mobile', color: 'warning' },
  ORANGE_MONEY: { label: 'Orange Money', icon: 'ri-smartphone-line', kind: 'mobile', color: 'primary' },
  CARD: { label: 'Carte bancaire', icon: 'ri-bank-card-line', kind: 'other', color: 'info' },
  WAVE: { label: 'Wave', icon: 'ri-wallet-3-line', kind: 'other', color: 'info' },
  BANK_TRANSFER: { label: 'Virement', icon: 'ri-bank-line', kind: 'other', color: 'secondary' },
}

export const METHOD_ORDER = Object.keys(METHODS) as PaymentMethod[]

export const METHOD_OPTIONS = METHOD_ORDER.map(value => ({ value, title: METHODS[value].label }))

export const methodLabel = (method: string) => (METHODS as Record<string, MethodPresentation | undefined>)[method]?.label ?? method

export const INVOICE_STATUS: Record<InvoiceStatus, Presentation> = {
  DRAFT: { label: 'Brouillon', tone: 'neutral', icon: 'ri-draft-line' },
  ISSUED: { label: 'À payer', tone: 'warning', icon: 'ri-file-list-3-line' },
  PARTIALLY_PAID: { label: 'Partiellement payée', tone: 'warning', icon: 'ri-pie-chart-2-line' },
  PAID: { label: 'Payée', tone: 'success', icon: 'ri-checkbox-circle-line' },
  CANCELLED: { label: 'Annulée', tone: 'neutral', icon: 'ri-close-circle-line' },
  REFUNDED: { label: 'Remboursée', tone: 'info', icon: 'ri-refund-2-line' },
}

export const SESSION_STATUS: Record<SessionStatus, Presentation> = {
  OPEN: { label: 'Ouverte', tone: 'info', icon: 'ri-door-open-line' },
  ACTIVE: { label: 'En cours', tone: 'warning', icon: 'ri-restaurant-line' },
  PAYMENT_PENDING: { label: 'Paiement en attente', tone: 'warning', icon: 'ri-hourglass-line' },
  PARTIALLY_PAID: { label: 'Partiellement payée', tone: 'warning', icon: 'ri-pie-chart-2-line' },
  SETTLED: { label: 'Soldée', tone: 'success', icon: 'ri-checkbox-circle-line' },
  CLOSED: { label: 'Clôturée', tone: 'neutral', icon: 'ri-lock-line' },
}

export const SHIFT_STATUS: Record<ShiftStatus, string> = {
  OPEN: 'Ouvert',
  COUNTING: 'Comptage en cours',
  CLOSED: 'Fermé',
}

const UNKNOWN: Presentation = { label: 'Inconnu', tone: 'neutral', icon: 'ri-question-line' }

/** Présentation d'une valeur d'énumération, avec repli si le back en ajoute une. */
export function present<T extends string>(table: Record<T, Presentation>, value: string): Presentation {
  return (table as Record<string, Presentation | undefined>)[value] ?? { ...UNKNOWN, label: value }
}

export const plural = (count: number, word: string) => `${count} ${word}${count > 1 ? 's' : ''}`
