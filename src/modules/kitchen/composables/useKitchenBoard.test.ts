import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import type { Station, Ticket } from '../types'
import { useKitchenBoard } from './useKitchenBoard'

const mocks = vi.hoisted(() => ({
  api: {
    board: vi.fn(),
    setStatus: vi.fn(),
    recall: vi.fn(),
    setPriority: vi.fn(),
    expireStale: vi.fn(),
  },
  toast: { error: vi.fn(), success: vi.fn() },
  tenant: { currentId: 'r1' as string | null },
}))

vi.mock('../api', () => ({ kitchenApi: mocks.api }))
vi.mock('../KdsSocket', () => ({
  KdsSocket: class {
    start() {}
    stop() {}
    retryNow() {}
  },
}))
vi.mock('@/container', () => ({
  container: { config: { wsBaseUrl: 'ws://test' }, tokens: { read: () => null }, http: {} },
}))
vi.mock('@/composables/useLive', async () => {
  const { ref } = await import('vue')

  return { useLive: () => ({ isLive: ref(false), pause() {}, resume() {} }) }
})
vi.mock('@/stores/tenant.store', () => ({ useTenantStore: () => mocks.tenant }))
vi.mock('@/stores/toast.store', () => ({ useToast: () => mocks.toast }))

const SOUND_KEY = 'marinade.kitchen.sound'

/** Ce que le serveur a en mémoire, par poste : le mock de l'API le lit à chaque lecture. */
let server: Record<Station, Ticket[]>
const scopes: { stop: () => void }[] = []

function ticket(id: string, status: Ticket['status'], extra: Partial<Ticket> = {}): Ticket {
  return {
    id,
    restaurant_id: 'r1',
    order_id: `order-${id}`,
    station: 'KITCHEN',
    status,
    items_jsonb: [{ product_name: 'Poulet braisé', quantity: 1, notes: null }],
    created_at: new Date().toISOString(),
    started_at: null,
    ready_at: null,
    served_at: null,
    cancelled_at: null,
    priority: 0,
    course: null,
    table_label: null,
    zone: null,
    ...extra,
  } as Ticket
}

/** Un écran (une instance du composable, comme un onglet ouvert ou une page rechargée). */
function screen() {
  const scope = effectScope()

  scopes.push(scope)

  return scope.run(() => useKitchenBoard())!
}

const ids = (tickets: Ticket[]) => tickets.map(item => item.id)

class FakeAudioContext {
  static created = 0
  state = 'suspended'
  currentTime = 0
  destination = {}
  static unlocks = true
  resume = vi.fn(async () => {
    if (FakeAudioContext.unlocks)
      this.state = 'running'
  })

  constructor() {
    FakeAudioContext.created += 1
  }

  createOscillator() {
    return { type: '', frequency: { value: 0 }, connect: () => ({ connect: () => ({}) }), start() {}, stop() {} }
  }

  createGain() {
    return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: () => ({ connect: () => ({}) }) }
  }
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  mocks.tenant.currentId = 'r1'
  server = { KITCHEN: [], BAR: [], DESSERT: [] }
  mocks.api.board.mockImplementation(async (_restaurant: string, station: Station) =>
    server[station].map(item => ({ ...item })))
  FakeAudioContext.created = 0
  FakeAudioContext.unlocks = true
  vi.stubGlobal('AudioContext', FakeAudioContext)
})

afterEach(() => {
  scopes.splice(0).forEach(scope => scope.stop())
  vi.unstubAllGlobals()
})

describe('état serveur : pas de « prêt » local', () => {
  it('le « prêt » vient du serveur et se réconcilie entre deux écrans', async () => {
    server.KITCHEN = [ticket('t1', 'IN_PREPARATION')]

    const first = screen()

    await first.refresh()
    expect(first.lanes.value.READY).toEqual([])

    // Un autre écran marque le plat prêt.
    server.KITCHEN = [ticket('t1', 'READY', { ready_at: new Date().toISOString() })]
    await first.refresh()
    expect(ids(first.lanes.value.READY)).toEqual(['t1'])

    // Un second écran (ou une page rechargée) voit exactement la même chose.
    const second = screen()

    await second.refresh()
    expect(ids(second.lanes.value.READY)).toEqual(['t1'])
  })

  it('un plat servi quitte « Prêt » et devient rappelable', async () => {
    server.KITCHEN = [ticket('t1', 'READY')]

    const board = screen()

    await board.refresh()
    server.KITCHEN = [ticket('t1', 'SERVED', { served_at: new Date().toISOString() })]
    await board.refresh()

    expect(board.lanes.value.READY).toEqual([])
    expect(ids(board.recallable.value)).toEqual(['t1'])
  })

  it('passer à l\'étape suivante relit l\'écran', async () => {
    server.KITCHEN = [ticket('t1', 'QUEUED')]

    const board = screen()

    await board.refresh()
    mocks.api.setStatus.mockImplementation(async (_restaurant: string, _id: string, status: Ticket['status']) => {
      server.KITCHEN = [ticket('t1', status)]

      return server.KITCHEN[0]
    })

    await board.advance(board.lanes.value.QUEUED[0])

    expect(mocks.api.setStatus).toHaveBeenCalledWith('r1', 't1', 'IN_PREPARATION')
    expect(ids(board.lanes.value.IN_PREPARATION)).toEqual(['t1'])
    expect(board.lanes.value.QUEUED).toEqual([])
  })

  it('une transition refusée (409) affiche le message et relit le ticket', async () => {
    server.KITCHEN = [ticket('t1', 'QUEUED')]

    const board = screen()

    await board.refresh()

    // Pendant ce temps, un autre écran l'a déjà commencé.
    server.KITCHEN = [ticket('t1', 'IN_PREPARATION')]
    mocks.api.setStatus.mockRejectedValueOnce(new Error('Ce ticket est déjà « En préparation ».'))

    await board.advance(board.lanes.value.QUEUED[0])

    expect(mocks.toast.error).toHaveBeenCalled()
    expect(board.lanes.value.QUEUED).toEqual([])
    expect(ids(board.lanes.value.IN_PREPARATION)).toEqual(['t1'])
  })
})

describe('courses entre lectures', () => {
  it('une réponse plus ancienne qui arrive en dernier ne remplace pas la plus récente', async () => {
    const board = screen()
    let resolveOld: (value: Ticket[]) => void = () => {}

    mocks.api.board
      .mockImplementationOnce(() => new Promise<Ticket[]>(resolve => { resolveOld = resolve }))
      .mockImplementationOnce(async () => [ticket('new', 'QUEUED')])

    const older = board.refresh(['KITCHEN'])
    const newer = board.refresh(['KITCHEN'])

    await newer
    resolveOld([ticket('old', 'QUEUED')])
    await older

    expect(ids(board.lanes.value.QUEUED)).toEqual(['new'])
  })

  it('une lecture qui échoue après des données valides les garde, signalées comme anciennes', async () => {
    server.KITCHEN = [ticket('t1', 'QUEUED')]

    const board = screen()

    await board.refresh()
    mocks.api.board.mockRejectedValueOnce(new Error('réseau'))
    await board.refresh(['KITCHEN'])

    expect(board.stale.value).toBe(true)
    expect(ids(board.lanes.value.QUEUED)).toEqual(['t1'])

    await board.refresh(['KITCHEN'])
    expect(board.stale.value).toBe(false)
  })
})

describe('son', () => {
  it('reste actif après un rechargement : la sonnerie reprend le contexte audio', async () => {
    localStorage.setItem(SOUND_KEY, '1')
    server.KITCHEN = [ticket('t1', 'QUEUED')]

    const board = screen()

    expect(board.soundEnabled.value).toBe(true)
    await board.refresh()
    expect(FakeAudioContext.created).toBe(0)

    server.KITCHEN = [ticket('t1', 'QUEUED'), ticket('t2', 'QUEUED')]
    await board.refresh()

    expect(FakeAudioContext.created).toBe(1)
    expect(board.announcement.value).toBe('Nouvelle commande')
    expect(board.soundBlocked.value).toBe(false)
  })

  it('signale que le son est bloqué quand le navigateur le refuse', async () => {
    FakeAudioContext.unlocks = false
    localStorage.setItem(SOUND_KEY, '1')
    server.KITCHEN = [ticket('t1', 'QUEUED')]

    const board = screen()

    await board.refresh()
    server.KITCHEN = [ticket('t1', 'QUEUED'), ticket('t2', 'QUEUED')]
    await board.refresh()

    expect(board.soundBlocked.value).toBe(true)
  })

  it('n\'annonce pas les tickets déjà présents au premier chargement', async () => {
    localStorage.setItem(SOUND_KEY, '1')
    server.KITCHEN = [ticket('t1', 'QUEUED'), ticket('t2', 'QUEUED')]

    const board = screen()

    await board.refresh()

    expect(board.announcement.value).toBe('')
    expect(FakeAudioContext.created).toBe(0)
  })
})
