import { ApiError, apiErrorFromResponse, networkError } from './errors'
import type {
  HttpClient,
  HttpMethod,
  PreparedRequest,
  QueryValue,
  RequestDecorator,
  RequestOptions,
  UnauthorizedRecovery,
} from './HttpClient'

export interface FetchHttpClientOptions {
  baseUrl: string
  decorators?: RequestDecorator[]
  recovery?: UnauthorizedRecovery
  fetchImpl?: typeof fetch
}

const serializeQueryValue = (value: Exclude<QueryValue, null | undefined>): string =>
  value instanceof Date ? value.toISOString() : String(value)

export function buildUrl(baseUrl: string, path: string, query?: RequestOptions['query']): string {
  const parts: string[] = []

  for (const [key, raw] of Object.entries(query ?? {})) {
    const values = Array.isArray(raw) ? raw : [raw]

    for (const value of values) {
      if (value === undefined || value === null || value === '')
        continue
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(serializeQueryValue(value))}`)
    }
  }

  const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`

  return parts.length ? `${url}?${parts.join('&')}` : url
}

async function readBody(response: Response): Promise<unknown> {
  if (response.status === 204)
    return undefined

  const text = await response.text()

  if (!text)
    return undefined

  try {
    return JSON.parse(text)
  }
  catch {
    return text
  }
}

export class FetchHttpClient implements HttpClient {
  private readonly baseUrl: string
  private readonly decorators: RequestDecorator[]
  private readonly recovery?: UnauthorizedRecovery
  private readonly fetchImpl: typeof fetch

  constructor(options: FetchHttpClientOptions) {
    this.baseUrl = options.baseUrl
    this.decorators = options.decorators ?? []
    this.recovery = options.recovery
    this.fetchImpl = options.fetchImpl ?? ((...args) => fetch(...args))
  }

  async request<T>(method: HttpMethod, path: string, options: RequestOptions = {}): Promise<T> {
    const send = () => this.send(method, path, options)

    try {
      return await send() as T
    }
    catch (error) {
      // Un 401 sur une route authentifiée : on tente UNE récupération (rafraîchir le
      // jeton), puis on rejoue. Jamais de boucle.
      const recoverable = error instanceof ApiError
        && error.status === 401
        && !options.anonymous
        && this.recovery

      if (!recoverable || !(await this.recovery!.recover()))
        throw error

      return await send() as T
    }
  }

  get<T>(path: string, options?: RequestOptions) {
    return this.request<T>('GET', path, options)
  }

  post<T>(path: string, body?: unknown, options?: RequestOptions) {
    return this.request<T>('POST', path, { ...options, body })
  }

  put<T>(path: string, body?: unknown, options?: RequestOptions) {
    return this.request<T>('PUT', path, { ...options, body })
  }

  patch<T>(path: string, body?: unknown, options?: RequestOptions) {
    return this.request<T>('PATCH', path, { ...options, body })
  }

  delete<T>(path: string, options?: RequestOptions) {
    return this.request<T>('DELETE', path, options)
  }

  private async send(method: HttpMethod, path: string, options: RequestOptions): Promise<unknown> {
    const request: PreparedRequest = {
      method,
      url: buildUrl(this.baseUrl, path, options.query),
      headers: new Headers({ Accept: 'application/json', ...options.headers }),
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      anonymous: options.anonymous ?? false,
      withoutTenant: options.withoutTenant ?? false,
    }

    if (request.body !== undefined && !request.headers.has('Content-Type'))
      request.headers.set('Content-Type', 'application/json')

    for (const decorator of this.decorators)
      await decorator.decorate(request)

    let response: Response

    try {
      response = await this.fetchImpl(request.url, {
        method: request.method,
        headers: request.headers,
        body: request.body,
        signal: options.signal,
      })
    }
    catch (error) {
      // Une requête annulée volontairement n'est pas une panne réseau.
      if (error instanceof DOMException && error.name === 'AbortError')
        throw error

      throw networkError(error)
    }

    const body = await readBody(response)

    if (!response.ok)
      throw apiErrorFromResponse(response.status, body)

    return body
  }
}
