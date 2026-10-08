export type SocketState = 'connecting' | 'open' | 'closed'

export interface KdsSocketOptions {
  url: string

  /** Jeton d'accès au moment de la connexion (il peut avoir été renouvelé entre deux tentatives). */
  getToken: () => string | null
  onMessage: (data: unknown) => void
  onState: (state: SocketState) => void

  /** Délais de reconnexion, en millisecondes. */
  minDelayMs?: number
  maxDelayMs?: number
}

/**
 * Connexion WebSocket de l'écran de production, avec reconnexion automatique.
 *
 * Un navigateur ne peut pas envoyer d'en-tête `Authorization` à l'ouverture d'un WebSocket :
 * le jeton passe dans les sous-protocoles `['bearer', <jeton>]`, que le serveur accepte
 * (voir `websocket_token` côté API). Après une coupure, on retente avec un délai qui double
 * (1 s, 2 s, 4 s... jusqu'à 30 s) plus un peu de hasard, pour que dix écrans murals ne
 * frappent pas le serveur au même instant.
 */
export class KdsSocket {
  private socket: WebSocket | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private attempt = 0
  private stopped = true

  constructor(private readonly options: KdsSocketOptions) {}

  start(): void {
    if (!this.stopped)
      return

    this.stopped = false
    this.connect()
  }

  stop(): void {
    this.stopped = true
    if (this.timer)
      clearTimeout(this.timer)

    this.timer = null

    const socket = this.socket

    this.socket = null
    if (socket) {
      socket.onopen = socket.onmessage = socket.onclose = socket.onerror = null
      socket.close()
    }

    this.options.onState('closed')
  }

  /** Reconnecte tout de suite (retour de l'onglet, réseau revenu) sans attendre le délai. */
  retryNow(): void {
    if (this.stopped || this.socket)
      return

    if (this.timer)
      clearTimeout(this.timer)

    this.timer = null
    this.connect()
  }

  private connect(): void {
    const token = this.options.getToken()

    if (!token || typeof WebSocket === 'undefined') {
      this.scheduleRetry()

      return
    }

    this.options.onState('connecting')

    let socket: WebSocket

    try {
      socket = new WebSocket(this.options.url, ['bearer', token])
    }
    catch {
      this.scheduleRetry()

      return
    }

    this.socket = socket

    socket.onopen = () => {
      this.attempt = 0
      this.options.onState('open')
    }

    socket.onmessage = event => {
      try {
        this.options.onMessage(JSON.parse(String(event.data)))
      }
      catch {
        this.options.onMessage(event.data)
      }
    }

    socket.onclose = () => {
      if (this.socket !== socket)
        return

      this.socket = null
      this.scheduleRetry()
    }

    // `onclose` suit toujours `onerror` : la reconnexion se décide là.
    socket.onerror = () => {}
  }

  private scheduleRetry(): void {
    if (this.stopped)
      return

    this.options.onState('connecting')

    const min = this.options.minDelayMs ?? 1000
    const max = this.options.maxDelayMs ?? 30_000
    const delay = Math.min(max, min * 2 ** this.attempt) * (0.75 + Math.random() * 0.5)

    this.attempt += 1
    this.timer = setTimeout(() => {
      this.timer = null
      this.connect()
    }, delay)
  }
}
