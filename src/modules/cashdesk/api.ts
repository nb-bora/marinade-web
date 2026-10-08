import type {
  Invoice,
  Payment,
  PaymentCreate,
  ServiceSession,
  Shift,
  ShiftCloseRequest,
  ShiftOpenRequest,
  SplitPaymentRequest,
  Table,
} from './types'
import { container } from '@/container'
import { isApiError } from '@/lib/http/errors'
import type { HttpClient } from '@/lib/http/HttpClient'

/** Taille maximale d'une page côté serveur. */
const PAGE = 500

/** Caisse du restaurant courant : shift, sessions à encaisser, additions et encaissements. */
export class CashDeskApi {
  constructor(private readonly http: HttpClient) {}

  private async all<T>(path: string, signal?: AbortSignal): Promise<T[]> {
    const rows: T[] = []

    for (let skip = 0; ; skip += PAGE) {
      const page = await this.http.get<T[]>(path, { signal, query: { skip, limit: PAGE } })

      rows.push(...page)
      if (page.length < PAGE)
        return rows
    }
  }

  private ros(restaurantId: string) {
    return `/v1/ros/restaurants/${restaurantId}`
  }

  // Shift ---------------------------------------------------------------------------------

  openShift(restaurantId: string, body: ShiftOpenRequest) {
    return this.http.post<Shift>(`${this.ros(restaurantId)}/shifts/open`, body)
  }

  closeShift(restaurantId: string, body: ShiftCloseRequest) {
    return this.http.post<Shift>(`${this.ros(restaurantId)}/shifts/close`, body)
  }

  // Sessions et additions -----------------------------------------------------------------

  activeSessions(restaurantId: string, signal?: AbortSignal) {
    return this.all<ServiceSession>(`${this.ros(restaurantId)}/sessions`, signal)
  }

  tables(restaurantId: string, signal?: AbortSignal) {
    return this.all<Table>(`/v1/restaurants/${restaurantId}/tables`, signal)
  }

  /** Addition de la session ; `null` tant qu'aucune commande n'a créé de facture. */
  async sessionInvoice(restaurantId: string, sessionId: string, signal?: AbortSignal): Promise<Invoice | null> {
    try {
      return await this.http.get<Invoice>(`${this.ros(restaurantId)}/sessions/${sessionId}/invoice`, { signal })
    }
    catch (cause) {
      if (isApiError(cause) && cause.kind === 'not_found')
        return null

      throw cause
    }
  }

  invoice(restaurantId: string, invoiceId: string, signal?: AbortSignal) {
    return this.http.get<Invoice>(`${this.ros(restaurantId)}/invoices/${invoiceId}`, { signal })
  }

  // Encaissements -------------------------------------------------------------------------

  /** La clé d'idempotence est dans le corps : rejouer la même requête ne paie jamais deux fois. */
  pay(restaurantId: string, body: PaymentCreate) {
    return this.http.post<Payment>(`${this.ros(restaurantId)}/payments`, body)
  }

  paySplit(restaurantId: string, body: SplitPaymentRequest) {
    return this.http.post<Payment[]>(`${this.ros(restaurantId)}/payments/split`, body)
  }
}

export const cashDeskApi = new CashDeskApi(container.http)
