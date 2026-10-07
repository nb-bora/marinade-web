import { effectScope } from 'vue'
import { describe, expect, it } from 'vitest'
import type { CursorPage } from './useCursorList'
import { useCursorList } from './useCursorList'

interface Row { id: string; status: string }

const row = (id: string, status = 'pending'): Row => ({ id, status })

/** Un « serveur » dont on fixe les pages. */
function fakeServer(pages: Record<string, CursorPage<Row>>) {
  return async (cursor: string | undefined) => pages[cursor ?? 'first']
}

const inScope = <T>(factory: () => T): T => effectScope().run(factory) as T

describe('useCursorList', () => {
  it('charge la première page puis ajoute la suivante', async () => {
    const list = inScope(() => useCursorList(fakeServer({
      first: { items: [row('1'), row('2')], next_cursor: 'c2' },
      c2: { items: [row('3')], next_cursor: null },
    })))

    await list.reload()
    expect(list.items.value.map(item => item.id)).toEqual(['1', '2'])
    expect(list.hasMore.value).toBe(true)

    await list.loadMore()
    expect(list.items.value.map(item => item.id)).toEqual(['1', '2', '3'])
    expect(list.hasMore.value).toBe(false)
  })

  it('une réponse périmée n\'écrase jamais une plus récente', async () => {
    const resolvers: Array<(page: CursorPage<Row>) => void> = []
    const list = inScope(() => useCursorList(() => new Promise<CursorPage<Row>>(resolve => resolvers.push(resolve))))

    const first = list.reload()
    const second = list.reload()

    // La seconde requête répond d'abord, la première (périmée) ensuite.
    resolvers[1]({ items: [row('new')], next_cursor: null })
    await second
    resolvers[0]({ items: [row('old')], next_cursor: null })
    await first

    expect(list.items.value.map(item => item.id)).toEqual(['new'])
  })

  it('refreshHead met à jour les lignes connues, ajoute les nouvelles et garde les pages déroulées', async () => {
    let head: CursorPage<Row> = { items: [row('2', 'pending'), row('1')], next_cursor: 'c2' }

    const list = inScope(() => useCursorList(
      async cursor => cursor === 'c2' ? { items: [row('0')], next_cursor: null } : head,
      { keyOf: item => item.id },
    ))

    await list.reload()
    await list.loadMore()
    expect(list.items.value.map(item => item.id)).toEqual(['2', '1', '0'])

    // Entre-temps : « 2 » réussit et « 3 » arrive.
    head = { items: [row('3'), row('2', 'success'), row('1')], next_cursor: 'c2' }
    await list.refreshHead()

    expect(list.items.value.map(item => item.id)).toEqual(['3', '2', '1', '0'])
    expect(list.items.value.find(item => item.id === '2')?.status).toBe('success')
    expect(list.hasMore.value).toBe(false)
  })

  it('une actualisation qui échoue n\'efface pas ce qui est affiché', async () => {
    let fail = false

    const list = inScope(() => useCursorList(
      async () => {
        if (fail)
          throw new Error('réseau')

        return { items: [row('1')], next_cursor: null }
      },
      { keyOf: item => item.id },
    ))

    await list.reload()
    fail = true
    await list.refreshHead()

    expect(list.items.value).toHaveLength(1)
    expect(list.error.value).toBeNull()
  })
})
