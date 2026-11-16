import { describe, expect, it } from 'vitest'
import type { Expense, ExpenseOrigin, MaintenanceRecord } from '@/api/types'
import { allowsRecord, costlessRecords, defaultRenewal, expenseGroup, groupTotals, isRecurringCategory, originBreakdown, originLabel, recordTypeFor, recurrenceLabel, renewalText } from './expenseLinks'

const origin = (o: Partial<ExpenseOrigin> = {}): ExpenseOrigin => ({
  record_id: 9,
  title: 'Ruido al frenar',
  type: 'repair',
  workshop_name: 'Taller Demo',
  parts_cost: '80.00',
  labor_cost: '40.00',
  tax_amount: '25.20',
  work_order_number: 'OT-2026-0036',
  repair_request_id: 3,
  ...o,
})

describe('periodicidad', () => {
  it('solo seguro, impuestos, aparcamiento y otros son periódicos', () => {
    expect(['insurance', 'tax', 'parking', 'other'].every((c) => isRecurringCategory(c as Expense['category']))).toBe(true)
    expect(isRecurringCategory('fuel')).toBe(false)
    expect(isRecurringCategory('repair')).toBe(false)
  })

  it('nombra la periodicidad y calcula la renovación sin saltarse el fin de mes', () => {
    expect(recurrenceLabel(12)).toBe('Anual')
    expect(recurrenceLabel(1)).toBe('Mensual')
    expect(recurrenceLabel(null)).toBeNull()
    expect(defaultRenewal('2026-11-15', 12)).toBe('2027-11-15')
    expect(defaultRenewal('2026-01-31', 1)).toBe('2026-02-28')
    expect(defaultRenewal('', 6)).toBe('')
  })

  it('dice cuándo renueva solo si hay un recordatorio pendiente', () => {
    const renewal = { reminder_id: 4, title: 'Renovar el seguro', due_date: '2027-11-28', status: 'pending' as const }
    expect(renewalText({ recurrence_months: 12, renewal })).toMatch(/^Anual · renueva el 28 nov\.? 2027$/)
    expect(renewalText({ recurrence_months: 12, renewal: { ...renewal, status: 'done' } })).toBe('Anual')
    expect(renewalText({ recurrence_months: 6, renewal: null })).toBe('Semestral')
    expect(renewalText({ recurrence_months: null, renewal: null })).toBeNull()
  })
})

describe('gasto e intervención', () => {
  it('las categorías de taller pueden asociarse a una intervención, con el tipo que pondrá el servidor', () => {
    expect(['maintenance', 'repair', 'modification', 'inspection'].every((c) => allowsRecord(c as Expense['category']))).toBe(true)
    expect(allowsRecord('insurance')).toBe(false)
    expect(recordTypeFor('repair')).toBe('repair')
    expect(recordTypeFor('modification')).toBe('modification')
    expect(recordTypeFor('inspection')).toBe('inspection')
    expect(recordTypeFor('maintenance')).toBe('maintenance')
  })

  it('solo se ofrece asociar a intervenciones activas y sin coste', () => {
    const rec = (r: Partial<MaintenanceRecord>) => ({ id: 1, total_cost: null, archived_at: null, ...r }) as MaintenanceRecord
    const list = [rec({ id: 1 }), rec({ id: 2, total_cost: '0.00' }), rec({ id: 3, total_cost: '60.00' }), rec({ id: 4, archived_at: '2026-01-01T00:00:00Z' })]
    expect(costlessRecords(list).map((r) => r.id)).toEqual([1, 2])
  })

  it('el origen dice la orden y el taller, y desglosa el importe si lo hay', () => {
    expect(originLabel(origin())).toBe('Orden OT-2026-0036 · Taller Demo')
    expect(originLabel(origin({ work_order_number: null, workshop_name: null }))).toBe('Intervención')
    expect(originBreakdown(origin())).toMatch(/^Piezas 80,00\s€ · Mano de obra 40,00\s€ · IVA 25,20\s€$/)
    expect(originBreakdown(origin({ parts_cost: null, labor_cost: null, tax_amount: null }))).toBeNull()
  })
})

describe('grupos del detalle del mes', () => {
  const e = (category: Expense['category'], amount: string, recurrence_months: number | null = null) => ({ category, amount, recurrence_months })

  it('clasifica cada gasto en un único grupo', () => {
    expect(expenseGroup(e('fuel', '1'))).toBe('fuel')
    expect(expenseGroup(e('modification', '1'))).toBe('modification')
    expect(expenseGroup(e('insurance', '1', 12))).toBe('recurring')
    expect(expenseGroup(e('insurance', '1'))).toBe('other')
    expect(expenseGroup(e('repair', '1'))).toBe('workshop')
    expect(expenseGroup(e('tolls', '1'))).toBe('other')
  })

  it('suma por grupo en céntimos, de mayor a menor, sin perder ni duplicar importe', () => {
    const list = [e('fuel', '54.80'), e('fuel', '0.10'), e('fuel', '0.20'), e('repair', '145.20'), e('insurance', '420.00', 12), e('tolls', '7.10')]
    const totals = groupTotals(list)
    expect(totals.map((t) => t.group)).toEqual(['recurring', 'workshop', 'fuel', 'other'])
    expect(totals.find((t) => t.group === 'fuel')).toEqual({ group: 'fuel', cents: 5510, count: 3 })
    expect(totals.reduce((s, t) => s + t.cents, 0)).toBe(62740)
    expect(groupTotals([])).toEqual([])
  })
})
