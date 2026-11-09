import type { components } from '@/lib/api/schema'

type Schemas = components['schemas']

/** Tableau de bord du restaurant (`GET /v1/ros/restaurants/{id}/dashboard`), montants en unité de la devise. */
export type RestaurantDashboard = Schemas['RestoDashboardResponse']
export type DashAlerte = Schemas['RestoDashAlerte']
export type DashReservation = Schemas['RestoDashReservation']
export type DashProduit = Schemas['RestoDashProduit']
