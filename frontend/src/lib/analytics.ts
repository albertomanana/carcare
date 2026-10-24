/**
 * Utilidades de la pantalla de Analítica. Solo ordenan, seleccionan o suman cifras que ya da la API
 * (GET /workspaces/{ws}/analytics y /vehicles/{v}/summary); no estiman nada.
 */
import type { Money, WorkspaceAnalytics, YearMonth } from '@/api/types'
import { toNumber } from './format'
import { type Period, presetPeriod } from './period'

export const ANALYTICS_PRESETS = ['last_12', 'this_year', 'last_year'] as const
export type AnalyticsPreset = (typeof ANALYTICS_PRESETS)[number]

export function parseAnalyticsPreset(value: string | null | undefined): AnalyticsPreset {
  return (ANALYTICS_PRESETS as readonly string[]).includes(value ?? '') ? (value as AnalyticsPreset) : 'last_12'
}

export function analyticsPeriod(preset: AnalyticsPreset, now: Date = new Date()): Period {
  return presetPeriod(preset, now)
}

/** Mes con el importe más alto del periodo; null si todos están a 0. Empate: el más reciente. */
export function peakMonth(byMonth: { month: YearMonth; total: Money }[]): { month: YearMonth; total: Money } | null {
  let best: { month: YearMonth; total: Money; value: number } | null = null
  for (const row of byMonth) {
    const value = toNumber(row.total) ?? 0
    if (value > 0 && (!best || value >= best.value)) best = { ...row, value }
  }
  return best ? { month: best.month, total: best.total } : null
}

/** Número de gastos del periodo (suma de los `count` por categoría que da la API). */
export function expensesCount(byCategory: WorkspaceAnalytics['by_category']): number {
  return byCategory.reduce((sum, c) => sum + c.count, 0)
}

/** Porcentaje (0–100) de `part` sobre `total`; null si el total es 0. */
export function shareOf(part: Money, total: Money): number | null {
  const t = toNumber(total) ?? 0
  if (t <= 0) return null
  return ((toNumber(part) ?? 0) / t) * 100
}

/**
 * Órdenes entregadas que no aparecen en el reparto por cliente (órdenes sin cliente).
 * El contrato solo incluye en `by_customer` las órdenes con cliente.
 */
export function ordersWithoutCustomer(workshop: NonNullable<WorkspaceAnalytics['workshop']>): number {
  const withCustomer = workshop.by_customer.reduce((sum, c) => sum + c.orders, 0)
  return Math.max(0, workshop.orders_delivered - withCustomer)
}

/** 'YYYY-MM' del mes en curso (para resaltar su barra si está en el gráfico). */
export function currentMonthKey(now: Date = new Date()): YearMonth {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}
