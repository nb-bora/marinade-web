import type { components } from '@/lib/api/schema'

type Schemas = components['schemas']

export type Composant = Schemas['ComposantResponse']
export type ComposantCreate = Schemas['ComposantCreate']
export type ComposantUpdate = Schemas['ComposantUpdate']

export type StockLevel = Schemas['StockComposantResponse']
export type StockMovementCreate = Schemas['StockMouvementCreate']
export type StockMovementType = StockMovementCreate['type']

export type Plat = Schemas['PlatResponse']
export type PlatComposant = Schemas['PlatComposantResponse']
export type PlatComposantCreate = Schemas['PlatComposantCreate']
export type PlatComposantUpdate = Schemas['PlatComposantUpdate']

export type Combinaison = Schemas['CombinaisonResponse']
export type CombinaisonCreate = Schemas['CombinaisonCreate']
export type CombinaisonUpdate = Schemas['CombinaisonUpdate']

export type ProcurementSuggestions = Schemas['ProcurementSuggestionResponse']
export type ProcurementItem = Schemas['ProcurementSuggestionItem']

/** Situation d'un composant par rapport à son seuil d'alerte. */
export type StockState = 'rupture' | 'alerte' | 'ok'

/** Une ligne du tableau de stock : le composant, son niveau et son état. */
export interface StockRow {
  composant: Composant
  stock: StockLevel
  state: StockState
}
