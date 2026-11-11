import { describe, expect, it } from 'vitest'
import type { Bay, WorkOrder, WorkOrderStatus } from '@/api/types'
import { assignSpots, clayColor, CLAY_FALLBACKS, computeFloorLayout, entrancePose, planRoute, slotCapacity, spotPose, type Spot } from './layout'

function order(id: number, status: WorkOrderStatus, bay: number | null = null, color: string | null = null): WorkOrder {
  return {
    id,
    workspace_id: 1,
    number: `OT-2026-${String(id).padStart(4, '0')}`,
    vehicle: { id: 100 + id, display_name: `Coche ${id}`, make: 'X', model: 'Y', plate: null, body_type: 'sedan', color_hex: color },
    customer: null,
    title: 't',
    complaint: null,
    diagnosis: null,
    status,
    priority: 'normal',
    bay,
    assigned_to: null,
    mileage_in: null,
    received_at: '2026-11-10T08:00:00Z',
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
    created_at: '2026-11-10T08:00:00Z',
    updated_at: '2026-11-10T08:00:00Z',
  }
}

const bays = (n: number, occupied: Record<number, WorkOrder> = {}): Bay[] =>
  Array.from({ length: n }, (_, i) => ({ number: i + 1, work_order: occupied[i + 1] ?? null }))

describe('taller isométrico: distribución', () => {
  it('coloca un elevador por bay, la calzada entre elevadores y plazas, y la entrada a la derecha', () => {
    const L = computeFloorLayout([1, 2, 3, 4])
    expect(L.bays.map((b) => b.number)).toEqual([1, 2, 3, 4])
    expect(L.laneZ).toBeGreaterThan(L.bayZ)
    expect(L.stallZ).toBeGreaterThan(L.laneZ)
    expect(L.entrance.x).toBeGreaterThan(L.maxX)
    const cap = slotCapacity(4)
    expect(L.park).toHaveLength(cap.park)
    expect(L.ready).toHaveLength(cap.ready)
    // la entrega queda junto a la entrada (a la derecha de la espera)
    expect(Math.min(...L.ready.map((s) => s.x))).toBeGreaterThan(Math.max(...L.park.map((s) => s.x)))
  })

  it('reparte: elevador ⇒ su elevador; «Listo» sin elevador ⇒ entrega; resto ⇒ espera', () => {
    const a = assignSpots(bays(4, { 2: order(1, 'in_progress', 2) }), [order(2, 'received'), order(3, 'ready')], slotCapacity(4), new Map())
    const by = Object.fromEntries(a.cars.map((c) => [c.order.id, c.spot]))
    expect(by[1]).toEqual({ kind: 'bay', bay: 2 })
    expect(by[2]).toEqual({ kind: 'park', slot: 0 })
    expect(by[3]).toEqual({ kind: 'ready', slot: 0 })
  })

  it('conserva las plazas: un coche no se mueve porque otro se vaya', () => {
    const cap = slotCapacity(4)
    const first = assignSpots(bays(4), [order(1, 'received'), order(2, 'received'), order(3, 'diagnosing')], cap, new Map())
    const second = assignSpots(bays(4), [order(2, 'received'), order(3, 'diagnosing')], cap, first.slots)
    expect(second.slots.get(2)).toEqual(first.slots.get(2))
    expect(second.slots.get(3)).toEqual(first.slots.get(3))
    // una nueva ocupa la plaza libre más baja
    const third = assignSpots(bays(4), [order(2, 'received'), order(3, 'diagnosing'), order(4, 'received')], cap, second.slots)
    expect(third.slots.get(4)).toEqual({ kind: 'park', slot: 0 })
  })

  it('cuenta las que no caben', () => {
    const cap = { park: 2, ready: 1 }
    const a = assignSpots(bays(1), [order(1, 'received'), order(2, 'received'), order(3, 'received'), order(4, 'ready'), order(5, 'ready')], cap, new Map())
    expect(a.cars).toHaveLength(3)
    expect(a.overflow).toEqual({ park: 1, ready: 1 })
  })

  it('una ruta desde un elevador sale marcha atrás y termina en el centro de la plaza de destino', () => {
    const L = computeFloorLayout([1, 2, 3])
    const fromSpot: Spot = { kind: 'bay', bay: 1 }
    const to: Spot = { kind: 'ready', slot: 0 }
    const from = spotPose(L, fromSpot, 'in_progress')!
    const toPose = spotPose(L, to, 'ready')!
    const r = planRoute(L, from, fromSpot, to, toPose)
    expect(r.reverse?.[0]).toEqual([from.x, from.z])
    expect(r.reverse?.at(-1)?.[1]).toBeCloseTo(L.laneZ)
    expect(r.forward.at(-1)).toEqual([toPose.x, toPose.z])
    // entra de morro: el último tramo va hacia +z (las plazas del frente miran a +z)
    const [a, b] = r.forward.slice(-2)
    expect(b[1]).toBeGreaterThan(a[1])
  })

  it('desde la entrada no hay marcha atrás y se avanza hacia la nave', () => {
    const L = computeFloorLayout([1, 2])
    const to: Spot = { kind: 'bay', bay: 2 }
    const r = planRoute(L, entrancePose(L), 'entrance', to, spotPose(L, to, 'received')!)
    expect(r.reverse).toBeNull()
    expect(r.forward[1][0]).toBeLessThan(r.forward[0][0])
    const [a, b] = r.forward.slice(-2)
    expect(b[1]).toBeLessThan(a[1]) // al elevador, hacia el muro (−z)
  })
})

describe('taller isométrico: color de arcilla', () => {
  it('sin color usa uno de los cuatro de maqueta, fijo por id', () => {
    expect(clayColor(null, 7)).toBe(clayColor(null, 7))
    expect(CLAY_FALLBACKS).toContain(clayColor(null, 7))
    expect(clayColor('rojo', 3)).toBe(CLAY_FALLBACKS[3])
  })
  it('lleva la pintura real a un tono mate sin negro ni blanco puros', () => {
    const black = clayColor('#000000', 1)
    const white = clayColor('#ffffff', 1)
    expect(black).not.toBe('#000000')
    expect(white).not.toBe('#ffffff')
    expect(clayColor('#1f4fd8', 1)).toMatch(/^#[0-9a-f]{6}$/)
  })
})
