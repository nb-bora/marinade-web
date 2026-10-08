import type { components } from '@/lib/api/schema'

type Schemas = components['schemas']

export type Reservation = Schemas['ReservationResponse']

/** Le nom, le nombre de couverts et la date sont obligatoires : le serveur fixe le reste par défaut. */
type CreateRequired = 'customer_name' | 'party_size' | 'reservation_date'

export type ReservationCreate = Pick<Schemas['ReservationCreate'], CreateRequired> & Partial<Omit<Schemas['ReservationCreate'], CreateRequired>>
export type ReservationUpdate = Schemas['ReservationUpdate']

export type WaitlistEntry = Schemas['WaitlistResponse']
export type WaitlistCreate = Schemas['WaitlistCreate']

/** Tables du restaurant : lecture seule ici, la salle les gère. */
export type Table = Schemas['TableResponse']

/** Filtres de la liste des réservations (l'API filtre sur une plage de dates et un statut). */
export interface ReservationFilters {
  from?: Date
  to?: Date
  status?: string
  search?: string
}
