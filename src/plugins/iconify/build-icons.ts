/**
 * Génère `icons.css` avec UNIQUEMENT les icônes Remix Icon utilisées par le code.
 *
 * Le jeu complet pèse ~1,5 Mo de CSS ; l'application en utilise quelques dizaines. Le
 * script lit les sources, retient chaque nom Remix (préfixe « ri- ») écrit en toutes
 * lettres et ne garde que celles-là. Règle d'équipe : une icône s'écrit toujours
 * littéralement (`'ri-home-line'`), jamais construite par concaténation, sinon le scanner
 * ne la voit pas.
 *
 * Lancé automatiquement avant `dev` et `build` (voir package.json).
 */
import { promises as fs } from 'node:fs'
import { join } from 'node:path'

import type { IconifyJSON } from '@iconify/types'
import { getIcons, getIconsCSS } from '@iconify/utils'

const SOURCE_DIR = join(__dirname, '..', '..')
const TARGET = join(__dirname, 'icons.css')
const SCANNED_EXTENSIONS = /\.(?:vue|ts|tsx|js|html)$/
const ICON_NAME = /\bri-[a-z0-9]+(?:-[a-z0-9]+)*\b/g

async function* walk(directory: string): AsyncGenerator<string> {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)

    if (entry.isDirectory())
      yield * walk(path)
    else if (SCANNED_EXTENSIONS.test(entry.name))
      yield path
  }
}

async function collectUsedIconNames(): Promise<Set<string>> {
  const used = new Set<string>()

  for await (const file of walk(SOURCE_DIR)) {
    const content = await fs.readFile(file, 'utf8')

    for (const match of content.matchAll(ICON_NAME))
      used.add(match[0].slice('ri-'.length))
  }

  return used
}

;(async () => {
  const catalogue = JSON.parse(
    await fs.readFile(require.resolve('@iconify-json/ri/icons.json'), 'utf8'),
  ) as IconifyJSON

  const used = await collectUsedIconNames()
  const known = [...used].filter(name => name in catalogue.icons || name in (catalogue.aliases ?? {}))
  const unknown = [...used].filter(name => !known.includes(name))

  const subset = getIcons(catalogue, known)
  if (!subset)
    throw new Error('Aucune icône Remix trouvée dans les sources')

  const css = getIconsCSS(subset, Object.keys(subset.icons), { iconSelector: '.{prefix}-{name}' })

  await fs.writeFile(TARGET, css, 'utf8')
  console.log(`icons.css : ${known.length} icônes (${Math.round(css.length / 1024)} Ko)`)

  if (unknown.length)
    console.warn(`Noms ri-* inconnus du catalogue Remix (ignorés) : ${unknown.join(', ')}`)
})().catch(error => {
  console.error(error)
  process.exitCode = 1
})
