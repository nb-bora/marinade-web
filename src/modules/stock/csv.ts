/** Export CSV côté client, lisible directement par Excel en français (séparateur « ; », BOM UTF-8). */
export function toCsv(header: string[], rows: (string | number)[][]): string {
  const cell = (value: string | number) => {
    const text = String(value)

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
