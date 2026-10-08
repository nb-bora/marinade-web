import type { SubscriptionStatus, Tier } from './types'
import { describeError } from '@/lib/http/errorMessages'
import { isApiError } from '@/lib/http/errors'
import type { StatusTone } from '@/ui/AppStatusChip.vue'

interface Presentation {
  label: string
  tone: StatusTone
  icon: string
}

const STATUS: Record<SubscriptionStatus, Presentation> = {
  pending: { label: 'En attente d\'activation', tone: 'warning', icon: 'ri-hourglass-line' },
  active: { label: 'Actif', tone: 'success', icon: 'ri-checkbox-circle-line' },
  suspended: { label: 'Suspendu', tone: 'warning', icon: 'ri-pause-circle-line' },
  cancelled: { label: 'Résilié', tone: 'error', icon: 'ri-close-circle-line' },
  expired: { label: 'Expiré', tone: 'neutral', icon: 'ri-calendar-close-line' },
}

export const presentStatus = (status: string): Presentation =>
  status in STATUS ? STATUS[status as SubscriptionStatus] : { label: status, tone: 'neutral', icon: 'ri-question-line' }

/** Couleur de la jauge : de plus en plus alarmante à mesure que le plafond du jour se vide. */
export function gaugeColor(usedPercent: number): 'success' | 'warning' | 'error' {
  if (usedPercent >= 90)
    return 'error'

  return usedPercent >= 70 ? 'warning' : 'success'
}

/** Mois d'abonnement annuel offerts par rapport au paiement mensuel (0 si l'annuel n'est pas moins cher). */
export function monthsOffered(tier: Tier): number {
  const saving = tier.monthly_price_fcfa * 12 - tier.annual_price_fcfa

  return saving > 0 ? Math.floor(saving / tier.monthly_price_fcfa) : 0
}

/** Jours entre deux dates `AAAA-MM-JJ` (fin comprise, début exclu). */
export function daysBetween(from: string, to: string): number {
  return Math.round((new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / 86_400_000)
}

const KNOWN: [RegExp, string][] = [
  [/^Insufficient daily balance/, 'Le plafond du jour ne couvre pas ce montant.'],
  [/^No daily balance found for today/, 'Aucun solde n\'est ouvert pour aujourd\'hui : l\'achat ne peut pas être imputé.'],
  [/^Subscription is not active/, 'L\'abonnement n\'est pas actif pour ce restaurant.'],
  [/^POS transaction ID already exists/, 'Cet identifiant de terminal est déjà utilisé.'],
]

/** Message en français pour une erreur d'API : les cas métier connus, sinon le message général. */
export function explainError(error: unknown): string {
  if (isApiError(error)) {
    const known = KNOWN.find(([pattern]) => pattern.test(error.message))

    if (known)
      return known[1]
  }

  return describeError(error)
}
