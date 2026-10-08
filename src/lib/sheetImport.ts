import { describeError } from '@/lib/http/errorMessages'
import { isApiError } from '@/lib/http/errors'
import { parseBoolean, parseDecimal } from '@/lib/spreadsheet'
import type { ColumnSpec, SheetRecord } from '@/lib/spreadsheet'

/** Une feuille attendue dans le fichier, et les colonnes qu'on y lit. */
export interface ImportSheetSpec {

  /** Clé de la feuille dans les données remises à l'importeur. */
  key: string

  /** Nom de la feuille dans le classeur (comparé sans accents ni casse). */
  name: string
  columns: ColumnSpec[]

  /** La feuille peut manquer sans bloquer l'import. */
  optional?: boolean
}

export interface ImportIssue {
  sheet: string

  /** Numéro de ligne dans le fichier. */
  row: number
  field: string
  message: string
}

export interface ImportResult {
  created: number
  issues: ImportIssue[]
}

export type ImportData = Record<string, SheetRecord[]>

/** Ligne invalide avant tout appel au serveur. */
export class RowError extends Error {
  constructor(readonly field: string, message: string) {
    super(message)
  }
}

export function requireText(record: SheetRecord, key: string, label: string): string {
  const value = record.values[key] ?? ''

  if (value === '')
    throw new RowError(label, 'Valeur obligatoire.')

  return value
}

export function numberField(record: SheetRecord, key: string, label: string, options: { required?: boolean; min?: number; integer?: boolean } = {}): number | undefined {
  const text = record.values[key] ?? ''

  if (text === '') {
    if (options.required)
      throw new RowError(label, 'Valeur obligatoire.')

    return undefined
  }

  const value = parseDecimal(text)

  if (value === null)
    throw new RowError(label, `« ${text} » n'est pas un nombre.`)
  if (options.integer && !Number.isInteger(value))
    throw new RowError(label, 'Un nombre entier est attendu.')
  if (options.min !== undefined && value < options.min)
    throw new RowError(label, `La valeur doit être au moins ${options.min}.`)

  return value
}

export function booleanField(record: SheetRecord, key: string, label: string): boolean | undefined {
  const text = record.values[key] ?? ''

  if (text === '')
    return undefined

  const value = parseBoolean(text)

  if (value === null)
    throw new RowError(label, 'Répondez par « oui » ou « non ».')

  return value
}

/**
 * Traite les lignes une par une : une ligne en erreur est signalée (feuille, ligne, champ,
 * message) sans arrêter les suivantes. Renvoie le nombre de lignes acceptées.
 */
export async function runRows(
  sheet: string,
  records: SheetRecord[],
  action: (record: SheetRecord) => Promise<unknown>,
  issues: ImportIssue[],
): Promise<number> {
  let created = 0

  for (const record of records) {
    try {
      await action(record)
      created++
    }
    catch (cause) {
      if (cause instanceof RowError) {
        issues.push({ sheet, row: record.row, field: cause.field, message: cause.message })
      }
      else {
        const field = isApiError(cause) ? cause.fieldErrors[0]?.field ?? '' : ''

        issues.push({ sheet, row: record.row, field, message: describeError(cause) })
      }
    }
  }

  return created
}
