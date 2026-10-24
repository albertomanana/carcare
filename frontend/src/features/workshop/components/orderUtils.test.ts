import { describe, expect, it } from 'vitest'
import type { Bay, WorkOrder } from '@/api/types'
import { nextBay } from '@/api/hooks/workshop'
import { bayOptions, baysSummary, dateTimeLocalAt, formatWhen, fromDateTimeLocal, isDeletableStatus, nextStep, ORDER_SUMMARY_LABEL, orderSummaryTitle, toDateTimeLocal, waitingOrders } from './orderUtils'

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

describe('fechas con hora', () => {
  it('ida y vuelta datetime-local ⇄ ISO con desplazamiento', () => {
    const iso = fromDateTimeLocal('2026-10-23T14:05')
    expect(iso).toMatch(/^2026-10-23T14:05:00[+-]\d{2}:\d{2}$/)
    expect(toDateTimeLocal(iso)).toBe('2026-10-23T14:05')
  })

  it('valores vacíos o inválidos', () => {
    expect(fromDateTimeLocal('')).toBeNull()
    expect(fromDateTimeLocal('mañana')).toBeNull()
    expect(toDateTimeLocal(null)).toBe('')
  })

  it('atajos relativos a hoy', () => {
    const now = new Date(2026, 9, 22, 10, 0)
    expect(dateTimeLocalAt(0, 19, 0, now)).toBe('2026-10-22T19:00')
    expect(dateTimeLocalAt(1, 13, 0, now)).toBe('2026-10-23T13:00')
  })

  it('formato relativo: hoy, mañana, ayer y otros días', () => {
    const now = new Date(2026, 9, 22, 10, 0)
    expect(formatWhen(new Date(2026, 9, 22, 18, 0).toISOString(), now)).toBe('Hoy, 18:00')
    expect(formatWhen(new Date(2026, 9, 23, 13, 0).toISOString(), now)).toBe('Mañana, 13:00')
    expect(formatWhen(new Date(2026, 9, 21, 19, 0).toISOString(), now)).toBe('Ayer, 19:00')
    expect(formatWhen(new Date(2026, 9, 27, 9, 30).toISOString(), now)).toMatch(/27 oct, 09:30$/)
    expect(formatWhen(null, now)).toBe('—')
  })
})

describe('flujo de estados', () => {
  it('siguiente paso natural', () => {
    expect(nextStep('received')?.status).toBe('diagnosing')
    expect(nextStep('waiting_parts')?.status).toBe('in_progress')
    expect(nextStep('ready')?.status).toBe('delivered')
    expect(nextStep('delivered')).toBeNull()
    expect(nextStep('cancelled')).toBeNull()
  })

  it('solo se borran órdenes recibidas o canceladas', () => {
    expect(isDeletableStatus('received')).toBe(true)
    expect(isDeletableStatus('cancelled')).toBe(true)
    expect(isDeletableStatus('in_progress')).toBe(false)
  })

  it('elevador tras un cambio de estado (misma regla que el servidor)', () => {
    const inBay = order({ status: 'in_progress', bay: 2 })
    expect(nextBay(inBay, { status: 'diagnosing' })).toBe(2)
    expect(nextBay(inBay, { status: 'ready' })).toBeNull()
    expect(nextBay(inBay, { status: 'ready', bay: 3 })).toBe(3)
    expect(nextBay(inBay, { status: 'delivered', bay: 3 })).toBeNull()
    expect(nextBay(inBay, { status: 'in_progress', bay: null })).toBeNull()
    expect(nextBay(order({ status: 'ready', bay: 1 }), { status: 'ready' })).toBe(1)
  })
})

describe('elevadores', () => {
  const bays: Bay[] = [
    { number: 1, work_order: order({ id: 7, number: 'OT-2026-0007', bay: 1 }) },
    { number: 2, work_order: null },
  ]

  it('marca los ocupados por otra orden', () => {
    const opts = bayOptions(bays, 9)
    expect(opts[0].occupiedBy?.number).toBe('OT-2026-0007')
    expect(opts[0].label).toBe('Elevador 1 · ocupado por OT-2026-0007')
    expect(opts[1].occupiedBy).toBeNull()
    // La propia orden no ocupa "su" elevador
    expect(bayOptions(bays, 7)[0].occupiedBy).toBeNull()
  })

  it('resumen de ocupación', () => {
    expect(baysSummary(bays)).toEqual({ total: 2, busy: 1, free: 1 })
    expect(baysSummary(undefined)).toEqual({ total: 0, busy: 0, free: 0 })
  })

  it('zona de espera: sin elevador, abiertas, tarde y urgentes primero', () => {
    const list = waitingOrders([
      order({ id: 1, priority: 'low' }),
      order({ id: 2, priority: 'urgent' }),
      order({ id: 3, is_late: true }),
      order({ id: 4, bay: 1 }),
      order({ id: 5, status: 'delivered' }),
    ])
    expect(list.map((o) => o.id)).toEqual([3, 2, 1])
  })
})

describe('resumen imprimible', () => {
  it('lleva el rótulo de que no es una factura', () => {
    expect(ORDER_SUMMARY_LABEL).toBe('Resumen de la orden — no es una factura')
  })

  it('propone un nombre de archivo con número, matrícula y fecha', () => {
    expect(orderSummaryTitle('OT-2026-0024', '4470LJD', '2026-10-24')).toBe('Resumen OT-2026-0024 4470LJD 2026-10-24')
    expect(orderSummaryTitle('OT-2026-0024', null, '2026-10-24')).toBe('Resumen OT-2026-0024 2026-10-24')
  })
})
