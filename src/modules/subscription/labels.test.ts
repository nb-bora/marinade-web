import { describe, expect, it } from 'vitest'
import { daysBetween, gaugeColor, gaugeMessage, monthsOffered, statusNote } from './labels'
import type { Tier } from './types'

const tier = (monthly: number, annual: number) => ({ monthly_price_fcfa: monthly, annual_price_fcfa: annual } as unknown as Tier)

describe('abonnement', () => {
  it('colore la jauge de plus en plus fort à mesure que le plafond se vide', () => {
    expect(gaugeColor(10)).toBe('success')
    expect(gaugeColor(70)).toBe('warning')
    expect(gaugeColor(90)).toBe('error')
  })

  it('prévient quand le plafond du jour est atteint ou presque', () => {
    expect(gaugeMessage(100, 0)).toContain('atteint')
    expect(gaugeMessage(95, 500)).toContain('presque')
    expect(gaugeMessage(40, 6000)).toBeNull()
  })

  it('ne dit rien d\'un abonnement actif, explique les autres', () => {
    expect(statusNote('active')).toBeNull()
    expect(statusNote('suspended')).toContain('suspendu')
    expect(statusNote('inconnu')).toBeNull()
  })

  it('compte les mois offerts de l\'offre annuelle', () => {
    expect(monthsOffered(tier(10_000, 100_000))).toBe(2)
    expect(monthsOffered(tier(10_000, 120_000))).toBe(0)
    expect(monthsOffered(tier(0, 0))).toBe(0)
  })

  it('compte les jours entre deux dates', () => {
    expect(daysBetween('2026-01-01', '2026-01-31')).toBe(30)
  })
})
