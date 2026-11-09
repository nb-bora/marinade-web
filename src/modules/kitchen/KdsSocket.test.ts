import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { KdsSocket } from './KdsSocket'

/** Faux WebSocket : le test décide quand la connexion s'ouvre, reçoit ou tombe. */
class FakeSocket {
  static instances: FakeSocket[] = []
  readyState = 0
  sent: string[] = []
  closed = false
  onopen: (() => void) | null = null
  onmessage: ((event: { data: unknown }) => void) | null = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null

  constructor(readonly url: string, readonly protocols: string[]) {
    FakeSocket.instances.push(this)
  }

  send(data: string) {
    this.sent.push(data)
  }

  close() {
    this.closed = true
    this.readyState = 3
  }

  open() {
    this.readyState = 1
    this.onopen?.()
  }

  receive(data: string) {
    this.onmessage?.({ data })
  }
}

function setup(overrides: Partial<ConstructorParameters<typeof KdsSocket>[0]> = {}) {
  const onMessage = vi.fn()
  const onState = vi.fn()

  const socket = new KdsSocket({
    url: 'ws://test/v1/ros/ws/kds/r1/KITCHEN',
    getToken: () => 'jeton',
    onMessage,
    onState,
    ...overrides,
  })

  socket.start()

  return { socket, onMessage, onState }
}

const current = () => FakeSocket.instances[FakeSocket.instances.length - 1]

beforeEach(() => {
  vi.useFakeTimers()
  FakeSocket.instances = []
  vi.stubGlobal('WebSocket', FakeSocket)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('KdsSocket : battement de cœur', () => {
  it('envoie un ping toutes les 25 secondes une fois la connexion ouverte', () => {
    setup()
    current().open()

    vi.advanceTimersByTime(24_999)
    expect(current().sent).toEqual([])

    vi.advanceTimersByTime(1)
    expect(current().sent).toEqual(['ping'])
  })

  it('accepte le pong sans le transmettre comme événement métier', () => {
    const { onMessage } = setup()

    current().open()
    vi.advanceTimersByTime(25_000)
    current().receive('pong')
    vi.advanceTimersByTime(10_000)

    expect(current().closed).toBe(false)
    expect(onMessage).not.toHaveBeenCalled()
  })

  it('considère la connexion morte sans pong et la remplace', () => {
    const { onState } = setup()

    current().open()
    vi.advanceTimersByTime(25_000)
    expect(FakeSocket.instances).toHaveLength(1)

    vi.advanceTimersByTime(10_000)
    expect(FakeSocket.instances[0].closed).toBe(true)
    expect(onState).toHaveBeenLastCalledWith('connecting')

    vi.advanceTimersByTime(1_300)
    expect(FakeSocket.instances).toHaveLength(2)
  })
})

describe('KdsSocket : messages et reconnexion', () => {
  it('transmet les messages JSON décodés', () => {
    const { onMessage } = setup()

    current().open()
    current().receive('{"event":"ticket.created"}')

    expect(onMessage).toHaveBeenCalledWith({ event: 'ticket.created' })
  })

  it('se reconnecte après une coupure, puis s\'arrête sur demande', () => {
    const { socket, onState } = setup()

    current().open()
    expect(onState).toHaveBeenLastCalledWith('open')

    current().onclose?.()
    vi.advanceTimersByTime(1_300)
    expect(FakeSocket.instances).toHaveLength(2)

    socket.stop()
    expect(onState).toHaveBeenLastCalledWith('closed')
    vi.advanceTimersByTime(60_000)
    expect(FakeSocket.instances).toHaveLength(2)
  })
})
