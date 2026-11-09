/**
 * Un document légal est une liste de sections ; chaque section, une liste de blocs.
 * Le texte accepte un balisage minimal (voir `inline.ts`) : `**gras**` et `[libellé](lien)`.
 */
export type LegalBlock =
  | { type: 'p'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'note'; text: string }
  | { type: 'table'; caption: string; head: string[]; rows: string[][] }

export interface LegalSection {

  /** Ancre (`#id`) : minuscules, chiffres et tirets. */
  id: string
  title: string
  blocks: LegalBlock[]
}

export interface LegalDocument {
  title: string

  /** Une phrase : l'essentiel du document, affichée sous le titre. */
  summary: string

  /** Date de dernière mise à jour, au format AAAA-MM-JJ. */
  updatedAt: string
  version: string
  sections: LegalSection[]
}
