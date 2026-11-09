import { describe, expect, it } from 'vitest'
import { actionsFor, formatWait, isForcable, messageOf, presentStatus, primaryActionFor } from './labels'
import { ApiError } from '@/lib/http/errors'

const avant = new Date('2026-11-14T17:00:00.000Z')
const apres = new Date('2026-11-14T19:30:00.000Z')
const debut = new Date('2026-11-14T18:00:00.000Z')

describe('actions proposées selon l\'état', () => {
  it('une demande en attente : confirmer et noter l\'arrivée d\'abord, absence seulement après l\'heure', () => {
    expect(actionsFor('pending', { starts: debut, now: avant })).toEqual(['confirm', 'checkin', 'edit', 'cancel'])
    expect(actionsFor('pending', { starts: debut, now: apres })).toEqual(['confirm', 'checkin', 'noshow', 'edit', 'cancel'])
  })

  it('une réservation confirmée ne se confirme plus', () => {
    expect(actionsFor('confirmed', { starts: debut, now: apres })).toEqual(['checkin', 'noshow', 'edit', 'cancel'])
    expect(primaryActionFor('confirmed')).toBe('checkin')
  })

  it('un client arrivé se termine ; il ne peut plus être annulé ni absent', () => {
    expect(actionsFor('checked_in', { starts: debut, now: apres })).toEqual(['complete', 'edit'])
  })

  it('une réservation close n\'offre aucune action', () => {
    for (const status of ['completed', 'cancelled', 'no_show'])
      expect(actionsFor(status, { starts: debut, now: apres })).toEqual([])
  })
})

describe('présentation des états', () => {
  it('chaque état a un libellé français visible', () => {
    expect(presentStatus('pending').label).toBe('En attente')
    expect(presentStatus('checked_in').label).toBe('Arrivée')
    expect(presentStatus('no_show').label).toBe('Absente')
    expect(presentStatus('cancelled').closed).toBe(true)
  })

  it('un état inconnu ne plante pas', () => {
    expect(presentStatus('BOGUS').label).toBe('Inconnue')
  })
})

describe('refus forçables', () => {
  it('capacité, horaires et date passée peuvent être forcés par la gestion', () => {
    expect(isForcable('La table T1 accueille 2 personne(s) : 3 couverts dépassent la capacité. Seule la gestion peut forcer.')).toBe(true)
    expect(isForcable('Ce créneau est hors des horaires d\'ouverture. Seule la gestion peut le forcer.')).toBe(true)
    expect(isForcable('La date est passée. Seule la gestion peut enregistrer une réservation dans le passé.')).toBe(true)
  })

  it('un chevauchement sur une table ne se force pas', () => {
    expect(isForcable('La table T1 est déjà réservée : Mme Ngo, 2 couvert(s), à 19:00.')).toBe(false)
    expect(isForcable('La table T1 n\'est pas libre.')).toBe(false)
  })
})

describe('messages et attentes', () => {
  it('formate les attentes en minutes et en heures', () => {
    expect(formatWait(0)).toBe('à l\'instant')
    expect(formatWait(5)).toBe('5 min')
    expect(formatWait(65)).toBe('1 h 05')
  })

  it('montre le message du serveur pour un refus métier, sinon un repli générique', () => {
    const refus = new ApiError({ status: 409, message: 'Table déjà réservée' })
    const panne = new ApiError({ status: 500, message: 'boom' })

    expect(messageOf(refus)).toBe('Table déjà réservée')
    expect(messageOf(panne)).not.toBe('boom')
  })
})
