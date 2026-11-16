/**
 * Relaciones de un gasto (contrato §3.6.1): periodicidad con su renovación, y el origen de un gasto vinculado
 * (intervención propia u orden de taller entregada). Lógica pura: se prueba con Vitest.
 */
import type { Expense, ExpenseCategory, ExpenseOrigin, ISODate, MaintenanceRecord, RecordType } from '@/api/types'
import { addMonths, formatDate, formatMoney, parseISODate, toISODate, toNumber } from './format'

/** Categorías que se repiten y tienen renovación. */
export const RECURRING_CATEGORIES: ExpenseCategory[] = ['insurance', 'tax', 'parking', 'other']
/** Categorías que pueden asociarse a una intervención o crearla en el mismo paso. */
export const RECORD_CATEGORIES: ExpenseCategory[] = ['maintenance', 'repair', 'modification', 'inspection']

export const RECURRENCE_OPTIONS = [
  { months: 1, label: 'Mensual' },
  { months: 3, label: 'Trimestral' },
  { months: 6, label: 'Semestral' },
  { months: 12, label: 'Anual' },
] as const

export const isRecurringCategory = (c: ExpenseCategory) => RECURRING_CATEGORIES.includes(c)
export const allowsRecord = (c: ExpenseCategory) => RECORD_CATEGORIES.includes(c)

export function recurrenceLabel(months: number | null | undefined): string | null {
  if (!months) return null
  return RECURRENCE_OPTIONS.find((o) => o.months === months)?.label ?? `Cada ${months} meses`
}

/** Próxima renovación por defecto: la fecha del gasto más la periodicidad (31 ene + 1 mes = 28 feb). */
export function defaultRenewal(date: ISODate, months: number): ISODate | '' {
  const d = parseISODate(date)
  return Number.isNaN(d.getTime()) ? '' : toISODate(addMonths(d, months))
}

/** «Anual · renueva el 28 nov 2027». Sin recordatorio pendiente solo dice la periodicidad. */
export function renewalText(e: Pick<Expense, 'recurrence_months' | 'renewal'>): string | null {
  const label = recurrenceLabel(e.recurrence_months)
  if (!label) return null
  const r = e.renewal
  return r && r.status === 'pending' && r.due_date ? `${label} · renueva el ${formatDate(r.due_date)}` : label
}

/** Tipo de la intervención que se crea desde un gasto de esa categoría (igual que el servidor). */
export function recordTypeFor(category: ExpenseCategory): RecordType {
  if (category === 'repair') return 'repair'
  if (category === 'modification') return 'modification'
  if (category === 'inspection') return 'inspection'
  return 'maintenance'
}

/** Intervenciones a las que se puede asociar un gasto: activas y todavía sin coste. */
export function costlessRecords(records: readonly MaintenanceRecord[]): MaintenanceRecord[] {
  return records.filter((r) => !r.archived_at && (toNumber(r.total_cost) ?? 0) <= 0)
}

/** De dónde viene un gasto vinculado: «Orden OT-2026-0036 · Taller Demo» o «Intervención · Taller Sur». */
export function originLabel(o: ExpenseOrigin): string {
  const head = o.work_order_number ? `Orden ${o.work_order_number}` : 'Intervención'
  return o.workshop_name ? `${head} · ${o.workshop_name}` : head
}

/** Desglose del importe si la intervención lo tiene: «Piezas 80,00 € · Mano de obra 40,00 € · IVA 25,20 €». */
export function originBreakdown(o: ExpenseOrigin): string | null {
  const parts = [
    (toNumber(o.parts_cost) ?? 0) > 0 ? `Piezas ${formatMoney(o.parts_cost)}` : null,
    (toNumber(o.labor_cost) ?? 0) > 0 ? `Mano de obra ${formatMoney(o.labor_cost)}` : null,
    (toNumber(o.tax_amount) ?? 0) > 0 ? `IVA ${formatMoney(o.tax_amount)}` : null,
  ].filter(Boolean)
  return parts.length ? parts.join(' · ') : null
}

export type ExpenseGroup = 'workshop' | 'recurring' | 'modification' | 'fuel' | 'other'

export const EXPENSE_GROUP_LABEL: Record<ExpenseGroup, string> = {
  workshop: 'Taller y órdenes',
  recurring: 'Periódicos (seguro, impuestos, cuotas)',
  modification: 'Modificaciones',
  fuel: 'Combustible',
  other: 'Resto',
}

/**
 * Grupo de un gasto para el detalle del mes. «Taller» son las reparaciones, mantenimientos e inspecciones (vengan de una
 * orden de taller o de una intervención propia); «periódico», lo marcado con periodicidad.
 */
export function expenseGroup(e: Pick<Expense, 'category' | 'recurrence_months'>): ExpenseGroup {
  if (e.category === 'fuel') return 'fuel'
  if (e.category === 'modification') return 'modification'
  if (e.recurrence_months) return 'recurring'
  if (e.category === 'repair' || e.category === 'maintenance' || e.category === 'inspection') return 'workshop'
  return 'other'
}

/** Totales por grupo, de mayor a menor, en céntimos enteros (sin errores de coma flotante). */
export function groupTotals(expenses: readonly Pick<Expense, 'category' | 'recurrence_months' | 'amount'>[]): { group: ExpenseGroup; cents: number; count: number }[] {
  const acc = new Map<ExpenseGroup, { cents: number; count: number }>()
  for (const e of expenses) {
    const g = expenseGroup(e)
    const row = acc.get(g) ?? { cents: 0, count: 0 }
    row.cents += Math.round((toNumber(e.amount) ?? 0) * 100)
    row.count += 1
    acc.set(g, row)
  }
  return [...acc.entries()].map(([group, v]) => ({ group, ...v })).sort((a, b) => b.cents - a.cents)
}
