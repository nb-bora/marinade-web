import { describe, expect, it } from 'vitest'
import { rangeFor } from './ranges'
import { IN_FLIGHT, STATUS_GROUPS, countOfGroup, isInFlight, presentStatus, statusesOfGroup } from './statuses'
import { PAYMENT_STATUSES } from '@/lib/api/types'

describe('familles de statuts', () => {
  it('chaque statut de la passerelle appartient à exactement une famille', () => {
    const grouped = STATUS_GROUPS.flatMap(group => [...group.statuses])

    expect([...grouped].sort()).toEqual([...PAYMENT_STATUSES].sort())
    expect(new Set(grouped).size).toBe(grouped.length)
  })

  it('« Toutes » ne filtre rien', () => {
    expect(statusesOfGroup('all')).toEqual([])
  })

  it('« En attente » regroupe les paiements encore en route', () => {
    expect(statusesOfGroup('pending')).toEqual([...IN_FLIGHT])
    expect(IN_FLIGHT.every(status => isInFlight(status))).toBe(true)
  })

  it('compte une famille d\'après le résumé de la période', () => {
    const byStatus = {
      success: { count: 7 },
      failed: { count: 2 },
      timeout: { count: 1 },
      pending: { count: 3 },
    }

    expect(countOfGroup(byStatus, 'all')).toBe(13)
    expect(countOfGroup(byStatus, 'success')).toBe(7)
    expect(countOfGroup(byStatus, 'failed')).toBe(3)
    expect(countOfGroup(byStatus, 'pending')).toBe(3)
    expect(countOfGroup(byStatus, 'other')).toBe(0)
    expect(countOfGroup(undefined, 'all')).toBe(0)
  })

  it('un statut inconnu garde son libellé brut', () => {
    expect(presentStatus('quantum').label).toBe('quantum')
    expect(presentStatus('success').tone).toBe('success')
  })
})

describe('périodes', () => {
  const now = new Date(2026, 10, 10, 15, 30)

  it('« aujourd\'hui » commence à minuit, heure locale', () => {
    expect(rangeFor('today', now).from).toEqual(new Date(2026, 10, 10))
  })

  it('« 7 jours » inclut aujourd\'hui et les six jours précédents', () => {
    expect(rangeFor('7d', now).from).toEqual(new Date(2026, 10, 4))
  })

  it('« tout » n\'a aucune borne', () => {
    expect(rangeFor('all', now)).toEqual({})
  })
})
