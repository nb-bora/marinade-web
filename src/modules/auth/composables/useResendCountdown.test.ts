import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { useResendCountdown } from './useResendCountdown'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

function setup(initial?: number) {
  const scope = effectScope()
  const countdown = scope.run(() => useResendCountdown(initial))!

  return { scope, countdown }
}

describe('compte à rebours du renvoi de code', () => {
  it('démarre à la valeur du serveur et descend d\'une seconde à la fois', () => {
    const { countdown } = setup(60)

    expect(countdown.remaining.value).toBe(60)
    expect(countdown.ready.value).toBe(false)

    vi.advanceTimersByTime(1000)
    expect(countdown.remaining.value).toBe(59)
  })

  it('autorise le renvoi à zéro et s\'arrête', () => {
    const { countdown } = setup(3)

    vi.advanceTimersByTime(10_000)

    expect(countdown.remaining.value).toBe(0)
    expect(countdown.ready.value).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('est prêt tout de suite sans délai initial', () => {
    const { countdown } = setup()

    expect(countdown.ready.value).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('repart à zéro quand on le relance, sans cumuler les minuteries', () => {
    const { countdown } = setup(60)

    vi.advanceTimersByTime(5000)
    countdown.start(60)

    expect(countdown.remaining.value).toBe(60)
    expect(vi.getTimerCount()).toBe(1)
  })

  it('arrondit à la seconde supérieure et ignore les valeurs invalides', () => {
    const { countdown } = setup(0)

    countdown.start(2.2)
    expect(countdown.remaining.value).toBe(3)

    countdown.start(Number.NaN)
    expect(countdown.remaining.value).toBe(0)

    countdown.start(-5)
    expect(countdown.remaining.value).toBe(0)
  })

  it('libère la minuterie quand la page est quittée', () => {
    const { scope } = setup(60)

    expect(vi.getTimerCount()).toBe(1)
    scope.stop()
    expect(vi.getTimerCount()).toBe(0)
  })
})
