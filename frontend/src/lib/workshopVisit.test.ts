import { describe, expect, it } from 'vitest'
import type { RepairRequest, RepairRequestWorkOrder } from '@/api/types'
import { isVisitOpen, openVisits, visitPlace, visitSentence, visitStatus, visitSteps } from './workshopVisit'

const order = (o: Partial<RepairRequestWorkOrder> = {}): RepairRequestWorkOrder => ({
  id: 31,
  number: 'OT-2026-0031',
  status: 'in_progress',
  received_at: '2026-11-14T09:00:00+01:00',
  promised_at: null,
  completed_at: null,
  delivered_at: null,
  bay: 2,
  mechanic_name: 'Andrés',
  status_changed_at: '2026-11-15T10:00:00+01:00',
  repair_seconds: 0,
  estimated_minutes: 90,
  ...o,
})

const request = (r: Partial<RepairRequest> = {}): RepairRequest =>
  ({
    id: 7,
    perspective: 'requester',
    status: 'converted',
    workshop: { id: 3, name: 'Taller Demo', city: 'Madrid' },
    vehicle_id: 12,
    title: 'Chirrido al frenar',
    work_order: order(),
    ...r,
  }) as RepairRequest

describe('openVisits', () => {
  it('une cada vehículo con su orden abierta y el taller que la lleva', () => {
    const visits = openVisits([request()])
    expect(visits.size).toBe(1)
    expect(visits.get(12)).toMatchObject({ requestId: 7, workshopName: 'Taller Demo', title: 'Chirrido al frenar' })
  })

  it('no cuenta las órdenes entregadas o canceladas, ni las solicitudes sin orden o sin vehículo', () => {
    const visits = openVisits([
      request({ id: 1, work_order: order({ status: 'delivered' }) }),
      request({ id: 2, vehicle_id: 13, work_order: order({ status: 'cancelled' }) }),
      request({ id: 3, vehicle_id: 14, work_order: null }),
      request({ id: 4, vehicle_id: null }),
    ])
    expect(visits.size).toBe(0)
  })

  it('no usa las solicitudes vistas como taller (no hay vehículo del garaje)', () => {
    expect(openVisits([request({ perspective: 'workshop' })]).size).toBe(0)
  })

  it('con dos órdenes abiertas del mismo coche se queda con la que cambió más tarde', () => {
    const visits = openVisits([
      request({ id: 1, work_order: order({ id: 40, status_changed_at: '2026-11-15T08:00:00+01:00' }) }),
      request({ id: 2, work_order: order({ id: 41, status_changed_at: '2026-11-15T11:00:00+01:00' }) }),
    ])
    expect(visits.get(12)?.order.id).toBe(41)
  })
})

describe('textos de la visita', () => {
  it('dice dónde está el coche', () => {
    expect(visitPlace(order())).toBe('Elevador 2')
    expect(visitPlace(order({ bay: null, status: 'waiting_parts' }))).toBe('En la zona de espera')
    expect(visitPlace(order({ bay: null, status: 'received' }))).toBe('Recibido, a la espera')
    expect(visitPlace(order({ bay: null, status: 'ready' }))).toBe('Listo para recoger')
  })

  it('dice el estado y quién lo lleva, solo si hay alguien asignado', () => {
    expect(visitStatus(order())).toBe('En reparación · lo lleva Andrés')
    expect(visitStatus(order({ mechanic_name: null }))).toBe('En reparación')
    expect(visitStatus(order({ status: 'ready' }))).toBe('Trabajo terminado')
  })

  it('frase completa y estado abierto', () => {
    expect(visitSentence(openVisits([request()]).get(12)!)).toBe('En el taller Taller Demo: elevador 2, en reparación, lo lleva Andrés')
    expect(isVisitOpen(order())).toBe(true)
    expect(isVisitOpen(order({ status: 'delivered' }))).toBe(false)
    expect(isVisitOpen(null)).toBe(false)
  })
})

describe('visitSteps', () => {
  it('marca lo pasado, el paso actual y lo que queda', () => {
    expect(visitSteps('in_progress').map((s) => `${s.status}:${s.state}`)).toEqual(['received:done', 'diagnosing:done', 'in_progress:current', 'ready:todo', 'delivered:todo'])
    expect(visitSteps('received')[0].state).toBe('current')
    expect(visitSteps('delivered').every((s, i, a) => (i < a.length - 1 ? s.state === 'done' : s.state === 'current'))).toBe(true)
  })

  it('«Esperando piezas» solo aparece cuando es el estado actual; una orden cancelada no tiene recorrido', () => {
    expect(visitSteps('in_progress').some((s) => s.status === 'waiting_parts')).toBe(false)
    expect(visitSteps('waiting_parts').find((s) => s.state === 'current')?.label).toBe('Esperando piezas')
    expect(visitSteps('cancelled')).toEqual([])
  })
})
