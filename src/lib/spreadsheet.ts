/**
 * Lecture de tableurs dans le navigateur, sans dépendance : classeurs .xlsx (archive ZIP de
 * fichiers XML) et fichiers .csv. Les anciens .xls (format binaire) ne sont pas lus : on
 * demande d'enregistrer le fichier en .xlsx ou .csv.
 *
 * Toutes les cellules sont rendues en texte ; c'est l'importeur qui sait si une colonne est un
 * nombre, un booléen ou un nom.
 */

export interface Sheet {
  name: string
  rows: string[][]
}

export interface Workbook {
  fileName: string
  sheets: Sheet[]
}

export class SpreadsheetError extends Error {}

// --- Texte ----------------------------------------------------------------------------------

/** « Unité de mesure » -> `unite_de_mesure` : comparer des en-têtes sans se soucier de la saisie. */
export function normalizeKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

/** « 1 500,5 » -> 1500.5 ; `null` si ce n'est pas un nombre. */
export function parseDecimal(value: string): number | null {
  const cleaned = value.replace(/\s/g, '').replace(',', '.')

  if (cleaned === '' || !/^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(cleaned))
    return null

  return Number(cleaned)
}

/** « oui », « vrai », « 1 », « x »... */
export function parseBoolean(value: string): boolean | null {
  const key = normalizeKey(value)

  if (['oui', 'o', 'vrai', 'true', '1', 'x', 'yes'].includes(key))
    return true
  if (['non', 'n', 'faux', 'false', '0', 'no'].includes(key))
    return false

  return null
}

// --- CSV ------------------------------------------------------------------------------------

export function parseCsv(text: string): string[][] {
  const source = text.replace(/^\uFEFF/, '')
  const firstLine = source.split(/\r?\n/, 1)[0] ?? ''

  const delimiter = [';', '\t', ','].reduce((best, candidate) =>
    firstLine.split(candidate).length > firstLine.split(best).length ? candidate : best, ';')

  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false

  const endCell = () => {
    row.push(cell)
    cell = ''
  }

  const endRow = () => {
    endCell()
    if (row.some(item => item.trim() !== ''))
      rows.push(row)
    row = []
  }

  for (let index = 0; index < source.length; index++) {
    const char = source[index]

    if (quoted) {
      if (char === '"' && source[index + 1] === '"') {
        cell += '"'
        index++
      }
      else if (char === '"') {
        quoted = false
      }
      else {
        cell += char
      }
    }
    else if (char === '"') {
      quoted = true
    }
    else if (char === delimiter) {
      endCell()
    }
    else if (char === '\n') {
      endRow()
    }
    else if (char !== '\r') {
      cell += char
    }
  }

  if (cell !== '' || row.length > 0)
    endRow()

  return rows
}

// --- XLSX -----------------------------------------------------------------------------------

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined')
    throw new SpreadsheetError('Ce navigateur ne sait pas ouvrir les fichiers Excel. Utilisez un fichier .csv.')

  const source = new ReadableStream<BufferSource>({
    start(controller) {
      controller.enqueue(data as BufferSource)
      controller.close()
    },
  })

  const stream = source.pipeThrough(new DecompressionStream('deflate-raw'))

  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/** Les fichiers de l'archive ZIP, décompressés, par chemin. */
async function unzip(buffer: ArrayBuffer): Promise<Map<string, Uint8Array>> {
  const view = new DataView(buffer)
  const bytes = new Uint8Array(buffer)
  let end = -1

  for (let index = buffer.byteLength - 22; index >= Math.max(0, buffer.byteLength - 65_557); index--) {
    if (view.getUint32(index, true) === 0x06054B50) {
      end = index
      break
    }
  }

  if (end < 0)
    throw new SpreadsheetError('Ce fichier n\'est pas un classeur Excel (.xlsx) valide.')

  const count = view.getUint16(end + 10, true)
  let cursor = view.getUint32(end + 16, true)
  const decoder = new TextDecoder()
  const files = new Map<string, Uint8Array>()

  for (let entry = 0; entry < count; entry++) {
    if (view.getUint32(cursor, true) !== 0x02014B50)
      throw new SpreadsheetError('Le classeur est endommagé.')

    const method = view.getUint16(cursor + 10, true)
    const size = view.getUint32(cursor + 20, true)
    const nameLength = view.getUint16(cursor + 28, true)
    const extraLength = view.getUint16(cursor + 30, true)
    const commentLength = view.getUint16(cursor + 32, true)
    const localOffset = view.getUint32(cursor + 42, true)
    const name = decoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength))

    cursor += 46 + nameLength + extraLength + commentLength

    // Seuls les fichiers XML utiles sont décompressés.
    if (!/^xl\/(?:workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|worksheets\/[^/]+\.xml)$/.test(name))
      continue

    const start = localOffset + 30 + view.getUint16(localOffset + 26, true) + view.getUint16(localOffset + 28, true)
    const content = bytes.subarray(start, start + size)

    if (method === 0)
      files.set(name, content)
    else if (method === 8)
      files.set(name, await inflateRaw(content))
    else
      throw new SpreadsheetError('Compression du classeur non prise en charge.')
  }

  return files
}

const xml = (data: Uint8Array | undefined) =>
  data ? new DOMParser().parseFromString(new TextDecoder().decode(data), 'application/xml') : null

/** « C12 » -> colonne 2 (base 0). */
function columnIndex(reference: string): number {
  const letters = /^[A-Z]+/i.exec(reference)?.[0].toUpperCase() ?? 'A'

  return [...letters].reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0) - 1
}

const textOf = (node: Element | null | undefined) =>
  Array.from(node?.getElementsByTagName('t') ?? []).map(item => item.textContent ?? '').join('')

async function readXlsx(buffer: ArrayBuffer): Promise<Sheet[]> {
  const files = await unzip(buffer)
  const book = xml(files.get('xl/workbook.xml'))

  if (!book)
    throw new SpreadsheetError('Ce fichier n\'est pas un classeur Excel (.xlsx) valide.')

  const relations = new Map<string, string>()

  for (const item of Array.from(xml(files.get('xl/_rels/workbook.xml.rels'))?.getElementsByTagName('Relationship') ?? []))
    relations.set(item.getAttribute('Id') ?? '', (item.getAttribute('Target') ?? '').replace(/^\/?(?:xl\/)?/, ''))

  const shared = Array.from(xml(files.get('xl/sharedStrings.xml'))?.getElementsByTagName('si') ?? []).map(textOf)
  const sheets: Sheet[] = []

  for (const item of Array.from(book.getElementsByTagName('sheet'))) {
    const target = relations.get(item.getAttribute('r:id') ?? '')
    const doc = target ? xml(files.get(`xl/${target}`)) : null

    if (!doc)
      continue

    const rows: string[][] = []

    for (const rowNode of Array.from(doc.getElementsByTagName('row'))) {
      const cells: string[] = []

      for (const cell of Array.from(rowNode.getElementsByTagName('c'))) {
        const type = cell.getAttribute('t')
        const raw = cell.getElementsByTagName('v')[0]?.textContent ?? ''
        let value = raw

        if (type === 's')
          value = shared[Number(raw)] ?? ''
        else if (type === 'inlineStr')
          value = textOf(cell)
        else if (type === 'b')
          value = raw === '1' ? 'oui' : 'non'

        cells[columnIndex(cell.getAttribute('r') ?? 'A1')] = value.trim()
      }

      const full = Array.from(cells, value => value ?? '')

      if (full.some(value => value !== ''))
        rows[Number(rowNode.getAttribute('r') ?? rows.length + 1) - 1] = full
    }

    sheets.push({ name: item.getAttribute('name') ?? `Feuille ${sheets.length + 1}`, rows: Array.from(rows, row => row ?? []) })
  }

  return sheets
}

/** Ouvre un classeur .xlsx ou un fichier .csv. */
export async function readWorkbook(file: File): Promise<Workbook> {
  const extension = file.name.split('.').pop()?.toLowerCase()

  if (extension === 'csv')
    return { fileName: file.name, sheets: [{ name: 'CSV', rows: parseCsv(await file.text()) }] }

  if (extension === 'xls')
    throw new SpreadsheetError('Les anciens fichiers .xls ne sont pas lus : enregistrez-le en .xlsx ou en .csv depuis Excel.')

  if (extension !== 'xlsx')
    throw new SpreadsheetError('Format non reconnu : choisissez un fichier .xlsx ou .csv.')

  const sheets = await readXlsx(await file.arrayBuffer())

  if (sheets.length === 0)
    throw new SpreadsheetError('Le classeur ne contient aucune feuille.')

  return { fileName: file.name, sheets }
}

// --- Rattachement à des colonnes attendues ---------------------------------------------------

export interface ColumnSpec {
  key: string
  label: string
  required?: boolean

  /** Autres intitulés acceptés dans le fichier. */
  aliases?: string[]
}

export interface SheetRecord {

  /** Numéro de ligne dans le fichier (l'en-tête est la ligne 1). */
  row: number
  values: Record<string, string>
}

export interface MappedSheet {
  records: SheetRecord[]
  missingColumns: ColumnSpec[]
}

/** Lit la première ligne comme en-tête, retrouve les colonnes attendues, et ignore les autres. */
export function mapSheet(sheet: Sheet | undefined, columns: ColumnSpec[]): MappedSheet {
  if (!sheet || sheet.rows.length === 0)
    return { records: [], missingColumns: columns.filter(column => column.required) }

  const header = (sheet.rows[0] ?? []).map(normalizeKey)
  const positions = new Map<string, number>()
  const missingColumns: ColumnSpec[] = []

  for (const column of columns) {
    const names = [column.key, column.label, ...(column.aliases ?? [])].map(normalizeKey)
    const position = header.findIndex(name => names.includes(name))

    if (position >= 0)
      positions.set(column.key, position)
    else if (column.required)
      missingColumns.push(column)
  }

  const records = sheet.rows
    .slice(1)
    .map((cells, index) => ({
      row: index + 2,
      values: Object.fromEntries(columns.map(column => [column.key, (cells[positions.get(column.key) ?? -1] ?? '').trim()])),
    }))
    .filter(record => Object.values(record.values).some(value => value !== ''))

  return { records, missingColumns }
}
