import type { SubscriptionStatus, UserRoleId } from './types'
import type { StatusTone } from '@/ui/AppStatusChip.vue'

/** Rôles que l'on peut attribuer à un compte, dans l'ordre proposé. */
export const ROLE_OPTIONS: { value: UserRoleId; title: string }[] = [
  { value: 'restaurant', title: 'Propriétaire de restaurant' },
  { value: 'manager', title: 'Gérant' },
  { value: 'cashier', title: 'Caissier' },
  { value: 'waiter', title: 'Serveur' },
  { value: 'chef', title: 'Cuisinier' },
  { value: 'pos', title: 'Terminal de caisse' },
  { value: 'admin', title: 'Administrateur de la plateforme' },
]

const ROLE_LABELS: Record<string, string> = {
  ...Object.fromEntries(ROLE_OPTIONS.map(option => [option.value, option.title])),
  delivery: 'Livreur',
}

/** Libellé court d'un rôle, pour les tableaux. */
const SHORT_ROLE_LABELS: Record<string, string> = { restaurant: 'Propriétaire', admin: 'Administrateur' }

export const roleLabel = (role: string) => SHORT_ROLE_LABELS[role] ?? ROLE_LABELS[role] ?? 'Rôle inconnu'

/** Couleur Vuetify de l'avatar d'un rôle. */
export function roleColor(role: string): string {
  if (role === 'admin')
    return 'error'
  if (role === 'restaurant')
    return 'primary'
  if (role === 'manager')
    return 'info'

  return 'secondary'
}

interface StatusView {
  label: string
  tone: StatusTone
  icon: string
}

const SUBSCRIPTION_STATUSES: Record<SubscriptionStatus, StatusView> = {
  pending: { label: 'En attente', tone: 'warning', icon: 'ri-hourglass-line' },
  active: { label: 'Actif', tone: 'success', icon: 'ri-checkbox-circle-line' },
  suspended: { label: 'Suspendu', tone: 'warning', icon: 'ri-pause-circle-line' },
  cancelled: { label: 'Résilié', tone: 'error', icon: 'ri-close-circle-line' },
  expired: { label: 'Expiré', tone: 'neutral', icon: 'ri-calendar-close-line' },
}

export const SUBSCRIPTION_STATUS_OPTIONS = (Object.keys(SUBSCRIPTION_STATUSES) as SubscriptionStatus[])
  .map(value => ({ value, title: SUBSCRIPTION_STATUSES[value].label }))

export const presentSubscriptionStatus = (status: string): StatusView =>
  SUBSCRIPTION_STATUSES[status as SubscriptionStatus] ?? { label: 'Inconnu', tone: 'neutral', icon: 'ri-question-line' }

/** Initiales d'un nom, pour l'avatar. */
export const initialsOf = (first: string, last: string) =>
  `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase() || '?'
