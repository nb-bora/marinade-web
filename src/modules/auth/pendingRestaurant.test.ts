import { describe, expect, it } from 'vitest'
import { PENDING_RESTAURANT_KEY, savePendingRestaurant, takePendingRestaurant } from './pendingRestaurant'

/** Stockage minimal en mémoire : même contrat que `sessionStorage`. */
function memoryStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial))

  return {
    get length() { return data.size },
    clear: () => data.clear(),
    getItem: key => data.get(key) ?? null,
    key: index => [...data.keys()][index] ?? null,
    removeItem: key => { data.delete(key) },
    setItem: (key, value) => { data.set(key, value) },
  }
}

describe('établissement en attente d\'activation', () => {
  it('se retrouve après enregistrement', () => {
    const storage = memoryStorage()

    savePendingRestaurant({ name: 'Chez Maman Ngo', city: 'Douala' }, storage)

    expect(takePendingRestaurant(storage)).toEqual({ name: 'Chez Maman Ngo', city: 'Douala' })
  })

  it('ne se lit qu\'une fois : il ne doit être créé qu\'une seule fois', () => {
    const storage = memoryStorage()

    savePendingRestaurant({ name: 'Pressing Éclat' }, storage)
    takePendingRestaurant(storage)

    expect(takePendingRestaurant(storage)).toBeNull()
    expect(storage.getItem(PENDING_RESTAURANT_KEY)).toBeNull()
  })

  it('renvoie null quand rien n\'a été enregistré', () => {
    expect(takePendingRestaurant(memoryStorage())).toBeNull()
  })

  it('ignore un contenu illisible ou sans nom, et le supprime', () => {
    const broken = memoryStorage({ [PENDING_RESTAURANT_KEY]: '{pas du json' })
    const noName = memoryStorage({ [PENDING_RESTAURANT_KEY]: JSON.stringify({ city: 'Douala' }) })

    expect(takePendingRestaurant(broken)).toBeNull()
    expect(takePendingRestaurant(noName)).toBeNull()
    expect(broken.getItem(PENDING_RESTAURANT_KEY)).toBeNull()
  })

  it('ne plante pas quand le stockage est indisponible', () => {
    const unavailable = {
      getItem: () => { throw new Error('refusé') },
      removeItem: () => { throw new Error('refusé') },
      setItem: () => { throw new Error('quota') },
    } as unknown as Storage

    expect(() => savePendingRestaurant({ name: 'X' }, unavailable)).not.toThrow()
    expect(takePendingRestaurant(unavailable)).toBeNull()
  })

  it('ne garde aucun mot de passe : seul ce qui est passé est enregistré', () => {
    const storage = memoryStorage()

    savePendingRestaurant({ name: 'X' }, storage)

    expect(storage.getItem(PENDING_RESTAURANT_KEY)).not.toMatch(/password|mot_de_passe/i)
  })
})
