import { describe, expect, it } from 'vitest'
import type { SalleConfig } from './layout'
import { addLevel, defaultSalle, freeSeats, guessZoneType, levelIdOf, moveLevel, nextTableNumbers, placementOf, readSalle, removeLevel, removeZone, renameLevel, seatsLabel, slug, upsertZone, withPlacement, withSalle } from './layout'
import type { Table, TableView } from './types'

const table = (over: Partial<Table> = {}) => ({ id: 't1', numero: 'T1', capacite: 4, statut: 'libre', emplacement: null, attributs_jsonb: null, ...over }) as unknown as Table
const view = (t: Table, covers: number | null = null, withSession = false) => ({ table: t, session: withSession ? { id: 's' } : null, covers, total: null, amountDue: null }) as unknown as TableView

describe('lecture de l\'aménagement', () => {
  it('donne un niveau unique quand rien n\'est configuré ou que la config est abîmée', () => {
    for (const config of [null, undefined, {}, { salle: 12 }, { salle: { niveaux: 'x' } }, { salle: { niveaux: [{ id: 3 }] } }])
      expect(readSalle(config).niveaux).toEqual([{ id: 'rdc', nom: 'Rez-de-chaussée' }])
  })

  it('garde les niveaux valides, sans doublon, et classe les zones', () => {
    const salle = readSalle({ salle: { niveaux: [{ id: 'rdc', nom: 'RDC' }, { id: 'rdc', nom: 'Copie' }, { id: 'e1', nom: ' Étage 1 ' }], zones: [{ nom: 'Terrasse', niveau: 'e1' }, { nom: 'Bar', type: 'bar', niveau: 'inconnu' }, { nom: 'Terrasse' }] } })

    expect(salle.niveaux.map(l => l.id)).toEqual(['rdc', 'e1'])
    expect(salle.niveaux[1].nom).toBe('Étage 1')
    expect(salle.zones).toEqual([{ nom: 'Terrasse', type: 'terrasse', niveau: 'e1' }, { nom: 'Bar', type: 'bar', niveau: 'rdc' }])
  })

  it('conserve les autres clés de la config du restaurant', () => {
    const merged = withSalle({ taxes: { tva: 19 }, salle: { ancien: true } }, defaultSalle())

    expect(merged.taxes).toEqual({ tva: 19 })
    expect(merged.salle).toEqual({ version: 1, niveaux: [{ id: 'rdc', nom: 'Rez-de-chaussée' }], zones: [] })
  })

  it('devine le type d\'une zone d\'après son nom', () => {
    expect(guessZoneType('Terrasse du jardin')).toBe('terrasse')
    expect(guessZoneType('Bar')).toBe('bar')
    expect(guessZoneType('Salon VIP')).toBe('vip')
    expect(guessZoneType('Grande salle')).toBe('salle')
  })
})

describe('emplacement d\'une table', () => {
  it('lit et écrit le plan sans toucher au service en cours', () => {
    const t = table({ attributs_jsonb: { service: { session_id: 's1', covers: 2 } } })
    const update = withPlacement(t, { niveau: 'e1', x: 12.34, y: 56.78, forme: 'round', rot: 30 })

    expect(update.attributs_jsonb).toEqual({ service: { session_id: 's1', covers: 2 }, plan: { niveau: 'e1', x: 12.3, y: 56.8, forme: 'round', rot: 30 } })
    expect(placementOf(table({ attributs_jsonb: update.attributs_jsonb as Record<string, unknown> }))).toEqual({ niveau: 'e1', x: 12.3, y: 56.8, forme: 'round', rot: 30 })
  })

  it('ignore un plan invalide et borne les coordonnées', () => {
    expect(placementOf(table({ attributs_jsonb: { plan: { niveau: 'e1', x: 'a', y: 1 } } }))).toBeNull()
    expect(placementOf(table({ attributs_jsonb: { plan: { niveau: 'e1', x: 150, y: -5 } } }))).toMatchObject({ x: 100, y: 0 })
  })

  it('range une table sur son niveau : emplacement, sinon zone, sinon premier niveau', () => {
    const salle: SalleConfig = { version: 1, niveaux: [{ id: 'rdc', nom: 'RDC' }, { id: 'e1', nom: 'Étage' }], zones: [{ nom: 'Terrasse', type: 'terrasse', niveau: 'e1' }] }

    expect(levelIdOf(table({ attributs_jsonb: { plan: { niveau: 'e1', x: 1, y: 1 } } }), salle)).toBe('e1')
    expect(levelIdOf(table({ emplacement: 'terrasse' }), salle)).toBe('e1')
    expect(levelIdOf(table(), salle)).toBe('rdc')
    expect(levelIdOf(table({ attributs_jsonb: { plan: { niveau: 'supprime', x: 1, y: 1 } } }), salle)).toBe('rdc')
  })
})

describe('places libres', () => {
  it('compte les places restantes d\'une table servie', () => {
    expect(freeSeats(view(table({ capacite: 6 }), 4, true))).toBe(2)
    expect(freeSeats(view(table({ capacite: 4 }), 9, true))).toBe(0)
    expect(freeSeats(view(table({ capacite: 4 }), null, false))).toBe(4)
  })

  it('écrit ce que le plan affiche', () => {
    expect(seatsLabel(view(table({ capacite: 4 })))).toBe('4 places')
    expect(seatsLabel(view(table({ capacite: 6 }), 4, true))).toBe('2 places libres')
    expect(seatsLabel(view(table({ capacite: 4 }), 3, true))).toBe('1 place libre')
    expect(seatsLabel(view(table({ capacite: 2 }), 2, true))).toBe('complète')
    expect(seatsLabel(view(table({ capacite: 4 }), null, true))).toBe('4 places')
  })
})

describe('niveaux et zones', () => {
  const base = defaultSalle()

  it('ajoute, renomme et ordonne les niveaux', () => {
    let salle = addLevel(base, 'Étage 1')

    salle = addLevel(salle, 'Rooftop')
    expect(salle.niveaux.map(l => l.id)).toEqual(['rdc', 'etage-1', 'rooftop'])
    expect(moveLevel(salle, 'rooftop', -1).niveaux.map(l => l.id)).toEqual(['rdc', 'rooftop', 'etage-1'])
    expect(moveLevel(salle, 'rdc', -1)).toBe(salle)
    expect(renameLevel(salle, 'etage-1', 'Premier').niveaux[1].nom).toBe('Premier')
    expect(() => addLevel(salle, ' étage 1 ')).toThrow('déjà')
    expect(() => addLevel(salle, '  ')).toThrow('obligatoire')
    expect(() => renameLevel(salle, 'rdc', 'Rooftop')).toThrow('déjà')
  })

  it('refuse de retirer le dernier niveau ou un niveau qui porte des tables', () => {
    const salle = addLevel(base, 'Étage 1')

    expect(() => removeLevel(base, 'rdc', 0)).toThrow('au moins un niveau')
    expect(() => removeLevel(salle, 'etage-1', 3)).toThrow('3 tables')
    expect(removeLevel(salle, 'etage-1', 0).niveaux).toHaveLength(1)
  })

  it('crée, modifie et retire des zones', () => {
    let salle = upsertZone(base, { nom: 'Terrasse 1', type: 'terrasse', niveau: 'rdc' })

    salle = upsertZone(salle, { nom: 'Terrasse 2', type: 'terrasse', niveau: 'rdc' })
    expect(salle.zones.map(z => z.nom)).toEqual(['Terrasse 1', 'Terrasse 2'])
    expect(() => upsertZone(salle, { nom: 'terrasse 2', type: 'bar', niveau: 'rdc' })).toThrow('déjà')
    expect(upsertZone(salle, { nom: 'Grand jardin', type: 'terrasse', niveau: 'rdc' }, 'Terrasse 2').zones[1].nom).toBe('Grand jardin')
    expect(() => removeZone(salle, 'Terrasse 1', 2)).toThrow('2 tables')
    expect(removeZone(salle, 'Terrasse 1', 0).zones.map(z => z.nom)).toEqual(['Terrasse 2'])
  })

  it('fabrique des identifiants lisibles et uniques', () => {
    expect(slug('Étage 1')).toBe('etage-1')
    expect(slug('Étage 1', ['etage-1'])).toBe('etage-1-2')
    expect(slug('!!!')).toBe('niveau')
  })
})

describe('numérotation des nouvelles tables', () => {
  it('continue après le plus grand numéro du préfixe', () => {
    expect(nextTableNumbers(['T1', 'T2', 'T7'], 'T', 3)).toEqual(['T8', 'T9', 'T10'])
    expect(nextTableNumbers([], 'T', 2)).toEqual(['T1', 'T2'])
    expect(nextTableNumbers(['E1', 'T3'], 'E', 1)).toEqual(['E2'])
  })

  it('ne reprend jamais un numéro existant (casse ignorée) et protège le préfixe', () => {
    expect(nextTableNumbers(['t1', 'T2'], 'T', 1)).toEqual(['T3'])
    expect(nextTableNumbers(['A.1'], 'A.', 1)).toEqual(['A.2'])
  })
})
