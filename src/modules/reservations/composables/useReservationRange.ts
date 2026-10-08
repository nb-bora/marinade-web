import type { Ref } from 'vue'
import { reservationsApi } from '../api'
import type { Reservation } from '../types'
import { useAsyncData } from '@/composables/useAsyncData'
import { useTenantStore } from '@/stores/tenant.store'

/** Une réservation avec ses bornes en vraies dates : la grille et les listes n'ont plus à les recalculer. */
export interface Booking {
  reservation: Reservation
  start: Date
  end: Date
}

export const toBooking = (reservation: Reservation): Booking => {
  const start = new Date(reservation.reservation_date)

  return { reservation, start, end: new Date(start.getTime() + reservation.duration_minutes * 60_000) }
}

/**
 * Les réservations d'une plage de dates (début inclus, fin exclue) du restaurant courant.
 * Recharge quand la plage ou le restaurant change ; `refresh` met à jour sans clignotement.
 */
export function useReservationRange(range: Ref<{ from: Date; to: Date }>) {
  const tenant = useTenantStore()

  const key = computed(() => `${tenant.currentId}|${range.value.from.getTime()}|${range.value.to.getTime()}`)

  const { data, loading, error, reload, refresh } = useAsyncData(async signal => {
    if (!tenant.currentId)
      return []

    const list = await reservationsApi.list(tenant.currentId, {
      from: range.value.from,
      to: new Date(range.value.to.getTime() - 1),
    }, signal)

    return list.map(toBooking)
  }, { watch: [key] })

  return { bookings: computed(() => data.value ?? []), loadedOnce: computed(() => data.value !== null), loading, error, reload, refresh }
}
