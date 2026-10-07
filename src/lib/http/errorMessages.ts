import type { ApiError } from './errors'
import { isApiError } from './errors'

/**
 * Messages affichés à l'utilisateur, en français.
 *
 * Le back répond en anglais et ses messages ne sont pas faits pour être montrés tels
 * quels. On traduit ceux que l'on connaît ; sinon on retombe sur un message par type
 * d'erreur. Le texte brut du serveur n'est jamais affiché : il reste dans `error.message`
 * pour les journaux.
 */
const KNOWN_MESSAGES: Record<string, string> = {
  'Invalid credentials': 'E-mail ou mot de passe incorrect.',
  'Two-factor authentication code required': 'Saisissez le code de votre application d\'authentification.',
  'Invalid 2FA token or recovery code': 'Code de vérification incorrect ou expiré.',
  'Invalid or expired refresh token': 'Votre session a expiré. Reconnectez-vous.',
  'Email already registered': 'Un compte existe déjà avec cet e-mail.',
  'Phone number already registered': 'Un compte existe déjà avec ce numéro de téléphone.',
  'Invalid or expired reset token': 'Ce lien de réinitialisation est invalide ou a expiré.',
  'Reset token has expired': 'Ce lien de réinitialisation a expiré.',
  'Invalid or expired verification token': 'Ce lien de vérification est invalide ou a expiré.',
  'Email is already verified': 'Cet e-mail est déjà vérifié.',
  'Restaurant not found': 'Restaurant introuvable.',
  'Not authenticated': 'Vous devez vous connecter.',
  'X-Tenant-ID is required for a user with multiple restaurants': 'Choisissez d\'abord un restaurant.',
}

const BY_KIND: Record<ApiError['kind'], string> = {
  network: 'Impossible de joindre le serveur. Vérifiez votre connexion.',
  unauthorized: 'Votre session a expiré. Reconnectez-vous.',
  forbidden: 'Vous n\'avez pas les droits pour cette action.',
  not_found: 'Élément introuvable.',
  conflict: 'Cette opération entre en conflit avec des données existantes.',
  validation: 'Certaines informations sont invalides.',
  rate_limited: 'Trop de tentatives. Patientez un instant.',
  server: 'Le serveur a rencontré un problème. Réessayez dans un instant.',
  client: 'La demande n\'a pas pu aboutir.',
}

export function describeError(error: unknown): string {
  if (!isApiError(error))
    return 'Une erreur inattendue est survenue.'

  return KNOWN_MESSAGES[error.message] ?? BY_KIND[error.kind]
}
