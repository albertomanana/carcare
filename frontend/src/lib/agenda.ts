/**
 * Utilidades de la agenda: rejilla del calendario mensual (semana de lunes a domingo, es-ES)
 * y cálculo de «posponer» a partir de los datos que da la API (due_date, due_mileage, km_left).
 */
import type { ISODate, Reminder, ReminderState } from '@/api/types'
import { addDays, addMonths, parseISODate, toISODate, todayISO } from './format'

// ───────── Mes 'YYYY-MM' ─────────

export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

/** 'YYYY-MM' válido → Date del día 1 (null si no es válido). */
export function parseMonthKey(value: string | null | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return null
  const [y, m] = value.split('-').map(Number)
  if (m < 1 || m > 12 || y < 1900 || y > 2200) return null
  return new Date(y, m - 1, 1)
}

export function shiftMonth(key: string, delta: number): string {
  const d = parseMonthKey(key) ?? new Date()
  return monthKey(addMonths(new Date(d.getFullYear(), d.getMonth(), 1), delta))
}

export interface CalendarDay {
  date: ISODate
  day: number
  inMonth: boolean
  isToday: boolean
  /** 0 = lunes … 6 = domingo. */
  weekday: number
}

/** Día de la semana con el lunes como 0. */
export function mondayIndex(date: Date): number {
  return (date.getDay() + 6) % 7
}

/**
 * Semanas (lunes→domingo) que cubren el mes, con los días de relleno de los meses vecinos.
 * Siempre semanas completas: entre 4 y 6 filas.
 */
export function monthGrid(key: string, today: ISODate = todayISO()): CalendarDay[][] {
  const first = parseMonthKey(key) ?? new Date()
  const start = addDays(first, -mondayIndex(first))
  const lastOfMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0)
  const end = addDays(lastOfMonth, 6 - mondayIndex(lastOfMonth))
  const weeks: CalendarDay[][] = []
  for (let cursor = start; cursor <= end; ) {
    const week: CalendarDay[] = []
    for (let i = 0; i < 7; i++) {
      const iso = toISODate(cursor)
      week.push({ date: iso, day: cursor.getDate(), inMonth: cursor.getMonth() === first.getMonth(), isToday: iso === today, weekday: i })
      cursor = addDays(cursor, 1)
    }
    weeks.push(week)
  }
  return weeks
}

/** Agrupa por due_date (los que solo vencen por km no tienen día en el calendario). */
export function groupByDueDate<T extends Pick<Reminder, 'due_date'>>(reminders: T[]): Map<ISODate, T[]> {
  const map = new Map<ISODate, T[]>()
  for (const r of reminders) {
    if (!r.due_date) continue
    const list = map.get(r.due_date)
    if (list) list.push(r)
    else map.set(r.due_date, [r])
  }
  return map
}

/** Peor estado de una lista (overdue > soon > ok > unknown). */
export function worstState(reminders: Pick<Reminder, 'state'>[]): ReminderState | null {
  const order: ReminderState[] = ['overdue', 'soon', 'ok', 'unknown']
  let best: number | null = null
  for (const r of reminders) {
    if (!r.state) continue
    const i = order.indexOf(r.state)
    if (best === null || i < best) best = i
  }
  return best === null ? null : order[best]
}

/** Primer vencimiento por fecha a partir de un día (para «Siguiente vencimiento»). */
export function nextDueDate(reminders: Pick<Reminder, 'due_date'>[], from: ISODate): ISODate | null {
  let found: ISODate | null = null
  for (const r of reminders) {
    if (r.due_date && r.due_date >= from && (found === null || r.due_date < found)) found = r.due_date
  }
  return found
}

// ───────── Posponer ─────────

/** Km actuales del vehículo deducidos de la API: due_mileage − km_left (null si falta alguno). */
export function currentMileageOf(reminder: Pick<Reminder, 'due_mileage' | 'km_left'>): number | null {
  if (reminder.due_mileage === null || reminder.km_left === null) return null
  return reminder.due_mileage - reminder.km_left
}

/** Fecha desde la que se pospone: la de vencimiento o hoy si ya pasó (posponer un vencido parte de hoy). */
export function postponeDateBase(reminder: Pick<Reminder, 'due_date'>, today: ISODate = todayISO()): ISODate | null {
  if (!reminder.due_date) return null
  return reminder.due_date > today ? reminder.due_date : today
}

export function postponeDate(base: ISODate, amount: { days?: number; months?: number }): ISODate {
  let d = parseISODate(base)
  if (amount.months) d = addMonths(d, amount.months)
  if (amount.days) d = addDays(d, amount.days)
  return toISODate(d)
}

/** Km desde los que se pospone: el límite o los km actuales si ya se superó. */
export function postponeMileageBase(reminder: Pick<Reminder, 'due_mileage' | 'km_left'>): number | null {
  if (reminder.due_mileage === null) return null
  const current = currentMileageOf(reminder)
  return current !== null && current > reminder.due_mileage ? current : reminder.due_mileage
}
