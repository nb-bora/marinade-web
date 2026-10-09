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
  updated: number
  issues: ImportIssue[]
}

/** Appelé après chaque ligne traitée (acceptée ou refusée) : alimente la barre de progression. */
export type ImportTick = () => void

/** Ce qu'un écran fournit au composant d'import : feuilles attendues et envoi des lignes. */
export interface ImportDefinition {
  title: string
  description: string

  /** Nom du fichier téléchargé pour le modèle vierge (sans extension). */
  fileName: string
  sheets: ImportSheetSpec[]

  /** Phrases ajoutées à la feuille « Instructions » du modèle. */
  notes?: string[]
  run: (data: ImportData, tick: ImportTick) => Promise<ImportResult>
}

/** Réunit plusieurs imports dans un même classeur : les feuilles se suivent, les envois s'enchaînent dans l'ordre. */
export function combineImports(
  head: Pick<ImportDefinition, 'title' | 'description' | 'fileName'>,
  ...parts: ImportDefinition[]
): ImportDefinition {
  return {
    ...head,
    sheets: parts.flatMap(part => part.sheets),
    notes: [...new Set(parts.flatMap(part => part.notes ?? []))],
    async run(data, tick) {
      const total: ImportResult = { created: 0, updated: 0, issues: [] }

      for (const part of parts) {
        const result = await part.run(data, tick)

        total.created += result.created
        total.updated += result.updated
        total.issues.push(...result.issues)
      }

      return total
    },
  }
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

/** Une ligne acceptée crée un élément, ou en met un à jour lorsque l'action répond `'updated'`. */
export type RowOutcome = 'created' | 'updated' | void

/**
 * Traite les lignes une par une : une ligne en erreur est signalée (feuille, ligne, champ,
 * message) sans arrêter les suivantes. Renvoie le nombre de lignes créées et mises à jour.
 */
export async function runRows(
  sheet: string,
  records: SheetRecord[],
  action: (record: SheetRecord) => Promise<RowOutcome>,
  issues: ImportIssue[],
  tick?: ImportTick,
): Promise<{ created: number; updated: number }> {
  const counts = { created: 0, updated: 0 }

  for (const record of records) {
    try {
      const outcome = await action(record)

      counts[outcome === 'updated' ? 'updated' : 'created']++
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
    finally {
      tick?.()
    }
  }

  return counts
}

/** Ajoute les comptes d'une feuille au résultat d'ensemble. */
export function addCounts(result: ImportResult, counts: { created: number; updated: number }): void {
  result.created += counts.created
  result.updated += counts.updated
}
