import { cashDeskApi } from '../api'
import type { Shift } from '../types'
import { isApiError } from '@/lib/http/errors'
import { useSessionStore } from '@/stores/session.store'
import { useTenantStore } from '@/stores/tenant.store'

/**
 * `open` : on a ouvert le shift ici ; `open-elsewhere` : le serveur répond qu'un shift est déjà
 * ouvert pour ce caissier mais on n'en connaît pas le détail (ouvert depuis un autre appareil) ;
 * `closed` : aucun shift ouvert à notre connaissance.
 */
export type ShiftState = 'open' | 'open-elsewhere' | 'closed'

interface Stored {
  state: ShiftState
  shift: Shift | null
  lastClosed: Shift | null
}

const EMPTY: Stored = { state: 'closed', shift: null, lastClosed: null }

function read(key: string): Stored {
  try {
    const raw = window.localStorage.getItem(key)
    const parsed: unknown = raw ? JSON.parse(raw) : null

    if (parsed && typeof parsed === 'object' && 'state' in parsed)
      return { ...EMPTY, ...parsed as Partial<Stored> }
  }
  catch {
    // Stockage illisible : on repart d'un shift inconnu, ce qui est sans danger.
  }

  return { ...EMPTY }
}

function write(key: string, value: Stored) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  }
  catch {
    // Stockage indisponible : l'état du shift sera simplement oublié au prochain chargement.
  }
}

/**
 * Le shift de caisse du caissier connecté dans le restaurant courant.
 *
 * Le back ne sait ni lire le shift en cours ni lister les shifts : on retient donc, dans ce
 * navigateur, la réponse d'ouverture et celle de fermeture (avec l'écart d'audit). Si le serveur
 * répond « déjà ouvert » sans que l'on connaisse ce shift, l'état devient `open-elsewhere`.
 */
export function useShift() {
  const tenant = useTenantStore()
  const user = useSessionStore()

  const key = computed(() => `marinade.cashdesk.shift.${tenant.currentId ?? 'none'}.${user.user?.id ?? 'anon'}`)
  const stored = ref<Stored>(read(key.value))

  watch(key, value => {
    stored.value = read(value)
  })

  function save(next: Stored) {
    stored.value = next
    write(key.value, next)
  }

  const state = computed(() => stored.value.state)
  const shift = computed(() => stored.value.shift)
  const lastClosed = computed(() => stored.value.lastClosed)
  const isOpen = computed(() => stored.value.state !== 'closed')

  /** Ouvre le shift. Renvoie `already` si le serveur en connaît déjà un d'ouvert. */
  async function open(openingBalance: number): Promise<'opened' | 'already'> {
    const restaurantId = tenant.currentId

    if (!restaurantId)
      throw new Error('Aucun restaurant sélectionné.')

    try {
      const opened = await cashDeskApi.openShift(restaurantId, { opening_balance: openingBalance })

      save({ state: 'open', shift: opened, lastClosed: null })

      return 'opened'
    }
    catch (cause) {
      if (isApiError(cause) && cause.kind === 'conflict') {
        save({ ...stored.value, state: stored.value.shift ? 'open' : 'open-elsewhere' })

        return 'already'
      }

      throw cause
    }
  }

  /** Ferme le shift : la réponse porte le montant attendu et l'écart. */
  async function close(countedBalance: number): Promise<Shift> {
    const restaurantId = tenant.currentId

    if (!restaurantId)
      throw new Error('Aucun restaurant sélectionné.')

    try {
      const closed = await cashDeskApi.closeShift(restaurantId, { closing_balance_counted: countedBalance })

      save({ state: 'closed', shift: null, lastClosed: closed })

      return closed
    }
    catch (cause) {
      // Le serveur n'a aucun shift ouvert pour ce caissier : notre mémoire était périmée.
      if (isApiError(cause) && cause.kind === 'not_found')
        save({ ...stored.value, state: 'closed', shift: null })

      throw cause
    }
  }

  function dismissLastClosed() {
    save({ ...stored.value, lastClosed: null })
  }

  return { state, shift, lastClosed, isOpen, open, close, dismissLastClosed }
}
