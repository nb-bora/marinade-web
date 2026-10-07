/**
 * Erreurs d'API normalisées.
 *
 * Le back répond sous trois formes selon l'origine de l'erreur :
 *   1. `{ "detail": "texte" }`                          (HTTPException de FastAPI)
 *   2. `{ "detail": [{ loc, msg, type }, ...] }`        (validation Pydantic, 422)
 *   3. `{ "error", "message", "details" }`              (exceptions métier de Marinade)
 * Tout le reste de l'application ne voit qu'`ApiError`.
 */

export interface FieldError {

  /** Chemin du champ, ex. `email` ou `items.0.quantity`. */
  field: string
  message: string
}

export type ApiErrorKind =
  | 'network'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'validation'
  | 'rate_limited'
  | 'server'
  | 'client'

export class ApiError extends Error {
  readonly status: number
  readonly kind: ApiErrorKind
  readonly fieldErrors: FieldError[]
  readonly details: Record<string, unknown>

  constructor(init: {
    status: number
    message: string
    kind?: ApiErrorKind
    fieldErrors?: FieldError[]
    details?: Record<string, unknown>
  }) {
    super(init.message)
    this.name = 'ApiError'
    this.status = init.status
    this.kind = init.kind ?? kindOf(init.status)
    this.fieldErrors = init.fieldErrors ?? []
    this.details = init.details ?? {}
  }

  /** Erreur de champ pour `field`, utile pour afficher le message sous le champ. */
  fieldMessage(field: string): string | undefined {
    return this.fieldErrors.find(error => error.field === field)?.message
  }
}

export const isApiError = (value: unknown): value is ApiError => value instanceof ApiError

export function kindOf(status: number): ApiErrorKind {
  if (status === 0)
    return 'network'
  if (status === 401)
    return 'unauthorized'
  if (status === 403)
    return 'forbidden'
  if (status === 404)
    return 'not_found'
  if (status === 409)
    return 'conflict'
  if (status === 422)
    return 'validation'
  if (status === 429)
    return 'rate_limited'
  if (status >= 500)
    return 'server'

  return 'client'
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function fieldErrorsFrom(detail: unknown[]): FieldError[] {
  return detail.filter(isRecord).map(item => {
    const location = Array.isArray(item.loc) ? item.loc : []

    // `loc` commence par la provenance (`body`, `query`, `path`) : on ne garde que le champ.
    const field = location.slice(1).join('.') || String(location[0] ?? '')

    return { field, message: String(item.msg ?? 'Valeur invalide') }
  })
}

/** Construit l'`ApiError` correspondant à une réponse HTTP en échec. */
export function apiErrorFromResponse(status: number, body: unknown): ApiError {
  if (isRecord(body)) {
    if (Array.isArray(body.detail)) {
      const fieldErrors = fieldErrorsFrom(body.detail)

      return new ApiError({
        status,
        fieldErrors,
        message: fieldErrors[0]?.message ?? 'Données invalides',
      })
    }

    if (typeof body.detail === 'string')
      return new ApiError({ status, message: body.detail })

    if (typeof body.message === 'string') {
      return new ApiError({
        status,
        message: body.message,
        details: isRecord(body.details) ? body.details : {},
      })
    }
  }

  return new ApiError({ status, message: `HTTP ${status}` })
}

export const networkError = (cause?: unknown) =>
  new ApiError({
    status: 0,
    kind: 'network',
    message: cause instanceof Error ? cause.message : 'Réseau indisponible',
  })
