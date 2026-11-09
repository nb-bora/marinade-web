export type InlineSegment =
  | { type: 'text'; text: string }
  | { type: 'strong'; text: string }
  | { type: 'link'; text: string; href: string; external: boolean }

const TOKEN = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g

/** Liens autorisés : pages internes, e-mail. Tout le reste est rendu comme du texte simple. */
const SAFE_HREF = /^(?:\/(?!\/)[\w\-/#?=&]*|mailto:[^\s@]+@[^\s@]+)$/

/**
 * Découpe un texte en segments (texte, gras, lien). Le rendu se fait avec des composants
 * Vue, jamais avec `v-html` : un contenu ne peut donc pas injecter de balise.
 */
export function parseInline(source: string): InlineSegment[] {
  const segments: InlineSegment[] = []
  let cursor = 0

  for (const match of source.matchAll(TOKEN)) {
    const start = match.index ?? 0

    if (start > cursor)
      segments.push({ type: 'text', text: source.slice(cursor, start) })

    if (match[1] !== undefined)
      segments.push({ type: 'strong', text: match[1] })

    else if (SAFE_HREF.test(match[3]))
      segments.push({ type: 'link', text: match[2], href: match[3], external: match[3].startsWith('mailto:') })

    else
      segments.push({ type: 'text', text: match[2] })

    cursor = start + match[0].length
  }

  if (cursor < source.length)
    segments.push({ type: 'text', text: source.slice(cursor) })

  return segments
}
