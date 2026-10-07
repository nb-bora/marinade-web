import type { Component } from 'vue'
import type { RouteRecordRaw } from 'vue-router'
import type { Capability } from '@/lib/api/types'

/**
 * Sections du menu latéral, dans l'ordre d'affichage. Ajouter une section = ajouter une
 * ligne ici ; aucun composant à modifier.
 */
export const NAV_SECTIONS = [
  { id: 'overview', title: null },
  { id: 'operations', title: 'Exploitation' },
  { id: 'catalog', title: 'Carte et stock' },
  { id: 'finance', title: 'Finances' },
  { id: 'administration', title: 'Administration' },
] as const

export type NavSectionId = typeof NAV_SECTIONS[number]['id']

export interface NavEntry {
  id: string
  title: string

  /** Classe d'icône Remix, écrite en toutes lettres (ex. `ri-home-line`). */
  icon: string
  to: string
  section: NavSectionId

  /** Position dans la section (croissant). */
  order?: number

  /** N'apparaît que si l'utilisateur a cette capacité dans le restaurant courant. */
  capability?: Capability

  /** Réservé aux administrateurs de la plateforme. */
  platformAdmin?: boolean
}

/** Un bloc que le tableau de bord affiche sans connaître le module qui le fournit. */
export interface DashboardWidget {
  id: string

  /** Chargé à la demande : un widget que l'on ne voit pas ne coûte rien. */
  component: () => Promise<{ default: Component }>

  /** Largeur sur 12 colonnes, à partir de l'écran moyen (sur mobile : pleine largeur). */
  width: 4 | 6 | 8 | 12

  /** Position (croissant). */
  order?: number

  /** N'est affiché que si l'utilisateur a cette capacité dans le restaurant courant. */
  capability?: Capability
}

/**
 * Une fonctionnalité de l'application, autonome : ses pages, sa place dans le menu et
 * les droits requis. Le routeur et le menu sont BÂTIS à partir des modules découverts
 * dans `src/modules/<nom>/module.ts` : en ajouter un ne demande de modifier aucun
 * fichier existant (principe ouvert/fermé).
 */
export interface FeatureModule {
  id: string
  routes: RouteRecordRaw[]
  nav?: NavEntry[]
  widgets?: DashboardWidget[]
}

export const defineFeature = (feature: FeatureModule): FeatureModule => feature
