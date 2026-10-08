import type { Ref } from 'vue'
import { kitchenApi } from '../api'
import { KdsSocket } from '../KdsSocket'
import type { SocketState } from '../KdsSocket'
import { STATIONS } from '../labels'
import type { Lane, Station, Ticket } from '../types'
import { container } from '@/container'
import { useLive } from '@/composables/useLive'
import { useTenantStore } from '@/stores/tenant.store'
import { useToast } from '@/stores/toast.store'

/** Actualisation de secours : toutes les 5 s, même quand le WebSocket est ouvert. */
const POLL_MS = 5000

/** Durée pendant laquelle un nouveau ticket reste mis en évidence. */
const FRESH_MS = 8000

const SOUND_KEY = 'marinade.kitchen.sound'

type ByStation<T> = Record<Station, T>

const empty = <T>(make: () => T): ByStation<T> => ({ KITCHEN: make(), BAR: make(), DESSERT: make() })

function readSoundPreference(): boolean {
  try {
    return window.localStorage.getItem(SOUND_KEY) === '1'
  }
  catch {
    return false
  }
}

/** Deux notes brèves et douces : audible dans une cuisine sans agresser la salle. */
function chime(context: AudioContext) {
  const start = context.currentTime

  ;[880, 1174.66].forEach((frequency, index) => {
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    const at = start + index * 0.16

    oscillator.type = 'sine'
    oscillator.frequency.value = frequency
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.exponentialRampToValueAtTime(0.18, at + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.3)
    oscillator.connect(gain).connect(context.destination)
    oscillator.start(at)
    oscillator.stop(at + 0.32)
  })
}

/**
 * L'état de l'écran de production : les tickets des trois postes, leur avancement, le temps réel.
 *
 * Le serveur ne liste que les tickets « à préparer » et « en préparation » : dès qu'un ticket est
 * « prêt », il disparaît de la réponse. L'écran garde donc lui-même les tickets prêts, le temps
 * qu'on les serve (ils sont perdus si l'on recharge la page : la cuisine ne s'en sert plus après).
 */
export function useKitchenBoard() {
  const tenant = useTenantStore()
  const toast = useToast()

  const station = ref<Station>('KITCHEN')

  /** Tickets du serveur : « à préparer » et « en préparation ». */
  const pending = ref(empty<Ticket[]>(() => [])) as Ref<ByStation<Ticket[]>>

  /** Tickets déjà prêts, gardés ici jusqu'à ce qu'on les serve. */
  const done = ref(empty<Ticket[]>(() => [])) as Ref<ByStation<Ticket[]>>
  const loadedOnce = ref(false)
  const error = ref<unknown>(null)
  const fresh = ref(new Set<string>())
  const socketState = ref<SocketState>('closed')

  const soundEnabled = ref(readSoundPreference())
  let audio: AudioContext | null = null

  // Toute écriture invalide les réponses de lecture parties avant elle (elles seraient périmées).
  let version = 0
  const known = empty(() => new Set<string>())
  const primed = empty(() => false)

  const restaurantId = computed(() => tenant.currentId)

  const lanes = computed<Record<Lane, Ticket[]>>(() => ({
    QUEUED: pending.value[station.value].filter(ticket => ticket.status === 'QUEUED'),
    IN_PREPARATION: pending.value[station.value].filter(ticket => ticket.status === 'IN_PREPARATION'),
    READY: done.value[station.value],
  }))

  /** Compteur de chaque poste : ce qu'il reste à faire (le « prêt » n'est plus du travail). */
  const counts = computed(() => Object.fromEntries(
    STATIONS.map(item => [item.value, pending.value[item.value].length]),
  ) as ByStation<number>)

  function markFresh(ids: string[]) {
    fresh.value = new Set([...fresh.value, ...ids])
    setTimeout(() => {
      const next = new Set(fresh.value)

      ids.forEach(id => next.delete(id))
      fresh.value = next
    }, FRESH_MS)
  }

  function ring() {
    if (!soundEnabled.value || !audio)
      return

    void audio.resume().then(() => chime(audio as AudioContext)).catch(() => {})
  }

  async function refresh(): Promise<void> {
    const id = restaurantId.value

    if (!id)
      return

    const started = version

    try {
      const results = await Promise.all(STATIONS.map(item => kitchenApi.pending(id, item.value)))

      if (started !== version || id !== restaurantId.value)
        return

      const arrivals: Record<Station, string[]> = empty(() => [])

      STATIONS.forEach((item, index) => {
        const tickets = results[index]
        const seen = known[item.value]

        // Le tout premier chargement d'un poste n'est pas une « arrivée ».
        if (primed[item.value])
          arrivals[item.value] = tickets.filter(ticket => !seen.has(ticket.id)).map(ticket => ticket.id)

        tickets.forEach(ticket => seen.add(ticket.id))
        primed[item.value] = true
        pending.value[item.value] = tickets
      })

      const incoming = arrivals[station.value]

      if (incoming.length) {
        markFresh(incoming)
        ring()
      }

      error.value = null
      loadedOnce.value = true
    }
    catch (cause) {
      if (!loadedOnce.value)
        error.value = cause
    }
  }

  // Le WebSocket n'est qu'un signal « du nouveau » : on relit alors les tickets (source de vérité).
  let socket: KdsSocket | null = null

  function openSocket() {
    socket?.stop()
    socket = null

    const id = restaurantId.value

    if (!id) {
      socketState.value = 'closed'

      return
    }

    socket = new KdsSocket({
      url: `${container.config.wsBaseUrl}/v1/ros/ws/kds/${id}/${station.value}`,
      getToken: () => container.tokens.read()?.accessToken ?? null,
      onMessage: () => {
        refresh()
      },
      onState: state => {
        socketState.value = state
      },
    })
    socket.start()
  }

  // Le repli (actualisation périodique) tourne toujours : il met aussi à jour les compteurs
  // des deux autres postes, que le WebSocket d'un seul poste ne voit pas.
  const live = useLive(refresh, POLL_MS)

  watch(restaurantId, () => {
    pending.value = empty(() => [])
    done.value = empty(() => [])
    STATIONS.forEach(item => {
      known[item.value].clear()
      primed[item.value] = false
    })
    loadedOnce.value = false
    version += 1
    void refresh()
    openSocket()
  })

  watch(station, () => openSocket())

  const online = useOnline()

  watch(online, isOnline => {
    if (isOnline) {
      socket?.retryNow()
      void refresh()
    }
  })

  openSocket()
  onScopeDispose(() => socket?.stop())

  async function toggleSound() {
    soundEnabled.value = !soundEnabled.value

    try {
      window.localStorage.setItem(SOUND_KEY, soundEnabled.value ? '1' : '0')
    }
    catch {
      // Stockage indisponible : le choix vaut pour cette session seulement.
    }

    if (!soundEnabled.value)
      return

    // Un navigateur n'autorise le son qu'après un geste de l'utilisateur : ce clic en est un.
    audio ??= new AudioContext()
    await audio.resume()
    chime(audio)
  }

  /** Plusieurs boutons peuvent être touchés à la suite : on suit les tickets en cours d'envoi. */
  const busy = ref(new Set<string>())

  async function move(ticket: Ticket, next: Ticket['status']) {
    const id = restaurantId.value

    if (!id || busy.value.has(ticket.id))
      return

    busy.value = new Set([...busy.value, ticket.id])

    try {
      const updated = await kitchenApi.setStatus(id, ticket.id, next)
      const where = ticket.station as Station

      version += 1
      pending.value[where] = pending.value[where].filter(item => item.id !== ticket.id)
      done.value[where] = done.value[where].filter(item => item.id !== ticket.id)

      if (next === 'READY')
        done.value[where] = [...done.value[where], updated]
      else if (next !== 'SERVED')
        pending.value[where] = [...pending.value[where], updated].sort((a, b) => a.created_at.localeCompare(b.created_at))
    }
    catch (cause) {
      toast.error(cause)
    }
    finally {
      const rest = new Set(busy.value)

      rest.delete(ticket.id)
      busy.value = rest
    }
  }

  return {
    station,
    lanes,
    counts,
    loadedOnce,
    error,
    fresh,
    busy,
    socketState,
    soundEnabled,
    isPolling: live.isLive,
    refresh,
    move,
    toggleSound,
  }
}
