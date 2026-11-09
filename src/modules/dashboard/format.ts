import { formatMoney } from '@/lib/format'

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n > 1 ? many : one}`

/** « 85 k » pour les axes et le centre des graphiques. */
export const compact = (value: number) => {
  if (value >= 1_000_000)
    return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(value / 1_000_000)} M`

  if (value >= 1000)
    return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: value >= 100_000 ? 0 : 1 }).format(value / 1000)} k`

  return String(Math.round(value))
}

export const money = (value: number, devise: string) => formatMoney(value, devise)

export { moneyParts } from '@/lib/format'

export const MOYEN_PAIEMENT: Record<string, { label: string; icon: string }> = {
  CASH: { label: 'Espèces', icon: 'ri-money-dollar-circle-line' },
  MTN_MOMO: { label: 'MTN MoMo', icon: 'ri-smartphone-line' },
  ORANGE_MONEY: { label: 'Orange Money', icon: 'ri-smartphone-line' },
  CARD: { label: 'Carte bancaire', icon: 'ri-bank-card-line' },
  WAVE: { label: 'Wave', icon: 'ri-smartphone-line' },
  BANK_TRANSFER: { label: 'Virement', icon: 'ri-bank-line' },
}

export const POSTE: Record<string, { label: string; icon: string }> = {
  KITCHEN: { label: 'Cuisine', icon: 'ri-restaurant-2-line' },
  BAR: { label: 'Bar', icon: 'ri-goblet-line' },
  DESSERT: { label: 'Desserts', icon: 'ri-cake-3-line' },
  PACKAGING: { label: 'Emballage', icon: 'ri-shopping-bag-3-line' },
}

export const RESERVATION_STATUT: Record<string, { label: string; color: 'warning' | 'success' | 'info' }> = {
  pending: { label: 'À confirmer', color: 'warning' },
  confirmed: { label: 'Confirmée', color: 'success' },
  checked_in: { label: 'Arrivée', color: 'info' },
}

export const ALERTE_NIVEAU: Record<string, { icon: string; color: 'error' | 'warning' | 'info' }> = {
  critique: { icon: 'ri-error-warning-line', color: 'error' },
  avertissement: { icon: 'ri-alert-line', color: 'warning' },
  info: { icon: 'ri-information-line', color: 'info' },
}

/** Heure locale (0-23) de l'instant `iso` dans le fuseau de l'établissement. */
export function localHour(iso: string, timeZone: string): number {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone }).formatToParts(new Date(iso))

    return Number(parts.find(part => part.type === 'hour')?.value ?? Number.NaN) % 24
  }
  catch {
    return new Date(iso).getHours()
  }
}

export const clock = (iso: string, timeZone: string) =>
  new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone }).format(new Date(iso))

/** 41 → « 41 min », 95 → « 1 h 35 min ». */
export const duration = (minutes: number) => minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min`
