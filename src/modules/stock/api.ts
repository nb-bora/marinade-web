import type {
  Combinaison,
  CombinaisonCreate,
  CombinaisonUpdate,
  Composant,
  ComposantCreate,
  ComposantUpdate,
  Plat,
  PlatComposant,
  PlatComposantCreate,
  PlatComposantUpdate,
  ProcurementSuggestions,
  StockLevel,
  StockMovementCreate,
} from './types'
import { container } from '@/container'
import type { HttpClient } from '@/lib/http/HttpClient'

const BASE = '/v1/restaurants'

/** Maximum accepté par le serveur : ces listes sont chargées en entier puis paginées en mémoire. */
const ALL = { skip: 0, limit: 500 }

/** Composants, stock, nomenclatures, combinaisons et approvisionnement du restaurant courant. */
export class StockApi {
  constructor(private readonly http: HttpClient) {}

  // Composants
  composants(restaurantId: string, signal?: AbortSignal) {
    return this.http.get<Composant[]>(`${BASE}/${restaurantId}/composants`, { signal, query: ALL })
  }

  createComposant(restaurantId: string, body: ComposantCreate) {
    return this.http.post<Composant>(`${BASE}/${restaurantId}/composants`, body)
  }

  updateComposant(id: string, body: ComposantUpdate) {
    return this.http.put<Composant>(`${BASE}/composants/${id}`, body)
  }

  // Stock
  stock(restaurantId: string, signal?: AbortSignal) {
    return this.http.get<StockLevel[]>(`${BASE}/${restaurantId}/stock`, { signal, query: ALL })
  }

  setThreshold(composantId: string, seuil: number) {
    return this.http.put<StockLevel>(`${BASE}/composants/${composantId}/stock/seuil`, { seuil_alerte: seuil })
  }

  addMovement(composantId: string, body: StockMovementCreate) {
    return this.http.post<StockLevel>(`${BASE}/composants/${composantId}/stock/mouvements`, body)
  }

  // Fiches techniques (nomenclatures)
  plats(restaurantId: string, signal?: AbortSignal) {
    return this.http.get<Plat[]>(`${BASE}/${restaurantId}/plats`, { signal, query: ALL })
  }

  recipe(platId: string, signal?: AbortSignal) {
    return this.http.get<PlatComposant[]>(`${BASE}/plats/${platId}/composants`, { signal })
  }

  addRecipeLine(platId: string, body: PlatComposantCreate) {
    return this.http.post<PlatComposant>(`${BASE}/plats/${platId}/composants`, body)
  }

  updateRecipeLine(platId: string, composantId: string, body: PlatComposantUpdate) {
    return this.http.put<PlatComposant>(`${BASE}/plats/${platId}/composants/${composantId}`, body)
  }

  removeRecipeLine(platId: string, composantId: string) {
    return this.http.delete<void>(`${BASE}/plats/${platId}/composants/${composantId}`)
  }

  replaceRecipe(platId: string, lines: PlatComposantCreate[]) {
    return this.http.put<PlatComposant[]>(`${BASE}/plats/${platId}/composants`, lines)
  }

  // Combinaisons
  combinaisons(restaurantId: string, signal?: AbortSignal) {
    return this.http.get<Combinaison[]>(`${BASE}/${restaurantId}/combinaisons`, { signal, query: ALL })
  }

  recommendations(restaurantId: string, signal?: AbortSignal) {
    return this.http.get<Combinaison[]>(`${BASE}/${restaurantId}/combinaisons/recommandations`, { signal, query: ALL })
  }

  createCombinaison(restaurantId: string, body: CombinaisonCreate) {
    return this.http.post<Combinaison>(`${BASE}/${restaurantId}/combinaisons`, body)
  }

  updateCombinaison(id: string, body: CombinaisonUpdate) {
    return this.http.put<Combinaison>(`${BASE}/combinaisons/${id}`, body)
  }

  // Approvisionnement
  procurement(restaurantId: string, signal?: AbortSignal) {
    return this.http.get<ProcurementSuggestions>(`/v1/ros/restaurants/${restaurantId}/procurement/suggestions`, { signal })
  }
}

export const stockApi = new StockApi(container.http)
