import type { MachineCategory } from '../types'

/** Point du plan : en pourcentage (0–100) ou en unités du SVG, selon l'appelant. */
export interface PlanPoint {
  x: number
  y: number
}

export interface PlanWorld {
  width: number
  height: number
}

/** Rectangle en pourcentage du plan (une zone). */
export interface PlanRect {
  x: number
  y: number
  w: number
  h: number
}

/** Le plan est dessiné dans un repère de 160 × 90 unités (16/9) ; en compact (téléphone), 100 × 75 (4/3). */
export const WIDE_WORLD: PlanWorld = { width: 160, height: 90 }
export const COMPACT_WORLD: PlanWorld = { width: 100, height: 75 }

/** Pas de la grille magnétique, en unités du plan. */
export const SNAP_UNITS = 4

export const MIN_ZONE_W = 8
export const MIN_ZONE_H = 10

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export const round2 = (value: number) => Math.round(value * 100) / 100

/** Diamètre (ou côté) d'une machine, en unités : un peu plus grand pour une grande capacité. */
export function machineDiameter(capacityKg: number, compact: boolean): number {
  const base = 9 + clamp(Number.isFinite(capacityKg) ? capacityKg : 8, 0, 30) / 30 * 5

  return compact ? base * 1.25 : base
}

/** Aligne `value` (en pourcentage) sur la grille magnétique de l'axe de longueur `axis` unités. */
export function snapPercent(value: number, axis: number, enabled: boolean): number {
  if (!enabled)
    return round2(value)

  return round2(Math.round(value / 100 * axis / SNAP_UNITS) * SNAP_UNITS / axis * 100)
}

/** Position en pourcentage tenant dans le plan pour une machine de diamètre `diameter`. */
export function clampMachine(point: PlanPoint, diameter: number, world: PlanWorld): PlanPoint {
  const marginX = diameter / 2 / world.width * 100 + 0.8
  const marginY = diameter / 2 / world.height * 100 + 0.8

  return {
    x: round2(clamp(point.x, marginX, 100 - marginX)),
    y: round2(clamp(point.y, marginY, 100 - marginY)),
  }
}

export function clampZone(rect: PlanRect): PlanRect {
  const w = clamp(rect.w, MIN_ZONE_W, 100)
  const h = clamp(rect.h, MIN_ZONE_H, 100)

  return {
    w: round2(w),
    h: round2(h),
    x: round2(clamp(rect.x, 0, 100 - w)),
    y: round2(clamp(rect.y, 0, 100 - h)),
  }
}

/** Zone qui contient le point (la plus petite si plusieurs se recouvrent), ou `null`. */
export function zoneAt<T extends PlanRect & { id: string }>(point: PlanPoint, zones: T[]): T | null {
  const hits = zones.filter(zone => point.x >= zone.x && point.x <= zone.x + zone.w && point.y >= zone.y && point.y <= zone.y + zone.h)

  return hits.sort((a, b) => a.w * a.h - b.w * b.h)[0] ?? null
}

/**
 * Emplacements de repli pour les machines qui n'ont pas encore de position : une grille régulière
 * sous le bandeau du plan, en pourcentages. Rien n'est enregistré tant que l'on ne les déplace pas.
 */
export function autoSlots(count: number, aspect: number): PlanPoint[] {
  const cols = Math.max(1, Math.ceil(Math.sqrt(count * aspect)))
  const rows = Math.max(1, Math.ceil(count / cols))
  const slots: PlanPoint[] = []

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      slots.push({
        x: round2(8 + ((col + 0.5) / cols) * 84),
        y: round2(14 + ((row + 0.5) / rows) * 74),
      })
    }
  }

  return slots
}

export const isRound = (category: MachineCategory) => category === 'lave_linge'
