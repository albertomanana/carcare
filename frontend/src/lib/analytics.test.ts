import { describe, expect, it } from 'vitest'
import type { WorkspaceAnalytics } from '@/api/types'
import { analyticsPeriod, currentMonthKey, expensesCount, ordersWithoutCustomer, parseAnalyticsPreset, peakMonth, shareOf } from './analytics'

describe('analítica: periodo', () => {
  it('acepta solo los periodos de la pantalla y por defecto usa los últimos 12 meses', () => {
    expect(parseAnalyticsPreset('this_year')).toBe('this_year')
    expect(parseAnalyticsPreset('last_year')).toBe('last_year')
    expect(parseAnalyticsPreset('last_30')).toBe('last_12')
    expect(parseAnalyticsPreset('')).toBe('last_12')
    expect(parseAnalyticsPreset(null)).toBe('last_12')
  })
  it('los últimos 12 meses empiezan el día 1 del mes de hace 11 meses (igual que la API por defecto)', () => {
    expect(analyticsPeriod('last_12', new Date(2026, 9, 23))).toEqual({ from: '2025-11-01', to: '2026-10-23' })
    expect(analyticsPeriod('last_year', new Date(2026, 9, 23))).toEqual({ from: '2025-01-01', to: '2025-12-31' })
  })
  it('currentMonthKey da YYYY-MM con cero a la izquierda', () => {
    expect(currentMonthKey(new Date(2026, 2, 5))).toBe('2026-03')
  })
})

describe('analítica: cifras derivadas de la API', () => {
  it('peakMonth elige el mes más alto y no inventa uno si todo está a 0', () => {
    expect(
      peakMonth([
        { month: '2026-01', total: '100.00' },
        { month: '2026-02', total: '835.20' },
        { month: '2026-03', total: '20.00' },
      ]),
    ).toEqual({ month: '2026-02', total: '835.20' })
    expect(peakMonth([{ month: '2026-01', total: '0.00' }])).toBeNull()
    expect(peakMonth([])).toBeNull()
  })
  it('expensesCount suma los recuentos por categoría', () => {
    const byCategory: WorkspaceAnalytics['by_category'] = [
      { category: 'fuel', total: '10.00', count: 57 },
      { category: 'tax', total: '5.00', count: 2 },
    ]
    expect(expensesCount(byCategory)).toBe(59)
    expect(expensesCount([])).toBe(0)
  })
  it('shareOf devuelve el porcentaje y null si el total es 0', () => {
    expect(shareOf('25.00', '100.00')).toBe(25)
    expect(shareOf('25.00', '0.00')).toBeNull()
  })
  it('ordersWithoutCustomer cuenta las entregadas que no salen en el reparto por cliente', () => {
    const workshop: NonNullable<WorkspaceAnalytics['workshop']> = {
      orders_delivered: 15,
      avg_ticket: '285.65',
      avg_days_in_shop: 1,
      by_customer: [
        { customer: { id: 1, name: 'A', phone: null }, total: '100.00', orders: 3 },
        { customer: { id: 2, name: 'B', phone: null }, total: '50.00', orders: 10 },
      ],
    }
    expect(ordersWithoutCustomer(workshop)).toBe(2)
    expect(ordersWithoutCustomer({ ...workshop, orders_delivered: 13 })).toBe(0)
  })
})
