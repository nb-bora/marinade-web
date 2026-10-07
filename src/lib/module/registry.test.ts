import { describe, expect, it } from 'vitest'
import { buildNavigation, collectRoutes, collectWidgets } from './registry'
import type { FeatureModule } from './types'
import type { Capability } from '@/lib/api/types'

const Stub = { default: {} }

const features: FeatureModule[] = [
  {
    id: 'a',
    routes: [{ path: '/a', component: {}, meta: {} }],
    nav: [
      { id: 'a-home', title: 'Accueil', icon: 'ri-home-line', to: '/a', section: 'overview', order: 1 },
      { id: 'a-cash', title: 'Caisse', icon: 'ri-bank-line', to: '/cash', section: 'finance', capability: 'cash_desk' },
    ],
    widgets: [
      { id: 'w-cash', component: async () => Stub, width: 6, order: 5, capability: 'cash_desk' },
      { id: 'w-open', component: async () => Stub, width: 12, order: 1 },
    ],
  },
  {
    id: 'b',
    routes: [{ path: '/login', component: {}, meta: { layout: 'blank' } }],
    nav: [
      { id: 'b-admin', title: 'Plateforme', icon: 'ri-settings-line', to: '/admin', section: 'administration', platformAdmin: true },
      { id: 'b-stock', title: 'Stock', icon: 'ri-stock-line', to: '/stock', section: 'catalog', capability: 'stock', order: 2 },
      { id: 'b-menu', title: 'Carte', icon: 'ri-book-line', to: '/menu', section: 'catalog', capability: 'management', order: 1 },
    ],
  },
]

const audience = (capabilities: Capability[], isPlatformAdmin = false) => ({
  isPlatformAdmin,
  can: (capability: Capability) => capabilities.includes(capability),
})

describe('buildNavigation', () => {
  it('ne montre que ce que les droits permettent, section par section', () => {
    const sections = buildNavigation(features, audience(['cash_desk']))

    expect(sections.map(section => section.id)).toEqual(['overview', 'finance'])
    expect(sections[1].entries.map(entry => entry.id)).toEqual(['a-cash'])
  })

  it('un serveur sans droit ne voit que l\'accueil', () => {
    const sections = buildNavigation(features, audience([]))

    expect(sections.flatMap(section => section.entries.map(entry => entry.id))).toEqual(['a-home'])
  })

  it('classe les entrées par ordre au sein d\'une section', () => {
    const sections = buildNavigation(features, audience(['management', 'stock']))
    const catalog = sections.find(section => section.id === 'catalog')

    expect(catalog?.entries.map(entry => entry.id)).toEqual(['b-menu', 'b-stock'])
  })

  it('réserve les entrées « plateforme » aux administrateurs', () => {
    expect(buildNavigation(features, audience([])).some(section => section.id === 'administration')).toBe(false)
    expect(buildNavigation(features, audience([], true)).some(section => section.id === 'administration')).toBe(true)
  })

  it('omet les sections vides', () => {
    const sections = buildNavigation(features, audience([]))

    expect(sections.every(section => section.entries.length > 0)).toBe(true)
  })
})

describe('collectRoutes', () => {
  it('regroupe les routes par mise en page', () => {
    const grouped = collectRoutes(features)

    expect(grouped.default.map(route => route.path)).toEqual(['/a'])
    expect(grouped.blank.map(route => route.path)).toEqual(['/login'])
  })
})

describe('collectWidgets', () => {
  it('filtre par droit et ordonne', () => {
    expect(collectWidgets(features, audience([])).map(widget => widget.id)).toEqual(['w-open'])
    expect(collectWidgets(features, audience(['cash_desk'])).map(widget => widget.id)).toEqual(['w-open', 'w-cash'])
  })
})
