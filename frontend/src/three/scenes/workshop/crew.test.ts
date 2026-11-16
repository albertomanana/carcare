import { describe, expect, it } from 'vitest'
import type { Bay, WorkOrder, WorkOrderStatus } from '@/api/types'
import { assignCrew, beaconText, crewStatusText, type CrewMember } from './crew'

function order(id: number, status: WorkOrderStatus, bay: number | null, who: { id: number; name: string } | null, changed = '2026-11-16T08:00:00Z'): WorkOrder {
  return {
    id,
    workspace_id: 1,
    number: `OT-2026-${String(id).padStart(4, '0')}`,
    vehicle: { id: 100 + id, display_name: `Coche ${id}`, make: 'X', model: 'Y', plate: null, body_type: 'sedan', color_hex: null },
    customer: null,
    title: 't',
    complaint: null,
    diagnosis: null,
    status,
    priority: 'normal',
    bay,
    assigned_to: who,
    mileage_in: null,
    received_at: '2026-11-16T07:00:00Z',
    promised_at: null,
    completed_at: null,
    delivered_at: null,
    status_changed_at: changed,
    repair_seconds: 0,
    estimated_minutes: null,
    items: [],
    subtotal: '0.00',
    tax_rate: '21.00',
    tax_amount: '0.00',
    total: '0.00',
    is_late: false,
    maintenance_record_id: null,
    created_at: '2026-11-16T07:00:00Z',
    updated_at: '2026-11-16T07:00:00Z',
  }
}

const ana = { id: 1, name: 'Ana' }
const luis = { id: 2, name: 'Luis' }
const marta = { id: 3, name: 'Marta' }
const team: CrewMember[] = [
  { ...ana, role: 'mechanic' },
  { ...luis, role: 'mechanic' },
  { ...marta, role: 'manager' },
]

const bays = (orders: Record<number, WorkOrder>, n = 4): Bay[] => Array.from({ length: n }, (_, i) => ({ number: i + 1, work_order: orders[i + 1] ?? null }))

describe('equipo del taller: una figura por persona', () => {
  it('nadie aparece dos veces aunque tenga varias órdenes en curso', () => {
    const a = assignCrew(team, bays({ 1: order(1, 'in_progress', 1, ana), 2: order(2, 'diagnosing', 2, ana), 3: order(3, 'in_progress', 3, luis) }))
    const ids = a.people.map((p) => p.member.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.sort()).toEqual([1, 2, 3])
    expect(a.people.filter((p) => p.status === 'working')).toHaveLength(2)
  })

  it('con varias órdenes, la figura va a la que cambió de estado más tarde y las demás llevan baliza', () => {
    const a = assignCrew(
      team,
      bays({ 1: order(1, 'in_progress', 1, ana, '2026-11-16T08:00:00Z'), 3: order(3, 'diagnosing', 3, ana, '2026-11-16T09:30:00Z') }),
    )
    const p = a.people.find((x) => x.member.id === ana.id)!
    expect(p).toMatchObject({ status: 'working', bay: 3, orderId: 3, task: 'diagnose', otherBays: [1], offBay: 0 })
    expect(a.beacons.get(1)).toEqual({ kind: 'tech_elsewhere', name: 'Ana', bay: 3 })
    expect(a.beacons.has(3)).toBe(false)
    expect(crewStatusText(p)).toBe('Diagnosticando en el elevador 3 (también el 1)')
  })

  it('un coche en el elevador sin persona asignada espera técnico; esperando piezas o listo, no', () => {
    const a = assignCrew(
      team,
      bays({ 1: order(1, 'received', 1, null), 2: order(2, 'in_progress', 2, null), 3: order(3, 'waiting_parts', 3, null), 4: order(4, 'ready', 4, null) }),
    )
    expect(a.beacons.get(1)).toEqual({ kind: 'awaiting_tech' })
    expect(a.beacons.get(2)).toEqual({ kind: 'awaiting_tech' })
    expect(a.beacons.has(3)).toBe(false)
    expect(a.beacons.has(4)).toBe(false)
    expect(beaconText(a.beacons.get(1)!)).toBe('En espera de técnico')
  })

  it('una orden asignada pero sin empezar no pone a la persona a trabajar ni lleva baliza', () => {
    const a = assignCrew(team, bays({ 1: order(1, 'received', 1, luis), 2: order(2, 'waiting_parts', 2, luis) }))
    expect(a.people.find((p) => p.member.id === luis.id)?.status).toBe('idle')
    expect(a.beacons.size).toBe(0)
  })

  it('sin orden en curso queda en la zona del equipo, ordenado por nombre tras quien trabaja', () => {
    const a = assignCrew(team, bays({ 2: order(2, 'in_progress', 2, marta) }))
    expect(a.people.map((p) => p.member.name)).toEqual(['Marta', 'Ana', 'Luis'])
    expect(crewStatusText(a.people[1])).toBe('Sin orden en curso')
  })

  it('una persona que ya no es del equipo no aparece; su coche espera técnico', () => {
    const exMember = { id: 9, name: 'Pepe' }
    const a = assignCrew(team, bays({ 1: order(1, 'in_progress', 1, exMember) }))
    expect(a.people.some((p) => p.member.id === exMember.id)).toBe(false)
    expect(a.beacons.get(1)).toEqual({ kind: 'awaiting_tech' })
  })

  it('sin lista de miembros, el equipo sale de las órdenes (solo quien está asignado)', () => {
    const a = assignCrew(undefined, bays({ 1: order(1, 'in_progress', 1, ana), 2: order(2, 'diagnosing', 2, ana) }))
    expect(a.people).toHaveLength(1)
    expect(a.people[0]).toMatchObject({ status: 'working', bay: 1, otherBays: [2] })
  })

  it('una orden en reparación sin elevador también es orden en curso (la figura se queda en la zona del equipo)', () => {
    const loose = order(7, 'in_progress', null, luis)
    const a = assignCrew(team, bays({}), [loose])
    const p = a.people.find((x) => x.member.id === luis.id)!
    expect(p).toMatchObject({ status: 'working', bay: null, orderId: 7 })
    expect(crewStatusText(p)).toBe('Reparando OT-2026-0007 sin elevador')
    expect(a.beacons.size).toBe(0)
  })

  it('con órdenes en elevador y fuera, la figura va al elevador aunque la de fuera sea más reciente', () => {
    const a = assignCrew(team, bays({ 2: order(2, 'diagnosing', 2, ana, '2026-11-16T08:00:00Z') }), [order(8, 'in_progress', null, ana, '2026-11-16T11:00:00Z')])
    const p = a.people.find((x) => x.member.id === ana.id)!
    expect(p).toMatchObject({ bay: 2, orderId: 2, offBay: 1 })
    expect(crewStatusText(p)).toBe('Diagnosticando en el elevador 2 (1 más sin elevador)')
  })
})
