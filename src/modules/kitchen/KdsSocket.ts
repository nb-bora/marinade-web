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

  /** Battement de cœur : un `ping` toutes les `heartbeatMs`, un `pong` attendu sous `pongTimeoutMs`. */
  heartbeatMs?: number
  pongTimeoutMs?: number
}

const HEARTBEAT_MS = 25_000
const PONG_TIMEOUT_MS = 10_000

/** `WebSocket.OPEN` (valeur fixe, pour ne pas dépendre de la globale dans les tests). */
const READY_OPEN = 1

/**
 * Connexion WebSocket de l'écran de production, avec reconnexion automatique et détection
 * des connexions mortes.
 *
 * Un navigateur ne peut pas envoyer d'en-tête `Authorization` à l'ouverture d'un WebSocket :
 * le jeton passe dans les sous-protocoles `['bearer', <jeton>]`, que le serveur accepte.
 *
 * Un proxy ou un Wi-Fi défaillant peut garder une connexion « ouverte » sans rien transporter.
 * Toutes les 25 s on envoie donc `ping` ; sans `pong` dans les 10 s, on considère la connexion
 * morte et on la remplace. Après une coupure, on retente avec un délai qui double (1 s, 2 s,
 * 4 s... jusqu'à 30 s) plus un peu de hasard, pour que plusieurs écrans ne frappent pas le
 * serveur au même instant.
 */
export class KdsSocket {
  private socket: WebSocket | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private heartbeat: ReturnType<typeof setInterval> | null = null
  private pongTimer: ReturnType<typeof setTimeout> | null = null
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
    this.stopHeartbeat()

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
      this.startHeartbeat(socket)
    }

    socket.onmessage = event => {
      const text = String(event.data)

      // Réponse au battement de cœur : ce n'est pas un événement métier.
      if (text === 'pong') {
        this.clearPongTimer()

        return
      }

      try {
        this.options.onMessage(JSON.parse(text))
      }
      catch {
        this.options.onMessage(event.data)
      }
    }

    socket.onclose = () => {
      if (this.socket !== socket)
        return

      this.socket = null
      this.stopHeartbeat()
      this.scheduleRetry()
    }

    // `onclose` suit toujours `onerror` : la reconnexion se décide là.
    socket.onerror = () => {}
  }

  private startHeartbeat(socket: WebSocket): void {
    this.stopHeartbeat()
    this.heartbeat = setInterval(() => {
      if (socket.readyState !== READY_OPEN)
        return

      try {
        socket.send('ping')
      }
      catch {
        this.drop(socket)

        return
      }

      if (!this.pongTimer) {
        this.pongTimer = setTimeout(() => {
          this.pongTimer = null

          // Pas de réponse : la connexion est morte, même si le navigateur la croit ouverte.
          this.drop(socket)
        }, this.options.pongTimeoutMs ?? PONG_TIMEOUT_MS)
      }
    }, this.options.heartbeatMs ?? HEARTBEAT_MS)
  }

  private stopHeartbeat(): void {
    if (this.heartbeat)
      clearInterval(this.heartbeat)

    this.heartbeat = null
    this.clearPongTimer()
  }

  private clearPongTimer(): void {
    if (this.pongTimer)
      clearTimeout(this.pongTimer)

    this.pongTimer = null
  }

  /** Abandonne une connexion défaillante et programme la reconnexion sans attendre l'événement de fermeture. */
  private drop(socket: WebSocket): void {
    if (this.socket !== socket)
      return

    this.socket = null
    this.stopHeartbeat()
    socket.onopen = socket.onmessage = socket.onclose = socket.onerror = null
    try {
      socket.close()
    }
    catch {
      // Déjà fermée : rien à faire.
    }
    this.scheduleRetry()
  }

  private scheduleRetry(): void {
    if (this.stopped)
      return

    this.options.onState('connecting')

    const min = this.options.minDelayMs ?? 1000
    const max = this.options.maxDelayMs ?? 30_000
    const delay = Math.min(max, min * 2 ** this.attempt) * (0.75 + Math.random() * 0.5)

    this.attempt += 1
    if (this.timer)
      clearTimeout(this.timer)

    this.timer = setTimeout(() => {
      this.timer = null
      this.connect()
    }, delay)
  }
}
