/** Periodos predefinidos para resúmenes y analítica (fechas locales 'YYYY-MM-DD'). */
import { addDays, addMonths, toISODate } from './format'

export type PeriodPreset = 'this_year' | 'last_12' | 'last_year' | 'last_30' | 'last_90' | 'custom'

export interface Period {
  from: string
  to: string
}

export const PERIOD_LABEL: Record<PeriodPreset, string> = {
  this_year: 'Este año',
  last_12: 'Últimos 12 meses',
  last_year: 'Año pasado',
  last_30: 'Últimos 30 días',
  last_90: 'Últimos 90 días',
  custom: 'Personalizado',
}

export function presetPeriod(preset: Exclude<PeriodPreset, 'custom'>, now: Date = new Date()): Period {
  const today = toISODate(now)
  switch (preset) {
    case 'this_year':
      return { from: `${now.getFullYear()}-01-01`, to: today }
    case 'last_year':
      return { from: `${now.getFullYear() - 1}-01-01`, to: `${now.getFullYear() - 1}-12-31` }
    case 'last_12': {
      const start = addMonths(new Date(now.getFullYear(), now.getMonth(), 1), -11)
      return { from: toISODate(start), to: today }
    }
    case 'last_30':
      return { from: toISODate(addDays(now, -29)), to: today }
    case 'last_90':
      return { from: toISODate(addDays(now, -89)), to: today }
  }
}
