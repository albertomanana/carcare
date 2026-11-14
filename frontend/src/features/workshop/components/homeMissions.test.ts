import { describe, expect, it } from 'vitest'
import type { Bay, WorkOrder } from '@/api/types'
import { homeMissions } from './homeMissions'

function order(partial: Partial<WorkOrder>): WorkOrder {
  return {
    id: 1,
    workspace_id: 1,
    number: 'OT-2026-0001',
    vehicle: { id: 1, display_name: 'Coche', make: 'Marca', model: 'Modelo', plate: null, body_type: null, color_hex: null },
    customer: null,
    title: 'Revisión',
    complaint: null,
    diagnosis: null,
    status: 'received',
    priority: 'normal',
    bay: null,
    assigned_to: null,
    mileage_in: null,
    received_at: '2026-10-22T08:00:00+02:00',
    promised_at: null,
    completed_at: null,
    delivered_at: null,
    status_changed_at: '2026-11-10T08:30:00+01:00',
    repair_seconds: 0,
    estimated_minutes: null,
    items: [],
    subtotal: '0.00',
    tax_rate: '21.00',
    tax_amount: '0.00',
    total: '0.00',
    is_late: false,
    maintenance_record_id: null,
    created_at: '2026-10-22T08:00:00+02:00',
    updated_at: '2026-10-22T08:00:00+02:00',
    ...partial,
  }
}

const bays: Bay[] = [
  { number: 1, work_order: null },
  { number: 2, work_order: null },
]
const dash = (over: Partial<{ due: WorkOrder[]; alerts: number; overdue: number }> = {}) =>
  ({
    counts: { vehicles: 0, customers: 0, open_orders: 0, late_orders: 0, overdue_reminders: over.overdue ?? 0 },
    due_today: over.due ?? [],
    fleet_alerts: Array.from({ length: over.alerts ?? 0 }, (_, i) => ({ id: i })) as never,
  }) as never

describe('homeMissions', () => {
  it('sin datos de órdenes no inventa nada: solo las alertas de flota si las hay', () => {
    expect(homeMissions({ orders: undefined, bays, dashboard: null })).toEqual([])
    expect(homeMissions({ orders: undefined, bays, dashboard: dash({ alerts: 2, overdue: 1 }) }).map((m) => m.kind)).toEqual(['alerts'])
  })

  it('un taller sin órdenes no tiene misiones', () => {
    expect(homeMissions({ orders: [], bays, dashboard: dash() })).toEqual([])
  })

  it('las que van tarde salen primero (urgentes antes) y con tono de peligro', () => {
    const a = order({ id: 1, is_late: true, promised_at: '2026-11-10T10:00:00+01:00' })
    const b = order({ id: 2, is_late: true, priority: 'urgent', promised_at: '2026-11-10T12:00:00+01:00' })
    const m = homeMissions({ orders: [a, b], bays, dashboard: dash() })
    expect(m.filter((x) => x.kind === 'order').map((x) => (x.kind === 'order' ? x.order.id : 0))).toEqual([2, 1])
    expect(m[0].tone).toBe('danger')
  })

  it('el mecánico ve primero las suyas y no se repiten como «tarde»', () => {
    const mine = order({ id: 1, is_late: true, assigned_to: { id: 7, name: 'Yo' } })
    const other = order({ id: 2, is_late: true, assigned_to: { id: 8, name: 'Otro' } })
    const m = homeMissions({ orders: [other, mine], bays, dashboard: dash(), mechanicId: 7 })
    const ids = m.flatMap((x) => (x.kind === 'order' ? [`${x.reason}-${x.order.id}`] : []))
    expect(ids).toEqual(['mine-1', 'late-2'])
  })

  it('listos y esperando elevador agrupan coches; avisan si no hay elevadores libres', () => {
    const ready = order({ id: 1, status: 'ready' })
    const waiting = order({ id: 2, status: 'received' })
    const full: Bay[] = [{ number: 1, work_order: waiting }]
    const m = homeMissions({ orders: [ready, waiting], bays: full, dashboard: dash() })
    expect(m.map((x) => x.key)).toEqual(['ready', 'waiting'])
    const w = m[1]
    expect(w.kind === 'filter' && w.freeBays).toBe(0)
    expect(w.tone).toBe('info')
  })

  it('las entregas de hoy no repiten las que ya van tarde y no incluyen órdenes cerradas', () => {
    const late = order({ id: 1, is_late: true })
    const today = order({ id: 2, promised_at: '2026-11-11T18:00:00+01:00' })
    const done = order({ id: 3, status: 'delivered' })
    const m = homeMissions({ orders: [late, today], bays, dashboard: dash({ due: [late, today, done] }) })
    expect(m.map((x) => x.key)).toEqual(['late-1', 'today-2', 'waiting'])
  })
})
