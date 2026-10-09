import type { ImportSheetSpec } from '@/lib/sheetImport'
import { buildXlsx, downloadBlob } from '@/lib/xlsxWriter'
import type { XlsxSheet } from '@/lib/xlsxWriter'

/** Un classeur vierge : une feuille par type de données (titres de colonnes seulement) et une feuille d'instructions. */
export function buildTemplate(sheets: ImportSheetSpec[], notes: string[] = []): Blob {
  const data: XlsxSheet[] = sheets.map(spec => ({
    name: spec.name,
    header: true,
    rows: [spec.columns.map(column => column.key)],
    widths: spec.columns.map(column => Math.max(14, column.key.length + 6)),
  }))

  const instructions: XlsxSheet = {
    name: 'Instructions',
    header: true,
    wrap: true,
    widths: [16, 24, 13, 58, 26],
    rows: [
      ['Feuille', 'Colonne', 'Obligatoire', 'Explication', 'Exemple'],
      ...sheets.flatMap(spec => spec.columns.map(column => [
        spec.name,
        column.key,
        column.required ? 'Oui' : 'Non',
        column.hint ?? column.label,
        column.example ?? '',
      ])),
      [],
      ['Remplissez les feuilles ci-contre à partir de la deuxième ligne, sans modifier les titres de la première ligne. Les feuilles que vous n\'utilisez pas peuvent rester vides.'],
      ...notes.map(note => [note]),
    ],
  }

  return buildXlsx([...data, instructions])
}

/** Télécharge le modèle vierge : `modele-import-plats.xlsx`. */
export function downloadTemplate(fileName: string, sheets: ImportSheetSpec[], notes: string[] = []): void {
  downloadBlob(buildTemplate(sheets, notes), `${fileName}.xlsx`)
}
