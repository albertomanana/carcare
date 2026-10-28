import { describe, expect, it } from 'vitest'
import type { PersonalDashboard, Vehicle, VehicleSummary } from '@/api/types'
import { dashboardFirstSteps, vehicleFirstSteps } from './firstSteps'

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

describe('vehicleFirstSteps', () => {
  it('vehículo vacío: los tres pasos', () => {
    expect(vehicleFirstSteps({ current_mileage: null, stats: stats() }, summary(), true)).toEqual(['km', 'fuel', 'record'])
  })

  it('sin permiso de gastos no pide el repostaje', () => {
    expect(vehicleFirstSteps({ current_mileage: null, stats: stats() }, summary(), false)).toEqual(['km', 'record'])
  })

  it('cada paso desaparece al hacerlo', () => {
    const withKm = { current_mileage: 1200, stats: stats() }
    expect(vehicleFirstSteps(withKm, summary(), true)).toEqual(['fuel', 'record'])
    const fuel = summary({ by_category: [{ category: 'fuel', total: '50.00', count: 1 }] })
    expect(vehicleFirstSteps(withKm, fuel, true)).toEqual(['record'])
    expect(vehicleFirstSteps({ current_mileage: 1200, stats: stats({ pending_reminders: 1 }) }, fuel, true)).toEqual([])
  })

  it('con intervenciones no hay guía', () => {
    expect(vehicleFirstSteps({ current_mileage: null, stats: stats({ records_count: 2 }) }, summary(), true)).toEqual([])
  })
})

describe('dashboardFirstSteps', () => {
  const vehicle = (over: Partial<Vehicle> = {}) => ({ id: 1, current_mileage: null, stats: stats(), ...over }) as Vehicle
  const spend = (year = '0.00'): PersonalDashboard['spend'] => ({ month: '0.00', year, by_month: [] })

  it('solo mientras ningún vehículo tiene historial ni recordatorios', () => {
    expect(dashboardFirstSteps({ vehicles: [vehicle()], spend: spend() }, true)?.steps).toEqual(['km', 'fuel', 'record'])
    expect(dashboardFirstSteps({ vehicles: [vehicle(), vehicle({ id: 2, stats: stats({ records_count: 1 }) })], spend: spend() }, true)).toBeNull()
    expect(dashboardFirstSteps({ vehicles: [], spend: spend() }, true)).toBeNull()
  })

  it('quita el km y el repostaje cuando ya están', () => {
    expect(dashboardFirstSteps({ vehicles: [vehicle({ current_mileage: 5000 })], spend: spend('40.00') }, true)?.steps).toEqual(['record'])
  })
})
