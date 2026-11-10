import { cashDeskApi } from '../api'
import type { Shift, ShiftSummary } from '../types'
import { isApiError } from '@/lib/http/errors'
import { useSessionStore } from '@/stores/session.store'
import { useTenantStore } from '@/stores/tenant.store'

/**
 * `open` : on connaît le shift ouvert ; `open-elsewhere` : le serveur répond qu'un shift est déjà
 * ouvert pour ce caissier mais on n'a pas pu en lire le détail ; `closed` : aucun shift ouvert.
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
 * La vérité vient du serveur : `sync()` lit `GET /shifts/current` (404 = aucun shift ouvert) et le
 * bilan du shift (encaissements par moyen). Le navigateur ne retient que ce qu'un shift fermé laisse
 * derrière lui (`lastClosed`, avec l'écart d'audit) et un état de repli, pour l'affichage instantané
 * au chargement et si le serveur ne répond pas.
 */
export function useShift() {
  const tenant = useTenantStore()
  const user = useSessionStore()

  const key = computed(() => `marinade.cashdesk.shift.${tenant.currentId ?? 'none'}.${user.user?.id ?? 'anon'}`)
  const stored = ref<Stored>(read(key.value))
  const summary = ref<ShiftSummary | null>(null)

  /** Chaque ouverture ou fermeture invalide les lectures serveur déjà parties (réponses périmées). */
  let epoch = 0

  watch(key, value => {
    epoch++
    stored.value = read(value)
    summary.value = null
  })

  function save(next: Stored) {
    stored.value = next
    write(key.value, next)
  }

  const state = computed(() => stored.value.state)
  const shift = computed(() => stored.value.shift)
  const lastClosed = computed(() => stored.value.lastClosed)
  const isOpen = computed(() => stored.value.state !== 'closed')

  /** Relit le shift et son bilan auprès du serveur. Un échec réseau garde l'état mémorisé. */
  async function sync(): Promise<void> {
    if (!tenant.currentId)
      return

    const startedAt = epoch

    try {
      const current = await cashDeskApi.currentShift()

      if (startedAt !== epoch)
        return

      if (!current) {
        summary.value = null
        if (stored.value.state !== 'closed' || stored.value.shift)
          save({ ...stored.value, state: 'closed', shift: null })

        return
      }

      save({ ...stored.value, state: 'open', shift: current })

      const report = await cashDeskApi.shiftSummary(current.id)

      if (startedAt === epoch)
        summary.value = report
    }
    catch {
      // Serveur injoignable ou bilan indisponible : l'écran garde ce qu'il sait.
    }
  }

  /** Ouvre le shift. Renvoie `already` si le serveur en connaît déjà un d'ouvert. */
  async function open(openingBalance: number): Promise<'opened' | 'already'> {
    const restaurantId = tenant.currentId

    if (!restaurantId)
      throw new Error('Aucun restaurant sélectionné.')

    try {
      const opened = await cashDeskApi.openShift(restaurantId, { opening_balance: openingBalance })

      epoch++
      save({ state: 'open', shift: opened, lastClosed: null })
      summary.value = null
      void sync()

      return 'opened'
    }
    catch (cause) {
      if (isApiError(cause) && cause.kind === 'conflict') {
        save({ ...stored.value, state: stored.value.shift ? 'open' : 'open-elsewhere' })
        await sync()

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
      const answer = await cashDeskApi.closeShift(restaurantId, { closing_balance_counted: countedBalance })

      // Le back date la fermeture avec l'heure locale du serveur sans fuseau (décalée d'une heure
      // ici) : on retient l'heure de ce poste, qui est celle à laquelle le caissier a fermé.
      const closed = { ...answer, closed_at: new Date().toISOString() }

      epoch++
      save({ state: 'closed', shift: null, lastClosed: closed })
      summary.value = null

      return closed
    }
    catch (cause) {
      // Le serveur n'a aucun shift ouvert pour ce caissier : notre mémoire était périmée.
      if (isApiError(cause) && cause.kind === 'not_found') {
        epoch++
        save({ ...stored.value, state: 'closed', shift: null })
        summary.value = null
      }

      throw cause
    }
  }

  function dismissLastClosed() {
    save({ ...stored.value, lastClosed: null })
  }

  return { state, shift, summary, lastClosed, isOpen, sync, open, close, dismissLastClosed }
}
