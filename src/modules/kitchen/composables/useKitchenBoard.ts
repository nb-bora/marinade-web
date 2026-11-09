import type { Ref } from 'vue'
import { kitchenApi } from '../api'
import { KdsSocket } from '../KdsSocket'
import type { SocketState } from '../KdsSocket'
import { STATIONS, aggregateByArticle, isOpen, nextAction } from '../labels'
import type { Lane, Station, Ticket } from '../types'
import { container } from '@/container'
import { useLive } from '@/composables/useLive'
import { useTenantStore } from '@/stores/tenant.store'
import { useToast } from '@/stores/toast.store'

/** Actualisation de secours : toutes les 5 s, même quand le WebSocket est ouvert. */
export const POLL_MS = 5000

/** Durée pendant laquelle un nouveau ticket reste mis en évidence. */
export const FRESH_MS = 8000

const SOUND_KEY = 'marinade.kitchen.sound'
const ALL_STATIONS: Station[] = STATIONS.map(item => item.value)

type ByStation<T> = Record<Station, T>
export type BoardView = 'lanes' | 'all'

const emptyByStation = <T>(make: () => T): ByStation<T> => ({ KITCHEN: make(), BAR: make(), DESSERT: make() })

function readSoundPreference(): boolean {
  try {
    return window.localStorage.getItem(SOUND_KEY) === '1'
  }
  catch {
    return false
  }
}

function writeSoundPreference(enabled: boolean) {
  try {
    window.localStorage.setItem(SOUND_KEY, enabled ? '1' : '0')
  }
  catch {
    // Stockage indisponible : le choix vaut pour cette session seulement.
  }
}

/** Deux notes brèves et douces : audible dans une cuisine sans agresser la salle. */
export function chime(context: AudioContext) {
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
 * L'état de l'écran de production.
 *
 * Source unique : le serveur. Chaque lecture remplace l'état du poste (« prêt » compris), donc deux
 * écrans concordent et un rechargement ne perd rien. Les écritures passent par l'API, puis l'écran
 * relit le poste pour se réconcilier, en succès comme en erreur.
 */
export function useKitchenBoard() {
  const tenant = useTenantStore()
  const toast = useToast()

  const station = ref<Station>('KITCHEN')
  const view = ref<BoardView>('lanes')

  /** Tickets affichés par poste, tels que le serveur les renvoie. */
  const boards = ref(emptyByStation<Ticket[]>(() => [])) as Ref<ByStation<Ticket[]>>

  const loadedOnce = ref(false)

  /** Première lecture en échec : pas de données à montrer. */
  const error = ref<unknown>(null)

  /** Une lecture a échoué après des données valides : on les garde, signalées comme anciennes. */
  const stale = ref(false)
  const staleSince = ref<number | null>(null)

  const fresh = ref(new Set<string>())
  const busy = ref(new Set<string>())
  const announcement = ref('')
  const socketState = ref<SocketState>('closed')

  const soundEnabled = ref(readSoundPreference())

  /** Le navigateur refuse le son (aucun geste de l'utilisateur depuis le chargement). */
  const soundBlocked = ref(false)

  let audio: AudioContext | null = null

  // Ordre des lectures : une réponse plus ancienne que la dernière demande est ignorée.
  let sequence = 0
  let inFlight: AbortController | null = null

  const known = emptyByStation(() => new Set<string>())
  const primed = emptyByStation(() => false)

  const restaurantId = computed(() => tenant.currentId)
  const current = computed(() => boards.value[station.value])

  const lanes = computed<Record<Lane, Ticket[]>>(() => ({
    QUEUED: current.value.filter(ticket => ticket.status === 'QUEUED'),
    IN_PREPARATION: current.value.filter(ticket => ticket.status === 'IN_PREPARATION'),
    READY: current.value.filter(ticket => ticket.status === 'READY'),
  }))

  /** « Servi » encore rappelable (le serveur ne le renvoie que dans la fenêtre de rappel). */
  const recallable = computed(() => current.value.filter(ticket => ticket.status === 'SERVED'))

  /** Ce qu'il reste à faire, par poste : sert aux compteurs du sélecteur. */
  const counts = computed(() => Object.fromEntries(
    STATIONS.map(item => [item.value, boards.value[item.value].filter(isOpen).length]),
  ) as ByStation<number>)

  /** « Tout le service » : mêmes tickets que les indicateurs, additionnés par article. */
  const totals = computed(() => aggregateByArticle(current.value.filter(isOpen)))

  const isLive = computed(() => socketState.value === 'open')

  function markFresh(ids: string[]) {
    fresh.value = new Set([...fresh.value, ...ids])
    setTimeout(() => {
      const next = new Set(fresh.value)

      ids.forEach(id => next.delete(id))
      fresh.value = next
    }, FRESH_MS)
  }

  // Son ---------------------------------------------------------------------------------------

  /** Crée ou reprend le contexte audio ; renvoie `true` s'il peut jouer. */
  async function unlockAudio(): Promise<boolean> {
    try {
      audio ??= new AudioContext()
      if (audio.state !== 'running')
        await audio.resume()
      soundBlocked.value = audio.state !== 'running'
    }
    catch {
      soundBlocked.value = true
    }

    return !soundBlocked.value
  }

  /** Une sonnerie : le contexte est repris à chaque fois, car le navigateur peut l'avoir suspendu. */
  async function ring(): Promise<void> {
    if (!soundEnabled.value)
      return

    if (await unlockAudio() && audio)
      chime(audio)
  }

  // Le premier geste de l'utilisateur débloque un son bloqué, sans qu'il ait à chercher le bouton.
  function onGesture() {
    void unlockAudio()
  }

  watch(soundBlocked, blocked => {
    if (blocked && soundEnabled.value)
      window.addEventListener('pointerdown', onGesture, { once: true })
  })

  // Lecture ------------------------------------------------------------------------------------

  function applyBoard(item: Station, tickets: Ticket[]) {
    const seen = known[item]

    // Le tout premier chargement d'un poste n'est pas une « arrivée ».
    if (primed[item]) {
      const arrivals = tickets.filter(ticket => ticket.status === 'QUEUED' && !seen.has(ticket.id)).map(ticket => ticket.id)

      if (arrivals.length && item === station.value) {
        markFresh(arrivals)
        announcement.value = arrivals.length === 1 ? 'Nouvelle commande' : `${arrivals.length} nouvelles commandes`
        void ring()
      }
    }

    tickets.forEach(ticket => seen.add(ticket.id))
    primed[item] = true
    boards.value[item] = tickets
  }

  /** Relit les postes demandés. Une lecture plus récente annule la précédente en vol. */
  async function refresh(only: readonly Station[] = ALL_STATIONS): Promise<void> {
    const id = restaurantId.value

    if (!id)
      return

    inFlight?.abort()

    const controller = new AbortController()
    const mine = ++sequence

    inFlight = controller

    try {
      const results = await Promise.all(only.map(item => kitchenApi.board(id, item, controller.signal)))

      if (mine !== sequence || id !== restaurantId.value)
        return

      only.forEach((item, index) => applyBoard(item, results[index]))
      loadedOnce.value = true
      error.value = null
      stale.value = false
      staleSince.value = null
    }
    catch (cause) {
      if (mine !== sequence || controller.signal.aborted)
        return

      if (!loadedOnce.value) {
        error.value = cause
      }
      else if (!stale.value) {
        stale.value = true
        staleSince.value = Date.now()
      }
    }
    finally {
      if (inFlight === controller)
        inFlight = null
    }
  }

  // Temps réel ----------------------------------------------------------------------------------

  // Le WebSocket n'est qu'un signal : on relit le poste courant (source de vérité).
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
        void refresh([station.value])
      },
      onState: state => {
        socketState.value = state

        // Une connexion (re)ouverte peut avoir manqué des événements : on relit.
        if (state === 'open')
          void refresh([station.value])
      },
    })
    socket.start()
  }

  // Le repli (actualisation périodique) tourne toujours : il met aussi à jour les compteurs
  // des autres postes, que le WebSocket du poste courant ne voit pas.
  const live = useLive(() => refresh(), POLL_MS)

  watch(restaurantId, () => {
    boards.value = emptyByStation(() => [])
    ALL_STATIONS.forEach(item => {
      known[item].clear()
      primed[item] = false
    })
    loadedOnce.value = false
    error.value = null
    stale.value = false
    void refresh()
    openSocket()
  })

  watch(station, () => {
    void refresh([station.value])
    openSocket()
  })

  const online = useOnline()

  watch(online, isOnline => {
    if (isOnline) {
      socket?.retryNow()
      void refresh()
    }
  })

  openSocket()
  onScopeDispose(() => {
    socket?.stop()
    window.removeEventListener('pointerdown', onGesture)
  })

  // Actions -------------------------------------------------------------------------------------

  /** Envoie une action sur un ticket. Une seule à la fois par ticket ; l'écran est relu ensuite. */
  async function perform(ticket: Ticket, request: () => Promise<unknown>): Promise<void> {
    if (busy.value.has(ticket.id))
      return

    busy.value = new Set([...busy.value, ticket.id])

    try {
      await request()
    }
    catch (cause) {
      // Typiquement un 409 : le ticket a déjà changé ailleurs. Le message le dit, l'écran se relit.
      toast.error(cause)
    }
    finally {
      const rest = new Set(busy.value)

      rest.delete(ticket.id)
      busy.value = rest
      await refresh([ticket.station as Station])
    }
  }

  /** Passe le ticket à l'étape suivante (Commencer, Prêt, Servi). */
  function advance(ticket: Ticket): Promise<void> {
    const action = nextAction(ticket)
    const id = restaurantId.value

    if (!action || !id)
      return Promise.resolve()

    return perform(ticket, () => kitchenApi.setStatus(id, ticket.id, action.next))
  }

  /** Rappelle un plat servi par erreur (pendant 2 minutes). */
  function recall(ticket: Ticket): Promise<void> {
    const id = restaurantId.value

    if (!id)
      return Promise.resolve()

    return perform(ticket, () => kitchenApi.recall(id, ticket.id))
  }

  /** Passe le ticket en tête de file, ou le remet dans l'ordre normal. */
  function togglePriority(ticket: Ticket): Promise<void> {
    const id = restaurantId.value

    if (!id)
      return Promise.resolve()

    const priority = ticket.priority > 0 ? 0 : 1

    return perform(ticket, () => kitchenApi.setPriority(id, ticket.id, priority))
  }

  /** Annule les tickets périmés du restaurant (gestion). Renvoie leur nombre. */
  async function expireStale(): Promise<number | null> {
    const id = restaurantId.value

    if (!id)
      return null

    try {
      const count = await kitchenApi.expireStale(id)

      toast.success(count
        ? `${count} ticket${count > 1 ? 's' : ''} périmé${count > 1 ? 's' : ''} annulé${count > 1 ? 's' : ''}`
        : 'Aucun ticket périmé')
      await refresh()

      return count
    }
    catch (cause) {
      toast.error(cause)

      return null
    }
  }

  /** Active le son : le clic de l'utilisateur débloque le contexte audio et confirme par une note. */
  async function unlockSound(): Promise<void> {
    if (!soundEnabled.value) {
      soundEnabled.value = true
      writeSoundPreference(true)
    }

    if (await unlockAudio() && audio)
      chime(audio)
  }

  async function toggleSound(): Promise<void> {
    if (soundEnabled.value) {
      soundEnabled.value = false
      writeSoundPreference(false)
      soundBlocked.value = false

      return
    }

    await unlockSound()
  }

  return {
    station,
    view,
    lanes,
    recallable,
    counts,
    totals,
    openTickets: computed(() => current.value.filter(isOpen)),
    loadedOnce,
    error,
    stale,
    staleSince,
    fresh,
    busy,
    announcement,
    socketState,
    isLive,
    soundEnabled,
    soundBlocked,
    isPolling: live.isLive,
    refresh,
    advance,
    recall,
    togglePriority,
    expireStale,
    toggleSound,
    unlockSound,
  }
}
