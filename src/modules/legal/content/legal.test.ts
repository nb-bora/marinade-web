import { describe, expect, it } from 'vitest'
import { contactSentence, readLegalInfo } from '../legalInfo'
import type { LegalInfo } from '../legalInfo'
import { parseInline } from './inline'
import { buildPrivacy } from './privacy'
import { buildTerms } from './terms'
import type { LegalDocument } from './types'

const bare: LegalInfo = { entityName: null, contactEmail: null }
const configured: LegalInfo = { entityName: 'Acme SARL', contactEmail: 'privacy@acme.test' }

const documents: [string, (info: LegalInfo) => LegalDocument][] = [
  ['politique de confidentialité', buildPrivacy],
  ['conditions d\'utilisation', buildTerms],
]

describe.each(documents)('%s', (_name, build) => {
  it.each([bare, configured])('a des sections aux ancres uniques et valides', info => {
    const { sections } = build(info)
    const ids = sections.map(section => section.id)

    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.every(id => /^[a-z0-9-]+$/.test(id))).toBe(true)
    expect(sections.every(section => section.title && section.blocks.length > 0)).toBe(true)
  })

  it('a des tableaux rectangulaires', () => {
    for (const section of build(bare).sections) {
      for (const block of section.blocks) {
        if (block.type === 'table')
          expect(block.rows.every(row => row.length === block.head.length)).toBe(true)
      }
    }
  })

  it('n\'a aucun texte de remplissage ni placeholder', () => {
    const text = JSON.stringify(build(bare))

    expect(text).not.toMatch(/lorem|TODO|XXX|\[à compléter|undefined|null/i)
  })

  it('ne renvoie que vers des ancres qui existent', () => {
    const all = { privacy: buildPrivacy(bare), terms: buildTerms(bare) }
    const text = JSON.stringify(build(bare))

    for (const [, page, anchor] of text.matchAll(/\]\(\/(privacy|terms)(?:#([\w-]+))?\)/g)) {
      if (anchor)
        expect(all[page as 'privacy' | 'terms'].sections.map(s => s.id)).toContain(anchor)
    }

    for (const [, anchor] of text.matchAll(/\]\(#([\w-]+)\)/g))
      expect(build(bare).sections.map(s => s.id)).toContain(anchor)
  })

  it('a une date de mise à jour valide', () => {
    expect(Number.isNaN(Date.parse(build(bare).updatedAt))).toBe(false)
  })
})

describe('coordonnées de l\'éditeur', () => {
  it('cite la raison sociale et l\'adresse quand elles sont configurées', () => {
    const text = JSON.stringify(buildPrivacy(configured))

    expect(text).toContain('Acme SARL')
    expect(text).toContain('mailto:privacy@acme.test')
  })

  it('renvoie vers l\'espace Marinade sans adresse configurée', () => {
    expect(contactSentence(bare, 'Pour toute question')).toContain('espace Marinade')
    expect(JSON.stringify(buildTerms(bare))).not.toContain('mailto:')
  })

  it('ignore une adresse invalide', () => {
    const info = readLegalInfo({ VITE_LEGAL_CONTACT_EMAIL: 'pas-un-email', VITE_LEGAL_ENTITY_NAME: '  ' } as ImportMetaEnv)

    expect(info).toEqual({ entityName: null, contactEmail: null })
  })
})

describe('parseInline', () => {
  it('découpe texte, gras et liens', () => {
    expect(parseInline('a **b** [c](/terms) d')).toEqual([
      { type: 'text', text: 'a ' },
      { type: 'strong', text: 'b' },
      { type: 'text', text: ' ' },
      { type: 'link', text: 'c', href: '/terms', external: false },
      { type: 'text', text: ' d' },
    ])
  })

  it('accepte une ancre sur une page et un lien e-mail', () => {
    expect(parseInline('[x](/privacy#conservation)')[0]).toMatchObject({ type: 'link', href: '/privacy#conservation' })
    expect(parseInline('[m](mailto:a@b.co)')[0]).toMatchObject({ type: 'link', external: true })
  })

  it('refuse les liens dangereux ou externes : rendus en texte simple', () => {
    for (const href of ['javascript:void0', 'https://evil.test', '//evil.test', 'data:text/html,x'])
      expect(parseInline(`[clic](${href})`)).toEqual([{ type: 'text', text: 'clic' }])
  })
})
