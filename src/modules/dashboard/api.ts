import type { RestaurantDashboard } from './types'
import { container } from '@/container'
import type { HttpClient } from '@/lib/http/HttpClient'

export class DashboardApi {
  constructor(private readonly http: HttpClient) {}

  restaurant(restaurantId: string, signal?: AbortSignal) {
    return this.http.get<RestaurantDashboard>(`/v1/ros/restaurants/${restaurantId}/dashboard`, { signal })
  }
}

export const dashboardApi = new DashboardApi(container.http)
