/** Un nombre écrit comme un nombre (« -5 », « 2,5 ») : jamais une formule, même s'il commence par « - ». */
const NUMERIC = /^-?\d+(?:[.,]\d+)?$/

/** Excel exécute une cellule qui commence par = + - @ : on la rend inoffensive avec une apostrophe. */
const FORMULA = /^[=+\-@\t\r]/

/** Export CSV côté client, lisible directement par Excel en français (séparateur « ; », BOM UTF-8). */
export function toCsv(header: string[], rows: (string | number)[][]): string {
  const cell = (value: string | number) => {
    let text = String(value)

    if (typeof value === 'string' && FORMULA.test(text) && !NUMERIC.test(text))
      text = `'${text}`

    return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }

  return [header, ...rows].map(row => row.map(cell).join(';')).join('\r\n')
}

const BOM = String.fromCharCode(0xFEFF)

export function downloadCsv(filename: string, content: string): void {
  const url = URL.createObjectURL(new Blob([BOM, content], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')

  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
