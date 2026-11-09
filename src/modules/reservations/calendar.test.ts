import { describe, expect, it } from 'vitest'
import {
  addDaysIn,
  dayKey,
  fromInputs,
  layoutDay,
  minutesOfDay,
  monthGridIn,
  startOfDayIn,
  startOfWeekIn,
  toDateInput,
  toTimeInput,
  weekDaysIn,
  zonedToInstant,
} from './calendar'

const DOUALA = 'Africa/Douala'
const TOKYO = 'Asia/Tokyo'
const NEW_YORK = 'America/New_York'

describe('saisie dans le fuseau du restaurant', () => {
  it('convertit une heure murale de Douala (UTC+1) en instant absolu', () => {
    expect(fromInputs('2026-11-14', '19:00', DOUALA).toISOString()).toBe('2026-11-14T18:00:00.000Z')
  })

  it('ne dépend pas du fuseau du poste : le fuseau du restaurant fait foi', () => {
    expect(fromInputs('2026-11-14', '19:00', TOKYO).toISOString()).toBe('2026-11-14T10:00:00.000Z')
    expect(fromInputs('2026-11-14', '19:00', NEW_YORK).toISOString()).toBe('2026-11-15T00:00:00.000Z')
  })

  it('relit la même heure murale après conversion aller-retour', () => {
    const instant = fromInputs('2026-03-03', '21:45', TOKYO)

    expect(toDateInput(instant, TOKYO)).toBe('2026-03-03')
    expect(toTimeInput(instant, TOKYO)).toBe('21:45')
    expect(minutesOfDay(instant, TOKYO)).toBe(21 * 60 + 45)
  })

  it('regroupe par jour civil du restaurant, pas par jour UTC', () => {
    const minuitPassee = new Date('2026-11-14T23:30:00.000Z') // 00:30 le 15 à Douala

    expect(dayKey(minuitPassee, DOUALA)).toBe('2026-11-15')
    expect(dayKey(minuitPassee, 'UTC')).toBe('2026-11-14')
  })

  it('gère un décalage qui change autour de l\'instant demandé', () => {
    // Passage à l\'heure d\'été à New York le 8 mars 2026 : 03:30 existe bien ce jour-là.
    const instant = zonedToInstant(2026, 3, 8, 3, 30, NEW_YORK)

    expect(toTimeInput(instant, NEW_YORK)).toBe('03:30')
  })
})

describe('jours et semaines', () => {
  it('trouve le lundi de la semaine dans le fuseau du restaurant', () => {
    const mercredi = fromInputs('2026-11-11', '10:00', DOUALA)

    expect(toDateInput(startOfWeekIn(mercredi, DOUALA), DOUALA)).toBe('2026-11-09')
    expect(startOfWeekIn(mercredi, DOUALA).toISOString()).toBe('2026-11-08T23:00:00.000Z')
  })

  it('une semaine commence le lundi et compte sept jours', () => {
    const jours = weekDaysIn(fromInputs('2026-11-15', '12:00', DOUALA), DOUALA).map(day => toDateInput(day, DOUALA))

    expect(jours).toEqual(['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15'])
  })

  it('la grille mensuelle affiche 42 jours et commence un lundi', () => {
    const grille = monthGridIn(fromInputs('2026-11-01', '12:00', DOUALA), DOUALA)

    expect(grille).toHaveLength(42)
    expect(toDateInput(grille[0], DOUALA)).toBe('2026-10-26')
    expect(toDateInput(grille[41], DOUALA)).toBe('2026-12-06')
  })

  it('ajoute des jours civils sans dériver d\'une heure lors d\'un changement d\'heure', () => {
    const debut = startOfDayIn(fromInputs('2026-03-07', '08:00', NEW_YORK), NEW_YORK)

    expect(toDateInput(addDaysIn(debut, 1, NEW_YORK), NEW_YORK)).toBe('2026-03-08')
    expect(toTimeInput(addDaysIn(debut, 1, NEW_YORK), NEW_YORK)).toBe('00:00')
  })
})

describe('placement des blocs dans la grille', () => {
  it('sépare les blocs qui se chevauchent en colonnes', () => {
    const placed = layoutDay([
      { item: 'a', start: 19 * 60, end: 20 * 60 + 30 },
      { item: 'b', start: 19 * 60 + 30, end: 21 * 60 },
      { item: 'c', start: 21 * 60, end: 22 * 60 },
    ])

    const lanes = Object.fromEntries(placed.map(entry => [entry.item, [entry.lane, entry.lanes]]))

    expect(lanes).toEqual({ a: [0, 2], b: [1, 2], c: [0, 1] })
  })
})
