import type { components } from '@/lib/api/schema'

type Schemas = components['schemas']

export type Invoice = Schemas['InvoiceResponse']
export type InvoiceStatus = Schemas['InvoiceStatus']

export type PaymentMethod = Schemas['RosPaymentMethod']
export type PaymentCreate = Schemas['PaymentCreate']
export type Payment = Schemas['PaymentResponse']
export type SplitPaymentItem = Schemas['SplitPaymentItem']
export type SplitPaymentRequest = Schemas['SplitPaymentRequest']

export type Shift = Schemas['ShiftResponse']
export type ShiftOpenRequest = Schemas['ShiftOpenRequest']
export type ShiftCloseRequest = Schemas['ShiftCloseRequest']
export type ShiftStatus = Schemas['CashShiftStatus']

export type ServiceSession = Schemas['SessionResponse']
export type SessionStatus = Schemas['SessionStatus']
export type Table = Schemas['TableResponse']

/** Une session à l'écran de la caisse : la session, sa table et son addition (si elle existe). */
export interface CashSession {
  session: ServiceSession
  table: Table | null
  invoice: Invoice | null
}

/** Ce que le reçu montre d'un règlement. */
export interface ReceiptPayment {
  method: PaymentMethod
  amount: number
  reference: string | null
}

/** Une ligne d'article commandé (connue seulement des commandes passées depuis cet appareil). */
export interface OrderedLine {
  name: string
  quantity: number
}
