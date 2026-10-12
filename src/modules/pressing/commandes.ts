import type { Alerte, Commande, CommandeEtape, CommandeStatut, Machine, PaiementMode } from './types'
import type { StatusTone } from '@/ui/AppStatusChip.vue'

/**
 * Libellés et petites règles d'affichage des commandes du pressing : statuts, étapes, modes de
 * paiement, alertes. Les valeurs d'énumération du serveur ne sont jamais montrées telles quelles.
 */

/** Fuseau du pressing (le serveur compte les jours à Douala). */
export const PRESSING_TIMEZONE = 'Africa/Douala'

export interface StatutInfo {
  label: string
  tone: StatusTone
  icon: string

  /** Phrase d'explication affichée sous le statut. */
  hint: string
}

export const STATUT_INFO: Record<CommandeStatut, StatutInfo> = {
  recue: { label: 'Reçue', tone: 'info', icon: 'ri-inbox-archive-line', hint: 'Le linge est déposé, en attente de prise en charge.' },
  en_attente_machine: { label: 'En attente de machine', tone: 'warning', icon: 'ri-hourglass-line', hint: 'Des machines sont réservées, le cycle n\'a pas encore démarré.' },
  en_lavage: { label: 'En lavage', tone: 'info', icon: 'ri-drop-line', hint: 'Le linge est dans un lave-linge.' },
  attente_sechage: { label: 'En attente de séchage', tone: 'warning', icon: 'ri-temp-hot-line', hint: 'Le lavage est terminé, il reste à choisir un sèche-linge.' },
  en_sechage: { label: 'En séchage', tone: 'info', icon: 'ri-sun-line', hint: 'Le linge est dans un sèche-linge.' },
  pret: { label: 'Prête', tone: 'success', icon: 'ri-checkbox-circle-line', hint: 'Le linge est prêt à être remis au client.' },
  livre: { label: 'Livrée', tone: 'neutral', icon: 'ri-truck-line', hint: 'Le linge a été remis au client.' },
  annulee: { label: 'Annulée', tone: 'error', icon: 'ri-close-circle-line', hint: 'La commande a été annulée.' },
}

export const ETAPE_LABELS: Record<CommandeEtape, string> = {
  lavage: 'Lavage',
  sechage: 'Séchage',
}

export interface CommandeTab {
  value: string
  title: string

  /** Statuts de l'onglet ; vide : toutes les commandes. */
  statuts: CommandeStatut[]
}

/** Onglets de la liste : une étape de la vie d'une commande chacun. */
export const COMMANDE_TABS: CommandeTab[] = [
  { value: 'a_prendre', title: 'À prendre en charge', statuts: ['recue'] },
  { value: 'en_cours', title: 'En cours', statuts: ['en_attente_machine', 'en_lavage', 'attente_sechage', 'en_sechage'] },
  { value: 'pretes', title: 'Prêtes', statuts: ['pret'] },
  { value: 'livrees', title: 'Livrées', statuts: ['livre'] },
  { value: 'toutes', title: 'Toutes', statuts: [] },
]

/** Phrase courte décrivant ce qu'il reste à faire, selon le statut. */
export const NEXT_STEP: Record<CommandeStatut, string> = {
  recue: 'Choisir les machines pour le lavage.',
  en_attente_machine: 'Démarrer le cycle sur la machine réservée.',
  en_lavage: 'Terminer le cycle quand le lavage est fini.',
  attente_sechage: 'Choisir un sèche-linge.',
  en_sechage: 'Terminer le cycle quand le séchage est fini.',
  pret: 'Encaisser le solde puis remettre le linge.',
  livre: 'Aucune action : la commande est terminée.',
  annulee: 'Aucune action : la commande est annulée.',
}

export const MODE_PAIEMENT_INFO: Record<PaiementMode, { label: string; icon: string; color: string }> = {
  especes: { label: 'Espèces', icon: 'ri-money-dollar-circle-line', color: 'success' },
  mobile_money: { label: 'Mobile Money', icon: 'ri-smartphone-line', color: 'warning' },
  carte: { label: 'Carte bancaire', icon: 'ri-bank-card-line', color: 'info' },
  autre: { label: 'Autre moyen', icon: 'ri-wallet-3-line', color: 'secondary' },
}

export const MODES_PAIEMENT = Object.keys(MODE_PAIEMENT_INFO) as PaiementMode[]

export const ALERTE_NIVEAU: Record<Alerte['niveau'], { label: string; color: string; icon: string; rank: number }> = {
  critique: { label: 'Critique', color: 'error', icon: 'ri-error-warning-line', rank: 0 },
  avertissement: { label: 'Avertissement', color: 'warning', icon: 'ri-alert-line', rank: 1 },
  info: { label: 'Information', color: 'info', icon: 'ri-information-line', rank: 2 },
}

export const ALERTE_TYPE: Record<Alerte['type'], string> = {
  retard: 'Retard',
  panne: 'Panne',
  intervention: 'Intervention',
  attente_dechargement: 'Machine à décharger',
  dechargement_tardif: 'Déchargement tardif',
  reservation_non_demarree: 'Réservation non démarrée',
  prise_en_charge: 'Prise en charge',
  charge_restante: 'Charge à affecter',
  sechage_en_attente: 'Séchage en attente',
  paiement_apres_cloture: 'Paiement après clôture',
}

/** Une commande dont le contenu ne passe pas par les machines (articles seuls). */
export const withoutMachines = (commande: Pick<Commande, 'lavage' | 'sechage'>) => !commande.lavage && !commande.sechage

/** Types de linge suggérés (la saisie reste libre côté serveur). */
export const LINEN_CHOICES = ['drap', 'couette', 'coton', 'delicat', 'synthetique', 'tout']

export const LINEN_LABELS: Record<string, string> = {
  drap: 'Drap',
  couette: 'Couette',
  coton: 'Coton',
  delicat: 'Délicat',
  synthetique: 'Synthétique',
  tout: 'Tout',
  laine: 'Laine',
  serviette: 'Serviette',
}

export const linenLabel = (value: string) => LINEN_LABELS[value] ?? value.charAt(0).toUpperCase() + value.slice(1)

/** Kilogrammes (nombre) avec virgule : `3.4` devient « 3,4 kg ». */
export function formatKgValue(kg: number | string | null | undefined): string {
  const value = Number(kg)

  return Number.isFinite(value) ? `${value.toLocaleString('fr-FR', { maximumFractionDigits: 3 })} kg` : '—'
}

/** Quantité d'une ligne : kilos pour le lavage et le séchage, entier sinon. */
export function quantityText(type: string, quantite: string | number): string {
  const value = Number(quantite).toLocaleString('fr-FR', { maximumFractionDigits: 3 })

  return type === 'lavage' || type === 'sechage' ? `${value} kg` : value
}

/** Jour au format AAAA-MM-JJ dans le fuseau du pressing. */
export function dayKey(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: PRESSING_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

/** Jour AAAA-MM-JJ décalé de `days` jours (calcul en UTC, sans heure d'été à gérer). */
export function shiftDay(key: string, days: number): string {
  const [year, month, day] = key.split('-').map(Number)

  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

/** Part du cycle écoulée (0 à 100), d'après le début réel et la fin estimée. */
export function cycleProgress(start: string | null | undefined, end: string | null | undefined, now: number = Date.now()): number | null {
  if (!start || !end)
    return null

  const from = new Date(start).getTime()
  const to = new Date(end).getTime()

  if (!(to > from))
    return null

  return Math.max(0, Math.min(100, Math.round((now - from) / (to - from) * 100)))
}

const csvCell = (value: string | number) => {
  const text = String(value)

  return /[;"\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

/** Texte CSV (séparateur « ; », décimale « , ») prêt à télécharger, avec BOM pour Excel. */
export function toCsv(rows: Array<Array<string | number>>): string {
  const lines = rows.map(row => row.map(cell => csvCell(typeof cell === 'number' ? String(cell).replace('.', ',') : cell)).join(';'))

  return `${String.fromCharCode(0xFEFF)}${lines.join('\r\n')}\r\n`
}

export function downloadText(filename: string, text: string, type = 'text/csv;charset=utf-8'): void {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const link = document.createElement('a')

  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

/** Durée en minutes pour l'affichage : « 52,5 min », « 1 h 05 ». */
export function formatDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined)
    return '—'

  if (minutes < 60)
    return `${minutes.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} min`

  const total = Math.round(minutes)
  const rest = total % 60

  return `${Math.floor(total / 60)} h${rest ? ` ${String(rest).padStart(2, '0')}` : ''}`
}

// --- Heure, cadence, prochaine action -----------------------------------------------------------

/** Cadence de rafraîchissement des écrans qui bougent seuls (commandes, tableau de bord). */
export const LIVE_INTERVAL_MS = 15_000

const heureFormat = new Intl.DateTimeFormat('fr-FR', { timeZone: PRESSING_TIMEZONE, hour: '2-digit', minute: '2-digit' })
const dateHeureFormat = new Intl.DateTimeFormat('fr-FR', { timeZone: PRESSING_TIMEZONE, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const jourFormat = new Intl.DateTimeFormat('fr-FR', { timeZone: PRESSING_TIMEZONE, weekday: 'long', day: 'numeric', month: 'long' })

/** Heure « 14:05 » dans le fuseau du pressing (Africa/Douala), quel que soit le fuseau du poste. */
export const formatHeure = (value: string | Date | null | undefined): string => value ? heureFormat.format(new Date(value)) : '—'

/** Date et heure dans le fuseau du pressing. */
export const formatDateHeure = (value: string | Date | null | undefined): string => value ? dateHeureFormat.format(new Date(value)) : '—'

/** Jour complet pour l'en-tête du tableau de bord, dans le fuseau du pressing. */
export const formatJour = (date: Date): string => jourFormat.format(date)

/**
 * Un programme convient à une commande sans type de linge, ou quand il contient « tout » ou
 * l'un des types demandés (même règle que le serveur, sans tenir compte de la casse).
 */
export function programmeCompatible(types: string[] | null | undefined, demandes: string[]): boolean {
  const demandees = demandes.map(type => type.trim().toLowerCase()).filter(Boolean)

  if (!demandees.length)
    return true

  const prisEnCharge = (types ?? []).map(type => type.trim().toLowerCase())

  return prisEnCharge.includes('tout') || demandees.some(type => prisEnCharge.includes(type))
}

/** Ligne de la commande dont le cycle est lié à cette commande (et pas à une autre). */
export function ligneLiee(commande: Commande, machines: Machine[]) {
  return commande.machines.filter(row => {
    const machine = machines.find(item => item.id === row.machine_id)

    return row.actif && !row.fin_reelle && !row.dechargee_le && machine?.commande_courante_id === commande.id
  })
}

export interface ProchaineAction {
  texte: string
  icone: string

  /** Où l'utilisateur doit aller pour l'accomplir. */
  cible: 'affectation' | 'paiement' | 'livraison'
}

/** Action suivante d'une commande, d'après son statut et l'état réel de ses machines liées. */
export function prochaineAction(commande: Commande, machines: Machine[]): ProchaineAction | null {
  if (commande.statut === 'livre' || commande.statut === 'annulee')
    return null

  const liees = ligneLiee(commande, machines)

  for (const row of liees) {
    const etat = machines.find(item => item.id === row.machine_id)?.etat_operationnel
    const nom = row.machine_nom ?? 'la machine'

    if (etat === 'reservee')
      return { texte: `Démarrer le cycle sur ${nom}`, icone: 'ri-play-circle-line', cible: 'affectation' }
    if (etat === 'en_cycle')
      return { texte: `Terminer le cycle sur ${nom}`, icone: 'ri-check-double-line', cible: 'affectation' }
    if (etat === 'cycle_termine' || etat === 'attente_dechargement')
      return { texte: `Décharger ${nom}`, icone: 'ri-inbox-unarchive-line', cible: 'affectation' }
  }

  if (commande.statut === 'recue') {
    return withoutMachines(commande)
      ? { texte: 'Marquer la commande prête', icone: 'ri-checkbox-circle-line', cible: 'affectation' }
      : { texte: 'Choisir les machines', icone: 'ri-magic-line', cible: 'affectation' }
  }

  if (commande.statut === 'attente_sechage')
    return { texte: 'Choisir le sèche-linge', icone: 'ri-magic-line', cible: 'affectation' }

  if (commande.statut === 'pret' && commande.reste_a_payer > 0)
    return { texte: 'Encaisser le solde', icone: 'ri-hand-coin-line', cible: 'paiement' }

  if (commande.statut === 'pret')
    return { texte: 'Remettre le linge au client', icone: 'ri-truck-line', cible: 'livraison' }

  return null
}
