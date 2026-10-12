import type { RouteRecordRaw } from 'vue-router'
import type { DashboardWidget, EstablishmentType, FeatureModule, NavEntry, NavSectionId } from './types'
import { NAV_SECTIONS } from './types'
import type { Capability } from '@/lib/api/types'

/** Ce que le menu a besoin de savoir de l'utilisateur pour filtrer ses entrées. */
export interface NavAudience {
  isPlatformAdmin: boolean
  can: (capability: Capability) => boolean

  /** Type de l'établissement courant ; sans lui, aucun filtre par type n'est appliqué. */
  etablissement?: EstablishmentType | null
}

/** Une entrée (ou un widget) réservée à un type est cachée aux autres types d'établissement. */
const matchesEstablishment = (wanted: EstablishmentType | undefined, current: EstablishmentType | null | undefined) =>
  !wanted || !current || wanted === current

export interface NavSection {
  id: NavSectionId
  title: string | null
  entries: NavEntry[]
}

/** Les routes de toutes les fonctionnalités, regroupées par mise en page. */
export function collectRoutes(features: FeatureModule[]): { default: RouteRecordRaw[]; blank: RouteRecordRaw[] } {
  const grouped: { default: RouteRecordRaw[]; blank: RouteRecordRaw[] } = { default: [], blank: [] }

  for (const feature of features) {
    for (const route of feature.routes) {
      // Le type du module vaut pour toutes ses routes, sauf si la route en déclare un autre.
      const tagged = feature.etablissement && !route.meta?.etablissement
        ? { ...route, meta: { ...route.meta, etablissement: feature.etablissement } } as RouteRecordRaw
        : route

      grouped[route.meta?.layout === 'blank' ? 'blank' : 'default'].push(tagged)
    }
  }

  return grouped
}

/** Le menu visible par `audience`, section par section, sans section vide. */
export function buildNavigation(features: FeatureModule[], audience: NavAudience): NavSection[] {
  const entries = features.flatMap(feature => (feature.nav ?? []).map(entry => ({
    ...entry,
    etablissement: entry.etablissement ?? feature.etablissement,
  })))

  const allowed = entries.filter(entry =>
    (!entry.platformAdmin || audience.isPlatformAdmin)
    && (!entry.capability || audience.can(entry.capability))
    && matchesEstablishment(entry.etablissement, audience.etablissement),
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
export function collectWidgets(features: FeatureModule[], audience: Pick<NavAudience, 'can' | 'etablissement'>): DashboardWidget[] {
  return features
    .flatMap(feature => (feature.widgets ?? []).map(widget => ({ ...widget, etablissement: widget.etablissement ?? feature.etablissement })))
    .filter(widget => (!widget.capability || audience.can(widget.capability))
      && matchesEstablishment(widget.etablissement, audience.etablissement))
    .sort((a, b) => (a.order ?? 100) - (b.order ?? 100))
}

/** Page d'accueil de chaque type d'établissement, telle que les modules la déclarent (`accueil`). */
export function homePaths(features: FeatureModule[]): Partial<Record<EstablishmentType, string>> {
  const homes: Partial<Record<EstablishmentType, string>> = {}

  for (const feature of features) {
    if (feature.etablissement && feature.accueil)
      homes[feature.etablissement] = feature.accueil
  }

  return homes
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
