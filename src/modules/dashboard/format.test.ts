import { describe, expect, it } from 'vitest'
import { clock, compact, duration, localHour, moneyParts, plural } from './format'

describe('format du tableau de bord', () => {
  it('sépare le montant de la devise', () => {
    const { amount, unit } = moneyParts(482500, 'XAF')

    expect(amount.replace(/\s/g, '')).toBe('482500')
    expect(unit).toBe('FCFA')
  })

  it('abrège les grands montants', () => {
    expect(compact(950)).toBe('950')
    expect(compact(12_500)).toBe('12,5 k')
    expect(compact(482_500)).toBe('483 k')
    expect(compact(2_400_000)).toBe('2,4 M')
  })

  it('écrit les durées en heures et minutes', () => {
    expect(duration(41)).toBe('41 min')
    expect(duration(95)).toBe('1 h 35 min')
    expect(duration(120)).toBe('2 h 00 min')
  })

  it('accorde les pluriels', () => {
    expect(plural(1, 'table')).toBe('1 table')
    expect(plural(3, 'table')).toBe('3 tables')
    expect(plural(0, 'table')).toBe('0 table')
  })

  it('lit l\'heure dans le fuseau de l\'établissement, pas celui du navigateur', () => {
    // 19:00 UTC = 20:00 à Douala (UTC+1)
    expect(localHour('2026-11-14T19:00:00Z', 'Africa/Douala')).toBe(20)
    expect(clock('2026-11-14T19:05:00Z', 'Africa/Douala')).toBe('20:05')
    expect(localHour('2026-11-14T23:30:00Z', 'Africa/Douala')).toBe(0)
  })
})
