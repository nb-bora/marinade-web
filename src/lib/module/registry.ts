import type { RouteRecordRaw } from 'vue-router'
import type { DashboardWidget, FeatureModule, NavEntry, NavSectionId } from './types'
import { NAV_SECTIONS } from './types'
import type { Capability } from '@/lib/api/types'

/** Ce que le menu a besoin de savoir de l'utilisateur pour filtrer ses entrées. */
export interface NavAudience {
  isPlatformAdmin: boolean
  can: (capability: Capability) => boolean
}

export interface NavSection {
  id: NavSectionId
  title: string | null
  entries: NavEntry[]
}

/** Les routes de toutes les fonctionnalités, regroupées par mise en page. */
export function collectRoutes(features: FeatureModule[]): { default: RouteRecordRaw[]; blank: RouteRecordRaw[] } {
  const grouped: { default: RouteRecordRaw[]; blank: RouteRecordRaw[] } = { default: [], blank: [] }

  for (const route of features.flatMap(feature => feature.routes))
    grouped[route.meta?.layout === 'blank' ? 'blank' : 'default'].push(route)

  return grouped
}

/** Le menu visible par `audience`, section par section, sans section vide. */
export function buildNavigation(features: FeatureModule[], audience: NavAudience): NavSection[] {
  const entries = features.flatMap(feature => feature.nav ?? [])

  const allowed = entries.filter(entry =>
    (!entry.platformAdmin || audience.isPlatformAdmin)
    && (!entry.capability || audience.can(entry.capability)),
  )

  return NAV_SECTIONS
    .map(section => ({
      id: section.id,
      title: section.title,
      entries: allowed
        .filter(entry => entry.section === section.id)
        .sort((a, b) => (a.order ?? 100) - (b.order ?? 100)),
    }))
    .filter(section => section.entries.length > 0)
}

/** Les widgets du tableau de bord que `audience` peut voir, dans l'ordre. */
export function collectWidgets(features: FeatureModule[], audience: Pick<NavAudience, 'can'>): DashboardWidget[] {
  return features
    .flatMap(feature => feature.widgets ?? [])
    .filter(widget => !widget.capability || audience.can(widget.capability))
    .sort((a, b) => (a.order ?? 100) - (b.order ?? 100))
}

/** Découverte automatique : tout `src/modules/<nom>/module.ts` est une fonctionnalité. */
export function discoverFeatures(): FeatureModule[] {
  const found = import.meta.glob<{ default: FeatureModule }>('/src/modules/*/module.ts', { eager: true })

  const features = Object.values(found).map(file => file.default)
  const duplicate = features.find((feature, index) => features.findIndex(other => other.id === feature.id) !== index)

  if (duplicate)
    throw new Error(`Deux modules portent l'identifiant « ${duplicate.id} »`)

  return features.sort((a, b) => a.id.localeCompare(b.id))
}
