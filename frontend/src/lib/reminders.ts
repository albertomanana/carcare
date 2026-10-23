/** Textos de vencimiento de recordatorios: siempre derivados de days_left / km_left de la API. */
import type { Reminder } from '@/api/types'
import { formatDate, formatDays, formatKm } from './format'

export interface DueParts {
  /** 'Vence el 12 mar 2027' · 'A los 99.200 km'. */
  label: string
  /** 'faltan 23 días' · 'venció hace 4 días' · 'superado por 300 km'. */
  relative: string | null
  overdue: boolean
}

export function dueByDate(reminder: Pick<Reminder, 'due_date' | 'days_left' | 'status'>): DueParts | null {
  if (!reminder.due_date) return null
  const d = reminder.days_left
  let relative: string | null = null
  if (reminder.status === 'pending' && d !== null) {
    if (d < 0) relative = `venció hace ${formatDays(d)}`
    else if (d === 0) relative = 'vence hoy'
    else if (d === 1) relative = 'vence mañana'
    else relative = `faltan ${formatDays(d)}`
  }
  return { label: `El ${formatDate(reminder.due_date)}`, relative, overdue: d !== null && d < 0 }
}

export function dueByMileage(reminder: Pick<Reminder, 'due_mileage' | 'km_left' | 'status'>): DueParts | null {
  if (reminder.due_mileage === null) return null
  const k = reminder.km_left
  let relative: string | null = null
  if (reminder.status === 'pending') {
    if (k === null) relative = 'sin kilometraje del vehículo'
    else if (k < 0) relative = `superado por ${formatKm(Math.abs(k))}`
    else relative = `faltan ${formatKm(k)}`
  }
  return { label: `A los ${formatKm(reminder.due_mileage)}`, relative, overdue: k !== null && k < 0 }
}

/** Resumen de una línea: 'Faltan 23 días · faltan 1.200 km'. */
export function dueSummary(reminder: Reminder): string {
  const parts = [dueByDate(reminder), dueByMileage(reminder)].filter((p): p is DueParts => p !== null)
  if (!parts.length) return 'Sin vencimiento'
  return parts.map((p) => (p.relative ? `${p.label} (${p.relative})` : p.label)).join(' o ')
}

export function recurrenceText(reminder: Pick<Reminder, 'recurrence_months' | 'recurrence_km'>): string | null {
  const parts: string[] = []
  if (reminder.recurrence_months) parts.push(reminder.recurrence_months === 1 ? 'cada mes' : `cada ${reminder.recurrence_months} meses`)
  if (reminder.recurrence_km) parts.push(`cada ${formatKm(reminder.recurrence_km)}`)
  return parts.length ? `Se repite ${parts.join(' o ')}` : null
}

/** Texto honesto para la barra de progreso de un recordatorio. */
export const INTERVAL_DISCLAIMER = 'Según tus intervalos, no medido'
