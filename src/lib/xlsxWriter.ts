/**
 * Écriture d'un classeur .xlsx dans le navigateur, sans dépendance : une archive ZIP (sans
 * compression) de quelques fichiers XML. Suffisant pour des modèles d'import : texte, nombres,
 * une ligne d'en-tête colorée et figée, des largeurs de colonne.
 */

export interface XlsxSheet {

  /** 31 caractères au plus, sans `[ ] : * ? / \`. */
  name: string
  rows: (string | number)[][]

  /** Largeur de chaque colonne, en caractères. */
  widths?: number[]

  /** La première ligne est un en-tête : colorée, en gras et figée à l'écran. */
  header?: boolean

  /** Retour à la ligne dans les cellules (feuille d'instructions). */
  wrap?: boolean
}

const encoder = new TextEncoder()

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)

  for (let index = 0; index < 256; index++) {
    let value = index

    for (let bit = 0; bit < 8; bit++)
      value = value & 1 ? (value >>> 1) ^ 0xEDB88320 : value >>> 1
    table[index] = value >>> 0
  }

  return table
})()

function crc32(data: Uint8Array): number {
  let crc = 0xFFFFFFFF

  for (const byte of data)
    crc = CRC_TABLE[(crc ^ byte) & 0xFF] ^ (crc >>> 8)

  return (crc ^ 0xFFFFFFFF) >>> 0
}

/** Archive ZIP « stockée » (méthode 0) : pas de compression, lisible par tous les tableurs. */
function zip(files: { path: string; content: string }[]): Uint8Array {
  const chunks: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0

  for (const file of files) {
    const name = encoder.encode(file.path)
    const data = encoder.encode(file.content)
    const crc = crc32(data)

    const local = new DataView(new ArrayBuffer(30))

    local.setUint32(0, 0x04034B50, true)
    local.setUint16(4, 20, true)
    local.setUint16(6, 0x0800, true)
    local.setUint16(10, 0, true)
    local.setUint16(12, 0x0021, true)
    local.setUint32(14, crc, true)
    local.setUint32(18, data.length, true)
    local.setUint32(22, data.length, true)
    local.setUint16(26, name.length, true)

    const entry = new DataView(new ArrayBuffer(46))

    entry.setUint32(0, 0x02014B50, true)
    entry.setUint16(4, 20, true)
    entry.setUint16(6, 20, true)
    entry.setUint16(8, 0x0800, true)
    entry.setUint16(14, 0x0021, true)
    entry.setUint32(16, crc, true)
    entry.setUint32(20, data.length, true)
    entry.setUint32(24, data.length, true)
    entry.setUint16(28, name.length, true)
    entry.setUint32(42, offset, true)

    chunks.push(new Uint8Array(local.buffer), name, data)
    central.push(new Uint8Array(entry.buffer), name)
    offset += 30 + name.length + data.length
  }

  const centralSize = central.reduce((sum, part) => sum + part.length, 0)
  const end = new DataView(new ArrayBuffer(22))

  end.setUint32(0, 0x06054B50, true)
  end.setUint16(8, files.length, true)
  end.setUint16(10, files.length, true)
  end.setUint32(12, centralSize, true)
  end.setUint32(16, offset, true)

  const parts = [...chunks, ...central, new Uint8Array(end.buffer)]
  const output = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
  let cursor = 0

  for (const part of parts) {
    output.set(part, cursor)
    cursor += part.length
  }

  return output
}

const escapeXml = (text: string) => text
  // eslint-disable-next-line no-control-regex
  .replace(/[\u0000-\u0008\v\f\u000E-\u001F]/g, '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')

/** 0 -> A, 25 -> Z, 26 -> AA. */
function columnName(index: number): string {
  let name = ''

  for (let value = index + 1; value > 0; value = Math.floor((value - 1) / 26))
    name = String.fromCharCode(65 + ((value - 1) % 26)) + name

  return name
}

const STYLE_DEFAULT = 0
const STYLE_HEADER = 1
const STYLE_WRAP = 2

function sheetXml(sheet: XlsxSheet, selected: boolean): string {
  const widths = (sheet.widths ?? []).map((width, index) =>
    `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join('')

  const rows = sheet.rows.map((cells, rowIndex) => {
    const style = sheet.header && rowIndex === 0 ? STYLE_HEADER : sheet.wrap ? STYLE_WRAP : STYLE_DEFAULT

    const content = cells.map((cell, columnIndex) => {
      const reference = `${columnName(columnIndex)}${rowIndex + 1}`

      if (typeof cell === 'number')
        return `<c r="${reference}" s="${style}"><v>${cell}</v></c>`

      return `<c r="${reference}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(cell)}</t></is></c>`
    }).join('')

    return `<row r="${rowIndex + 1}"${sheet.header && rowIndex === 0 ? ' ht="24" customHeight="1"' : ''}>${content}</row>`
  }).join('')

  const pane = sheet.header
    ? '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>'
    : ''

  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    + `<sheetViews><sheetView workbookViewId="0"${selected ? ' tabSelected="1"' : ''}>${pane}</sheetView></sheetViews>`
    + `<sheetFormatPr defaultRowHeight="15"/>${
      widths ? `<cols>${widths}</cols>` : ''
    }<sheetData>${rows}</sheetData></worksheet>`
}

const STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
  + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
  + '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font>'
  + '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>'
  + '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>'
  + '<fill><patternFill patternType="solid"><fgColor rgb="FFEA6A2B"/><bgColor indexed="64"/></patternFill></fill></fills>'
  + '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
  + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
  + '<cellXfs count="3">'
  + '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
  + '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf>'
  + '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>'
  + '</cellXfs>'
  + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

/** Construit le fichier .xlsx ; la première feuille s'ouvre à l'écran. */
export function buildXlsx(sheets: XlsxSheet[]): Blob {
  const main = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
  const rels = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'

  const files = [
    {
      path: '[Content_Types].xml',
      content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        + '<Default Extension="xml" ContentType="application/xml"/>'
        + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        + `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${
          sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')
        }</Types>`,
    },
    {
      path: '_rels/.rels',
      content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        + `<Relationship Id="rId1" Type="${rels}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    },
    {
      path: 'xl/workbook.xml',
      content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + `<workbook xmlns="${main}" xmlns:r="${rels}"><bookViews><workbookView activeTab="0"/></bookViews><sheets>${
          sheets.map((sheet, index) => `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join('')
        }</sheets></workbook>`,
    },
    {
      path: 'xl/_rels/workbook.xml.rels',
      content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${
          sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="${rels}/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join('')
        }<Relationship Id="rId${sheets.length + 1}" Type="${rels}/styles" Target="styles.xml"/></Relationships>`,
    },
    { path: 'xl/styles.xml', content: STYLES },
    ...sheets.map((sheet, index) => ({ path: `xl/worksheets/sheet${index + 1}.xml`, content: sheetXml(sheet, index === 0) })),
  ]

  return new Blob([zip(files) as BlobPart], { type: XLSX_TYPE })
}

/** Déclenche le téléchargement d'un fichier généré dans le navigateur. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
