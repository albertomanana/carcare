import { describe, expect, it } from 'vitest'
import type { Bay, WorkOrder } from '@/api/types'
import { effectiveFilter, filterCaption, fleetRows, fleetSummary, floorCounts, matchesFilter } from './floorFleet'

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

const onBay1 = order({ id: 10, bay: 1, status: 'in_progress' })
const onBay3 = order({ id: 11, bay: 3, status: 'diagnosing', is_late: true })
const waitingLate = order({ id: 12, status: 'received', is_late: true, priority: 'normal' })
const waitingUrgent = order({ id: 13, status: 'waiting_parts', priority: 'urgent' })
const readyNoBay = order({ id: 14, status: 'ready', promised_at: '2026-10-23T19:00:00+02:00' })
const readyOnBay = order({ id: 15, status: 'ready', bay: 2 })
const delivered = order({ id: 16, status: 'delivered' })
const orders = [readyNoBay, waitingUrgent, onBay3, waitingLate, onBay1, readyOnBay, delivered]

const bays: Bay[] = [
  { number: 1, work_order: onBay1 },
  { number: 2, work_order: readyOnBay },
  { number: 3, work_order: onBay3 },
  { number: 4, work_order: null },
]

describe('cifras del taller', () => {
  it('cuenta solo órdenes abiertas y elevadores reales', () => {
    expect(floorCounts(bays, orders)).toEqual({ open: 6, busyBays: 3, totalBays: 4, waiting: 2, ready: 2, late: 2 })
  })

  it('sin órdenes cargadas no inventa ceros', () => {
    const c = floorCounts(bays, undefined)
    expect(c.open).toBeNull()
    expect(c.waiting).toBeNull()
    expect(c.busyBays).toBe(3)
  })

  it('«Esperando» excluye las listas y las que están en elevador', () => {
    expect(matchesFilter(readyNoBay, 'waiting')).toBe(false)
    expect(matchesFilter(onBay1, 'waiting')).toBe(false)
    expect(matchesFilter(waitingLate, 'waiting')).toBe(true)
    expect(matchesFilter(delivered, 'all')).toBe(false)
  })

  it('el filtro «Con retraso» vuelve a «En taller» si ya no hay ninguna tarde', () => {
    const none = floorCounts(bays, [onBay1])
    expect(effectiveFilter('late', none)).toBe('all')
    expect(effectiveFilter('late', floorCounts(bays, orders))).toBe('late')
    expect(effectiveFilter('ready', none)).toBe('ready')
  })
})

describe('filas de la flota', () => {
  it('ordena como la maqueta: elevadores por número, espera (tarde y urgente primero) y listas', () => {
    expect(fleetRows(orders, 'all').map((o) => o.id)).toEqual([10, 15, 11, 12, 13, 14])
  })

  it('filtra por la tarjeta elegida', () => {
    expect(fleetRows(orders, 'bay').map((o) => o.id)).toEqual([10, 15, 11])
    expect(fleetRows(orders, 'ready').map((o) => o.id)).toEqual([15, 14])
    expect(fleetRows(orders, 'late').map((o) => o.id)).toEqual([11, 12])
  })
})

describe('textos', () => {
  it('resumen hablado con plurales correctos', () => {
    expect(fleetSummary(floorCounts(bays, orders))).toBe('6 coches en el taller · 3 de 4 elevadores ocupados · 2 listos para entregar · 2 con retraso')
    expect(fleetSummary(floorCounts([{ number: 1, work_order: onBay1 }], [onBay1]))).toBe('1 coche en el taller · 1 de 1 elevador ocupado')
    expect(fleetSummary(floorCounts(bays, undefined))).toBe('3 de 4 elevadores ocupados')
  })

  it('título de la lista según el filtro', () => {
    expect(filterCaption('ready', 1)).toBe('1 coche listo para entregar')
    expect(filterCaption('all', 0)).toBe('0 coches')
  })
})
