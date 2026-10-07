import type { RestaurantAccess } from '@/lib/api/types'

/** Libellés français des rôles d'équipe renvoyés par l'API. */
const TEAM_ROLES: Record<string, string> = {
  owner: 'Propriétaire',
  manager: 'Manager',
  cashier: 'Caissier',
  waiter: 'Serveur',
  chef: 'Chef',
  sous_chef: 'Sous-chef',
  bartender: 'Barman',
  host: 'Hôte',
  delivery: 'Livreur',
}

const ACCOUNT_ROLES: Record<string, string> = {
  admin: 'Administrateur',
  restaurant: 'Restaurateur',
  pos: 'Terminal de caisse',
  manager: 'Manager',
  cashier: 'Caissier',
  waiter: 'Serveur',
  chef: 'Chef',
  delivery: 'Livreur',
}

export const teamRoleLabel = (role: string) => TEAM_ROLES[role] ?? role

export const accountRoleLabel = (role: string) => ACCOUNT_ROLES[role] ?? role

/** Ce que l'utilisateur est DANS ce restaurant, en une expression. */
export function relationLabel(access: RestaurantAccess): string {
  if (access.relation === 'platform_admin')
    return 'Administrateur'

  return access.roles.map(teamRoleLabel).join(', ') || 'Équipe'
}
