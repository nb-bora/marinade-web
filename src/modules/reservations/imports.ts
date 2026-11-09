/**
 * Import et export Excel des réservations et de la liste d'attente.
 *
 * L'import passe par les routes de création habituelles, ligne par ligne : une ligne refusée est
 * signalée avec la raison du serveur, sans arrêter les autres. Une réservation déjà présente (même
 * nom, même heure) est ignorée, si bien qu'on peut réimporter un fichier corrigé sans doublon.
 * L'export reprend les colonnes du modèle, pour qu'un fichier exporté se réimporte tel quel.
 */
import { reservationsApi } from './api'
import { fromInputs, zonedParts } from './calendar'
import type { Booking } from './composables/useReservationRange'
import { messageOf } from './labels'
import type { Reservation, Table, WaitlistEntry } from './types'
import { RowError, addCounts, numberField, requireText, runRows } from '@/lib/sheetImport'
import type { ImportDefinition, ImportResult, ImportSheetSpec, RowOutcome } from '@/lib/sheetImport'
import { normalizeKey } from '@/lib/spreadsheet'
import type { SheetRecord } from '@/lib/spreadsheet'
import { buildXlsx, downloadBlob } from '@/lib/xlsxWriter'

const pad = (value: number) => String(value).padStart(2, '0')

const RESERVATIONS_SHEET: ImportSheetSpec = {
  key: 'reservations',
  name: 'Reservations',
  columns: [
    { key: 'nom', label: 'Nom', required: true, aliases: ['client', 'nom du client'], hint: 'Nom du client.', example: 'Aïcha Mbarga' },
    { key: 'couverts', label: 'Couverts', required: true, aliases: ['personnes', 'convives'], hint: 'Nombre de personnes, entier au moins égal à 1.', example: '4' },
    { key: 'date', label: 'Date', required: true, aliases: ['jour'], hint: 'Jour de la réservation, au format AAAA-MM-JJ (ou JJ/MM/AAAA).', example: '2026-11-14' },
    { key: 'heure', label: 'Heure', required: true, aliases: ['horaire'], hint: 'Heure d\'arrivée prévue, heure du restaurant, au format HH:MM.', example: '19:30' },
    { key: 'duree', label: 'Durée', aliases: ['duree (min)', 'durée'], hint: 'Durée en minutes. Vide : 90.', example: '90' },
    { key: 'table', label: 'Table', aliases: ['numero table', 'numéro'], hint: 'Numéro d\'une table existante. Vide : choisie plus tard.', example: 'T4' },
    { key: 'telephone', label: 'Téléphone', aliases: ['tel', 'téléphone'], hint: 'Numéro du client, facultatif.', example: '+237 6 99 00 11 22' },
    { key: 'email', label: 'E-mail', aliases: ['mail', 'courriel'], hint: 'Adresse du client, facultative.', example: 'client@example.com' },
    { key: 'notes', label: 'Notes', aliases: ['remarques'], hint: 'Anniversaire, allergies, préférence de place...', example: 'Anniversaire' },
  ],
}

const WAITLIST_SHEET: ImportSheetSpec = {
  key: 'attente',
  name: 'Attente',
  columns: [
    { key: 'nom', label: 'Nom', required: true, aliases: ['client'], hint: 'Nom du groupe en attente.', example: 'Groupe Ndam' },
    { key: 'couverts', label: 'Couverts', required: true, aliases: ['personnes'], hint: 'Nombre de personnes, entier au moins égal à 1.', example: '3' },
    { key: 'telephone', label: 'Téléphone', aliases: ['tel', 'téléphone'], hint: 'Facultatif.', example: '+237 6 55 44 33 22' },
    { key: 'email', label: 'E-mail', aliases: ['mail'], hint: 'Facultatif : permet de prévenir le groupe.', example: 'groupe@example.com' },
    { key: 'notes', label: 'Notes', aliases: ['remarques'], hint: 'Facultatif.', example: 'Terrasse si possible' },
  ],
}

/** `2026-11-14` ou `14/11/2026` → { year, month, day }. */
export function parseDate(text: string): { year: number; month: number; day: number } | null {
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text.trim())
  const fr = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text.trim())
  const match = iso ? [iso[1], iso[2], iso[3]] : fr ? [fr[3], fr[2], fr[1]] : null

  if (!match)
    return null

  const [year, month, day] = match.map(Number)

  return month >= 1 && month <= 12 && day >= 1 && day <= 31 ? { year, month, day } : null
}

/** `19:30`, `19h30` ou `19h` → { hours, minutes }. */
export function parseTime(text: string): { hours: number; minutes: number } | null {
  const match = /^(\d{1,2})(?:[:h](\d{2})?)?$/i.exec(text.trim())

  if (!match)
    return null

  const hours = Number(match[1])
  const minutes = Number(match[2] ?? 0)

  return hours < 24 && minutes < 60 ? { hours, minutes } : null
}

const keyOf = (name: string, instant: number) => `${normalizeKey(name)}|${instant}`

export interface ReservationImportContext {
  restaurantId: string
  zone: string
}

/** Import des réservations : une ligne = une réservation (création, ignorée si déjà présente). */
export function reservationsImport(context: ReservationImportContext): ImportDefinition {
  return {
    title: 'Importer des réservations',
    description: 'Téléchargez le modèle, remplissez une ligne par réservation, puis importez le fichier. Les heures s\'entendent dans le fuseau du restaurant.',
    fileName: 'modele-import-reservations',
    sheets: [RESERVATIONS_SHEET],
    notes: [
      'Les heures sont celles du restaurant. Une réservation déjà présente (même nom, même heure) est ignorée.',
      'Les refus du serveur (table occupée, capacité, horaires) sont signalés ligne par ligne.',
    ],
    async run(data, tick) {
      const result: ImportResult = { created: 0, updated: 0, issues: [] }
      const records = data.reservations ?? []

      if (records.length === 0)
        return result

      const tables = await reservationsApi.tables(context.restaurantId)
      const tableByNumber = new Map(tables.map((table: Table) => [normalizeKey(table.numero), table]))

      // Réservations déjà présentes sur la période du fichier : on évite les doublons.
      const instants = records
        .map(record => toInstant(record, context.zone))
        .filter((value): value is number => value !== null)

      const existing = new Set<string>()

      if (instants.length) {
        const from = new Date(Math.min(...instants) - 86_400_000)
        const to = new Date(Math.max(...instants) + 86_400_000)
        const present = await reservationsApi.list(context.restaurantId, { from, to })

        present.forEach((item: Reservation) => {
          if (item.status !== 'cancelled')
            existing.add(keyOf(item.customer_name, new Date(item.reservation_date).getTime()))
        })
      }

      addCounts(result, await runRows('Reservations', records, async (record): Promise<RowOutcome> => {
        const nom = requireText(record, 'nom', 'Nom')
        const couverts = numberField(record, 'couverts', 'Couverts', { required: true, min: 1, integer: true }) ?? 1
        const instant = toInstant(record, context.zone)

        if (instant === null)
          throw new RowError('Date', 'Date ou heure illisible : utilisez AAAA-MM-JJ et HH:MM.')

        if (existing.has(keyOf(nom, instant)))
          throw new RowError('Nom', 'Déjà enregistrée à cette heure : ligne ignorée.')

        const duree = numberField(record, 'duree', 'Durée', { min: 15, integer: true }) ?? 90
        const tableNumber = record.values.table ?? ''
        const table = tableNumber ? tableByNumber.get(normalizeKey(tableNumber)) : undefined

        if (tableNumber && !table)
          throw new RowError('Table', `La table « ${tableNumber} » n'existe pas dans ce restaurant.`)

        try {
          await reservationsApi.create(context.restaurantId, {
            customer_name: nom,
            party_size: couverts,
            reservation_date: new Date(instant).toISOString(),
            duration_minutes: duree,
            table_id: table?.id ?? null,
            customer_phone: record.values.telephone || null,
            customer_email: record.values.email || null,
            notes: record.values.notes || null,
            source: 'POS',
          })
        }
        catch (cause) {
          throw new RowError('', messageOf(cause))
        }

        existing.add(keyOf(nom, instant))

        return 'created'
      }, result.issues, tick))

      return result
    },
  }
}

function toInstant(record: SheetRecord, zone: string): number | null {
  const date = parseDate(record.values.date ?? '')
  const time = parseTime(record.values.heure ?? '')

  if (!date || !time)
    return null

  const instant = fromInputs(`${date.year}-${pad(date.month)}-${pad(date.day)}`, `${pad(time.hours)}:${pad(time.minutes)}`, zone)

  return instant.getTime()
}

/** Import de la liste d'attente : une ligne = un groupe ajouté en fin de file. */
export function waitlistImport(restaurantId: string): ImportDefinition {
  return {
    title: 'Importer la liste d\'attente',
    description: 'Téléchargez le modèle, listez les groupes dans l\'ordre d\'arrivée, puis importez le fichier.',
    fileName: 'modele-import-liste-attente',
    sheets: [WAITLIST_SHEET],
    notes: ['Les groupes sont ajoutés dans l\'ordre du fichier. Un groupe déjà en attente (même nom et même téléphone) est ignoré.'],
    async run(data, tick) {
      const result: ImportResult = { created: 0, updated: 0, issues: [] }
      const records = data.attente ?? []

      if (records.length === 0)
        return result

      const waiting = await reservationsApi.waitlist(restaurantId, 'WAITING')
      const present = new Set(waiting.map(entry => `${normalizeKey(entry.customer_name)}|${normalizeKey(entry.customer_phone ?? '')}`))

      addCounts(result, await runRows('Attente', records, async (record): Promise<RowOutcome> => {
        const nom = requireText(record, 'nom', 'Nom')
        const couverts = numberField(record, 'couverts', 'Couverts', { required: true, min: 1, integer: true }) ?? 1
        const telephone = record.values.telephone || ''
        const key = `${normalizeKey(nom)}|${normalizeKey(telephone)}`

        if (present.has(key))
          throw new RowError('Nom', 'Déjà en attente : ligne ignorée.')

        try {
          await reservationsApi.addToWaitlist(restaurantId, {
            customer_name: nom,
            party_size: couverts,
            customer_phone: telephone || null,
            customer_email: record.values.email || null,
            notes: record.values.notes || null,
            source: 'POS',
          })
        }
        catch (cause) {
          throw new RowError('', messageOf(cause))
        }

        present.add(key)

        return 'created'
      }, result.issues, tick))

      return result
    },
  }
}

// Export -----------------------------------------------------------------------------------

const dateText = (instant: Date, zone: string) => {
  const parts = zonedParts(instant, zone)

  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`
}

const STATUS_TEXT: Record<string, string> = {
  pending: 'En attente',
  confirmed: 'Confirmée',
  checked_in: 'Arrivée',
  completed: 'Terminée',
  cancelled: 'Annulée',
  no_show: 'Absente',
}

/** Exporte les réservations affichées dans le format du modèle d'import. */
/** `numeroOf` donne le numéro de table (ce qui se réimporte), pas son libellé. */
export function exportReservations(bookings: Booking[], zone: string, numeroOf: (id: string) => string, label: string): void {
  const rows: (string | number)[][] = [
    ['nom', 'couverts', 'date', 'heure', 'duree', 'table', 'telephone', 'email', 'notes', 'statut'],
    ...bookings.map(({ reservation, start }) => {
      const parts = zonedParts(start, zone)

      return [
        reservation.customer_name,
        reservation.party_size,
        dateText(start, zone),
        `${pad(parts.hour)}:${pad(parts.minute)}`,
        reservation.duration_minutes,
        reservation.table_id ? numeroOf(reservation.table_id) : '',
        reservation.customer_phone ?? '',
        reservation.customer_email ?? '',
        reservation.notes ?? '',
        STATUS_TEXT[reservation.status] ?? reservation.status,
      ]
    }),
  ]

  download([{ name: 'Reservations', header: true, rows, widths: [26, 10, 12, 8, 8, 10, 18, 26, 36, 14] }], `reservations-${label}`)
}

/** Exporte la liste d'attente (dans l'ordre de la file). */
export function exportWaitlist(entries: WaitlistEntry[], zone: string, label: string): void {
  const rows: (string | number)[][] = [
    ['position', 'nom', 'couverts', 'telephone', 'email', 'notes', 'arrivee', 'statut'],
    ...entries.map(entry => [
      entry.position,
      entry.customer_name,
      entry.party_size,
      entry.customer_phone ?? '',
      entry.customer_email ?? '',
      entry.notes ?? '',
      new Date(entry.joined_at).toLocaleString('fr-FR', { timeZone: zone }),
      entry.status,
    ]),
  ]

  download([{ name: 'Attente', header: true, rows, widths: [10, 26, 10, 18, 26, 36, 20, 12] }], `liste-attente-${label}`)
}

function download(sheets: Parameters<typeof buildXlsx>[0], fileName: string) {
  downloadBlob(buildXlsx(sheets), `${fileName}.xlsx`)
}
