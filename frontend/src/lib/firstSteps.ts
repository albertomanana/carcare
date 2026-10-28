/**
 * "Primeros pasos" de un vehículo sin datos (E5‑7, tarea 26). Solo con lo que ya trae la API, sin otra petición.
 *
 * La guía sale mientras el vehículo no tiene intervenciones: un coche con historial no es nuevo, aunque le falte algo.
 * Cada paso desaparece al hacerlo:
 *  - `km`: hay kilometraje (también vale el que se puso al darlo de alta);
 *  - `fuel` (solo si el usuario puede ver gastos): hay algún repostaje;
 *  - `record`: hay una intervención o un recordatorio pendiente.
 */
import type { PersonalDashboard, Vehicle, VehicleSummary } from '@/api/types'
import { toNumber } from './format'

export type FirstStepKey = 'km' | 'fuel' | 'record'

/** Pasos que faltan en el Resumen de la ficha. Lista vacía ⇒ no hay guía. */
export function vehicleFirstSteps(
  vehicle: Pick<Vehicle, 'current_mileage' | 'stats'>,
  s: Pick<VehicleSummary, 'records' | 'mileage' | 'consumption' | 'by_category' | 'reminders'>,
  canExpenses: boolean,
): FirstStepKey[] {
  if (s.records.count > 0 || vehicle.stats.records_count > 0) return []
  const steps: FirstStepKey[] = []
  if (vehicle.current_mileage === null && s.mileage.current === null) steps.push('km')
  const fuel = s.consumption.fills > 0 || s.by_category.some((c) => c.category === 'fuel' && c.count > 0)
  if (canExpenses && !fuel) steps.push('fuel')
  if (vehicle.stats.pending_reminders === 0 && s.reminders.upcoming.length === 0) steps.push('record')
  return steps
}

/**
 * Guía en Inicio: solo mientras **ningún** vehículo tiene intervenciones ni recordatorios (alguien que acaba de
 * empezar). Se refiere al primer vehículo de la lista. Inicio no pide el resumen de cada vehículo, así que el paso del
 * repostaje se da por hecho cuando hay cualquier gasto en los últimos 12 meses.
 */
export function dashboardFirstSteps(data: Pick<PersonalDashboard, 'vehicles' | 'spend'>, canExpenses: boolean): { vehicle: Vehicle; steps: FirstStepKey[] } | null {
  if (!data.vehicles.length) return null
  const fresh = data.vehicles.every((v) => v.stats.records_count === 0 && v.stats.pending_reminders === 0)
  if (!fresh) return null
  const vehicle = data.vehicles[0]
  const anySpend = (toNumber(data.spend.year) ?? 0) > 0 || data.spend.by_month.some((m) => (toNumber(m.total) ?? 0) > 0)
  const steps: FirstStepKey[] = []
  if (vehicle.current_mileage === null) steps.push('km')
  if (canExpenses && !anySpend) steps.push('fuel')
  steps.push('record')
  return { vehicle, steps }
}
