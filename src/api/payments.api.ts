import type {
  PaymentStatus,
  PaymentSummary,
  PaymentTransaction,
  PaymentTransactionDetail,
  PaymentTransactionPage,
} from '@/lib/api/types'
import type { HttpClient } from '@/lib/http/HttpClient'

export interface TransactionFilters {
  status?: PaymentStatus[]

  /** Bornes de création (inclusive / exclusive). */
  from?: Date
  to?: Date

  /** Début de référence, ex. le préfixe du restaurant. */
  reference?: string
  cursor?: string
  limit?: number
}

const BASE = '/v1/payments/easytransact'

/** Historique des paiements Mobile Money du restaurant courant (en-tête `X-Tenant-ID`). */
export class PaymentsApi {
  constructor(private readonly http: HttpClient) {}

  transactions(filters: TransactionFilters = {}, signal?: AbortSignal) {
    return this.http.get<PaymentTransactionPage>(`${BASE}/transactions`, {
      signal,
      query: {
        status: filters.status,
        from: filters.from,
        to: filters.to,
        reference: filters.reference,
        cursor: filters.cursor,
        limit: filters.limit,
      },
    })
  }

  summary(range: { from?: Date; to?: Date } = {}, signal?: AbortSignal) {
    return this.http.get<PaymentSummary>(`${BASE}/transactions/summary`, {
      signal,
      query: { from: range.from, to: range.to },
    })
  }

  detail(id: string, signal?: AbortSignal) {
    return this.http.get<PaymentTransactionDetail>(`${BASE}/transactions/${id}`, { signal })
  }

  /** Redemande son statut à la passerelle (webhook jamais reçu). */
  refresh(id: string) {
    return this.http.post<PaymentTransaction>(`${BASE}/transactions/${id}/refresh`)
  }
}
