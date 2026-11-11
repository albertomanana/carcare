/**
 * «Misiones» del particular: avisos que salen de datos reales de la API (regla 2: ni puntos, ni niveles, ni logros).
 * Aquí solo la de kilometraje: un vehículo activo sin ninguna lectura, o con la última lectura de hace más de
 * `STALE_MILEAGE_DAYS` días. El umbral es de la interfaz (cuándo recordarlo), no un dato del vehículo.
 */
import type { Vehicle } from '@/api/types'
import { daysBetween, parseISODate } from './format'

export const STALE_MILEAGE_DAYS = 30

export interface MileageMission {
  vehicle: Vehicle
  /** `none`: nunca se ha anotado; `stale`: la última lectura es antigua. */
  kind: 'none' | 'stale'
  /** Días desde la última lectura (solo `stale`). */
  days: number | null
}

/** Vehículos activos cuyo kilometraje conviene actualizar, los más antiguos primero. */
export function mileageMissions(vehicles: Vehicle[], now: Date = new Date()): MileageMission[] {
  const out: MileageMission[] = []
  for (const vehicle of vehicles) {
    if (vehicle.archived_at) continue
    if (vehicle.current_mileage === null || !vehicle.mileage_updated_at) {
      out.push({ vehicle, kind: 'none', days: null })
      continue
    }
    const days = daysBetween(parseISODate(vehicle.mileage_updated_at), now)
    if (days >= STALE_MILEAGE_DAYS) out.push({ vehicle, kind: 'stale', days })
  }
  return out.sort((a, b) => (b.days ?? Infinity) - (a.days ?? Infinity))
}
