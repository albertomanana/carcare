import { describe, expect, it } from 'vitest'
import type { PersonalDashboard, Vehicle, VehicleSummary, WorkshopDashboard } from '@/api/types'
import { currentStep, dashboardFirstSteps, vehicleFirstSteps, workshopFirstSteps } from './firstSteps'

const stats = (over: Partial<Vehicle['stats']> = {}): Vehicle['stats'] => ({
  records_count: 0,
  pending_reminders: 0,
  overdue_reminders: 0,
  soon_reminders: 0,
  open_work_order: null,
  ...over,
})

type S = Pick<VehicleSummary, 'records' | 'mileage' | 'consumption' | 'by_category' | 'reminders'>
const summary = (over: Partial<S> = {}): S => ({
  records: { count: 0, last: null, recent: [] },
  mileage: { current: null, updated_at: null, km_this_month: null, km_this_year: null, avg_daily_km: null, series: [] },
  consumption: { available: false, reason: 'x', value: null, unit: null, fills: 0 },
  by_category: [],
  reminders: { overdue: 0, soon: 0, upcoming: [] },
  ...over,
})

const pending = (steps: { key: string; done: boolean }[]) => steps.filter((s) => !s.done).map((s) => s.key)

describe('vehicleFirstSteps', () => {
  it('vehículo vacío: los tres pasos, ninguno hecho', () => {
    expect(pending(vehicleFirstSteps({ current_mileage: null, stats: stats() }, summary(), true))).toEqual(['km', 'record', 'fuel'])
  })

  it('sin permiso de gastos no pide el repostaje', () => {
    expect(vehicleFirstSteps({ current_mileage: null, stats: stats() }, summary(), false).map((s) => s.key)).toEqual(['km', 'record'])
  })

  it('cada paso se marca como hecho y la guía se va al completarlos', () => {
    const withKm = { current_mileage: 1200, stats: stats() }
    const steps = vehicleFirstSteps(withKm, summary(), true)
    expect(steps).toHaveLength(3)
    expect(currentStep(steps)?.key).toBe('record')
    const fuel = summary({ by_category: [{ category: 'fuel', total: '50.00', count: 1 }] })
    expect(pending(vehicleFirstSteps(withKm, fuel, true))).toEqual(['record'])
    expect(vehicleFirstSteps({ current_mileage: 1200, stats: stats({ pending_reminders: 1 }) }, fuel, true)).toEqual([])
  })

  it('con intervenciones no hay guía', () => {
    expect(vehicleFirstSteps({ current_mileage: null, stats: stats({ records_count: 2 }) }, summary(), true)).toEqual([])
  })
})

describe('dashboardFirstSteps', () => {
  const vehicle = (over: Partial<Vehicle> = {}) => ({ id: 1, current_mileage: null, archived_at: null, stats: stats(), ...over }) as Vehicle
  const data = (vehicles: Vehicle[]): Pick<PersonalDashboard, 'vehicles'> => ({ vehicles })

  it('sin vehículos: el paso 1 es añadir el coche', () => {
    const g = dashboardFirstSteps(data([]))
    expect(g?.vehicle).toBeNull()
    expect(g && currentStep(g.steps)?.key).toBe('vehicle')
    expect(dashboardFirstSteps(null)?.steps.map((s) => s.key)).toEqual(['vehicle', 'km', 'reminder'])
  })

  it('con el coche dado de alta: toca anotar km; si ya los tiene, el recordatorio', () => {
    expect(pending(dashboardFirstSteps(data([vehicle()]))!.steps)).toEqual(['km', 'reminder'])
    expect(pending(dashboardFirstSteps(data([vehicle({ current_mileage: 5000 })]))!.steps)).toEqual(['reminder'])
  })

  it('desaparece con el primer recordatorio o si algún vehículo tiene historial', () => {
    expect(dashboardFirstSteps(data([vehicle({ current_mileage: 5000, stats: stats({ pending_reminders: 1 }) })]))).toBeNull()
    expect(dashboardFirstSteps(data([vehicle(), vehicle({ id: 2, stats: stats({ records_count: 1 }) })]))).toBeNull()
  })

  it('se refiere al primer vehículo no archivado', () => {
    const g = dashboardFirstSteps(data([vehicle({ id: 7, archived_at: '2026-01-01T00:00:00Z' }), vehicle({ id: 8, current_mileage: 10 })]))
    expect(g?.vehicle?.id).toBe(8)
  })
})

describe('workshopFirstSteps', () => {
  const byStatus = (n = 0): WorkshopDashboard['orders_by_status'] => ({ received: n, diagnosing: 0, waiting_parts: 0, in_progress: 0, ready: 0, delivered: 0, cancelled: 0 })
  const counts = (customers = 0) => ({ vehicles: 0, customers, open_orders: 0, late_orders: 0, overdue_reminders: 0 })

  it('taller nuevo: elevadores, cliente y orden por ese orden', () => {
    const steps = workshopFirstSteps({ counts: counts(), orders_by_status: byStatus() }, false)!
    expect(steps.map((s) => s.key)).toEqual(['bays', 'customer', 'order'])
    expect(currentStep(steps)?.key).toBe('bays')
  })

  it('confirmar los elevadores o tener un cliente pasa al siguiente paso', () => {
    expect(currentStep(workshopFirstSteps({ counts: counts(), orders_by_status: byStatus() }, true)!)?.key).toBe('customer')
    expect(currentStep(workshopFirstSteps({ counts: counts(2), orders_by_status: byStatus() }, false)!)?.key).toBe('order')
  })

  it('con alguna orden ya no hay guía', () => {
    expect(workshopFirstSteps({ counts: counts(1), orders_by_status: byStatus(1) }, true)).toBeNull()
  })
})
