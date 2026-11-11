/**
 * "Primeros pasos" (E5‑7, tarea 26; rehecho el 10/11/2026 para que se entienda a la primera): una guía de 3 pasos
 * con **una sola acción a la vista** (la del paso que toca), el progreso ("Paso 2 de 3") y por qué importa cada paso.
 * Todo sale de lo que ya trae la API, sin otra petición. Cada función devuelve la lista completa con lo hecho y lo
 * pendiente, o `null` si la guía ya no tiene sentido (cuenta con historial, o todo hecho).
 */
import type { PersonalDashboard, Vehicle, VehicleSummary, WorkshopDashboard } from '@/api/types'

export type FirstStepKey = 'vehicle' | 'km' | 'fuel' | 'record' | 'reminder' | 'bays' | 'customer' | 'order'

export interface FirstStepState {
  key: FirstStepKey
  done: boolean
}

/** El paso que toca: el primero sin hacer. */
export function currentStep(steps: FirstStepState[]): FirstStepState | null {
  return steps.find((s) => !s.done) ?? null
}

function guide(steps: FirstStepState[]): FirstStepState[] | null {
  return steps.every((s) => s.done) ? null : steps
}

/**
 * Inicio del particular: añadir el coche → anotar sus km → crear el primer recordatorio. Solo mientras ningún
 * vehículo tiene intervenciones (alguien con historial no es nuevo, aunque le falte algo). Se refiere al primer
 * vehículo activo de la lista.
 */
export function dashboardFirstSteps(data: Pick<PersonalDashboard, 'vehicles'> | null): { vehicle: Vehicle | null; steps: FirstStepState[] } | null {
  const vehicles = data?.vehicles ?? []
  if (vehicles.some((v) => v.stats.records_count > 0)) return null
  const vehicle = vehicles.find((v) => !v.archived_at) ?? null
  const steps = guide([
    { key: 'vehicle', done: vehicle !== null },
    { key: 'km', done: vehicle !== null && vehicle.current_mileage !== null },
    { key: 'reminder', done: vehicles.some((v) => v.stats.pending_reminders > 0) },
  ])
  return steps ? { vehicle, steps } : null
}

/**
 * Resumen de la ficha de un vehículo sin intervenciones: anotar km → la última intervención o un recordatorio (lo
 * mismo que toca en Inicio) → primer repostaje, si el usuario puede ver gastos. Lista vacía ⇒ no hay guía.
 */
export function vehicleFirstSteps(
  vehicle: Pick<Vehicle, 'current_mileage' | 'stats'>,
  s: Pick<VehicleSummary, 'records' | 'mileage' | 'consumption' | 'by_category' | 'reminders'>,
  canExpenses: boolean,
): FirstStepState[] {
  if (s.records.count > 0 || vehicle.stats.records_count > 0) return []
  const fuel = s.consumption.fills > 0 || s.by_category.some((c) => c.category === 'fuel' && c.count > 0)
  const steps: FirstStepState[] = [
    { key: 'km', done: vehicle.current_mileage !== null || s.mileage.current !== null },
    { key: 'record', done: vehicle.stats.pending_reminders > 0 || s.reminders.upcoming.length > 0 },
    ...(canExpenses ? [{ key: 'fuel' as const, done: fuel }] : []),
  ]
  return guide(steps) ?? []
}

/**
 * Inicio de un taller recién creado: elevadores → primer cliente → primera orden. Desaparece en cuanto hay una orden
 * (de cualquier estado). Los elevadores no tienen "hecho" en la API (siempre hay un número): cuentan como revisados si
 * el usuario lo confirma (`baysConfirmed`, guardado en el navegador) o si ya ha dado de alta un cliente.
 */
export function workshopFirstSteps(data: Pick<WorkshopDashboard, 'counts' | 'orders_by_status'>, baysConfirmed: boolean): FirstStepState[] | null {
  const orders = Object.values(data.orders_by_status).reduce((sum, n) => sum + n, 0)
  if (orders > 0) return null
  return guide([
    { key: 'bays', done: baysConfirmed || data.counts.customers > 0 },
    { key: 'customer', done: data.counts.customers > 0 },
    { key: 'order', done: false },
  ])
}
