import { describe, expect, it } from 'vitest'
import type { Bay, BodyType, WorkOrder, WorkOrderStatus } from '@/api/types'
import { getCarBuild } from '../../car/build'
import { BODY_SPECS } from '../../car/specs'
import {
  analyzePlans,
  boxGap,
  MARGIN,
  OBSTACLE_MARGIN,
  orderMovers,
  planTraffic,
  poseAt,
  type CarDims,
  type Mover,
  type Pose,
  type StaticCar,
} from './motion'
import {
  assignSpots,
  CAR_MAX_L,
  CAR_MAX_W,
  clayColor,
  CLAY_FALLBACKS,
  computeFloorLayout,
  entrancePose,
  floorObstacles,
  LIFT_HEIGHT,
  planRoute,
  slotCapacity,
  spotKey,
  spotPose,
  type FloorLayout,
  type Spot,
} from './layout'

const BODIES = Object.keys(BODY_SPECS) as BodyType[]

function order(id: number, status: WorkOrderStatus, bay: number | null = null, color: string | null = null, body: BodyType = 'sedan'): WorkOrder {
  return {
    id,
    workspace_id: 1,
    number: `OT-2026-${String(id).padStart(4, '0')}`,
    vehicle: { id: 100 + id, display_name: `Coche ${id}`, make: 'X', model: 'Y', plate: null, body_type: body, color_hex: color },
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

const dimsOf = (body: BodyType): CarDims => {
  const s = getCarBuild(body, 'clay').size
  return { length: s.length, width: s.width }
}

describe('taller isométrico: distribución', () => {
  it('coloca un elevador por bay, dos carriles y la entrada a la derecha', () => {
    const L = computeFloorLayout([1, 2, 3, 4])
    expect(L.bays.map((b) => b.number)).toEqual([1, 2, 3, 4])
    expect(L.laneN).toBeLessThan(L.laneS)
    expect(L.stallZ).toBeGreaterThan(L.laneS)
    expect(L.entrance.x).toBeGreaterThan(L.maxX)
    const cap = slotCapacity(4)
    expect(L.park).toHaveLength(cap.park)
    expect(L.ready).toHaveLength(cap.ready)
    expect(Math.min(...L.ready.map((s) => s.x))).toBeGreaterThan(Math.max(...L.park.map((s) => s.x)))
  })

  it('las constantes de plaza cubren la carrocería real más grande', () => {
    for (const b of BODIES) {
      const d = dimsOf(b)
      expect(d.length).toBeLessThanOrEqual(CAR_MAX_L)
      expect(d.width).toBeLessThanOrEqual(CAR_MAX_W)
    }
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
    const third = assignSpots(bays(4), [order(2, 'received'), order(3, 'diagnosing'), order(4, 'received')], cap, second.slots)
    expect(third.slots.get(4)).toEqual({ kind: 'park', slot: 0 })
  })

  it('cuenta las que no caben', () => {
    const cap = { park: 2, ready: 1 }
    const a = assignSpots(bays(1), [order(1, 'received'), order(2, 'received'), order(3, 'received'), order(4, 'ready'), order(5, 'ready')], cap, new Map())
    expect(a.cars).toHaveLength(3)
    expect(a.overflow).toEqual({ park: 1, ready: 1 })
  })
})

// ───────────────────────── Sin choques ─────────────────────────

interface Car {
  id: number
  body: BodyType
  spot: Spot
  status: WorkOrderStatus
}

/** Plazas en orden de llenado: elevadores, espera y entrega. */
function fillSpots(nBays: number): Spot[] {
  const cap = slotCapacity(nBays)
  return [
    ...Array.from({ length: nBays }, (_, i) => ({ kind: 'bay', bay: i + 1 }) as Spot),
    ...Array.from({ length: cap.park }, (_, k) => ({ kind: 'park', slot: k }) as Spot),
    ...Array.from({ length: cap.ready }, (_, k) => ({ kind: 'ready', slot: k }) as Spot),
  ]
}

function carsFor(nBays: number, n: number): Car[] {
  const spots = fillSpots(nBays)
  return Array.from({ length: Math.min(n, spots.length) }, (_, i) => ({
    id: i + 1,
    body: BODIES[i % BODIES.length],
    spot: spots[i],
    status: spots[i].kind === 'bay' ? (i % 2 ? 'in_progress' : 'diagnosing') : spots[i].kind === 'ready' ? 'ready' : 'received',
  }))
}

function parkedPose(L: FloorLayout, c: Car): Pose {
  return spotPose(L, c.spot, c.status)!
}

function parkedStatics(L: FloorLayout, cars: Car[]): StaticCar[] {
  return cars.map((c) => ({ id: c.id, dims: dimsOf(c.body), pose: parkedPose(L, c) }))
}

function enteringMovers(L: FloorLayout, cars: Car[]): Mover[] {
  return cars.map((c) => {
    const to = parkedPose(L, c)
    const from = entrancePose(L, c.spot)
    return {
      id: c.id,
      dims: dimsOf(c.body),
      from,
      fromKey: 'entrance',
      entering: true,
      fromBay: null,
      to,
      toKey: spotKey(c.spot),
      toBay: c.spot.kind === 'bay' ? c.spot.bay : null,
      route: planRoute(L, from, 'entrance', c.spot, to),
    }
  })
}

function relocation(L: FloorLayout, c: Car, spot: Spot, status: WorkOrderStatus): Mover {
  const from = parkedPose(L, c)
  const to = spotPose(L, spot, status)!
  return {
    id: c.id,
    dims: dimsOf(c.body),
    from,
    fromKey: spotKey(c.spot),
    entering: false,
    fromBay: c.spot.kind === 'bay' ? c.spot.bay : null,
    to,
    toKey: spotKey(spot),
    toBay: spot.kind === 'bay' ? spot.bay : null,
    route: spotKey(c.spot) === spotKey(spot) ? null : planRoute(L, from, c.spot, spot, to),
  }
}

describe('taller isométrico: coches parados en cada destino', () => {
  for (const [nBays, nCars] of [
    [4, 4],
    [4, 8],
    [4, 12],
    [8, 8],
    [8, 12],
    [12, 12],
    [12, 20],
  ] as const) {
    it(`${nBays} elevadores, ${nCars} coches: ninguna caja se solapa ni toca una columna`, () => {
      const L = computeFloorLayout(Array.from({ length: nBays }, (_, i) => i + 1))
      const statics = parkedStatics(L, carsFor(nBays, nCars))
      let min = Infinity
      for (let i = 0; i < statics.length; i++)
        for (let j = i + 1; j < statics.length; j++) min = Math.min(min, boxGap({ ...statics[i].pose, dims: statics[i].dims }, { ...statics[j].pose, dims: statics[j].dims }))
      expect(min).toBeGreaterThan(0.6)
      let obs = Infinity
      for (const s of statics) for (const o of floorObstacles(L)) obs = Math.min(obs, boxGap({ ...s.pose, dims: s.dims }, { x: o.x, z: o.z, heading: 0, dims: { length: o.hz * 2, width: o.hx * 2 } }))
      expect(obs).toBeGreaterThan(0.2)
    })
  }

  it('el destino más ocupado cabe en la plaza con el coche más grande en cualquier plaza', () => {
    const L = computeFloorLayout([1, 2, 3, 4])
    const big: CarDims = { length: CAR_MAX_L, width: CAR_MAX_W }
    const poses = [...L.bays.map((b) => ({ x: b.x, z: b.z, heading: Math.PI })), ...L.park.map((s) => ({ x: s.x, z: s.z, heading: 0 })), ...L.ready.map((s) => ({ x: s.x, z: s.z, heading: 0 }))]
    let min = Infinity
    for (let i = 0; i < poses.length; i++) for (let j = i + 1; j < poses.length; j++) min = Math.min(min, boxGap({ ...poses[i], dims: big }, { ...poses[j], dims: big }))
    expect(min).toBeGreaterThan(0.4)
  })
})

function check(plans: ReturnType<typeof planTraffic>, statics: StaticCar[], L: FloorLayout) {
  const a = analyzePlans(plans, statics, floorObstacles(L))
  // el planificador mira cada 0,05 s y aquí se mira cada 0,02 s: se deja una holgura pequeña
  expect(a.minCarGap).toBeGreaterThanOrEqual(MARGIN - 0.06)
  expect(a.minObstacleGap).toBeGreaterThanOrEqual(OBSTACLE_MARGIN - 0.06)
  expect(a.minFlowRatio).toBeGreaterThanOrEqual(1)
  return a
}

describe('taller isométrico: trayectorias sin choques (simulación sin WebGL)', () => {
  for (const n of [4, 8, 12]) {
    it(`entrada inicial de ${n} coches: en ningún fotograma dos coches se tocan ni se acercan a menos de su longitud`, () => {
      const L = computeFloorLayout([1, 2, 3, 4])
      const cars = carsFor(4, n)
      const movers = orderMovers(enteringMovers(L, cars))
      const plans = planTraffic(movers, [], floorObstacles(L))
      const a = check(plans, [], L)
      // cola ordenada: el orden de salida es el del plan (FIFO) y todos llegan a su plaza
      for (let i = 1; i < plans.length; i++) expect(plans[i].start).toBeGreaterThanOrEqual(plans[i - 1].start)
      for (const p of plans) {
        const end = poseAt(p, a.end + 1)
        const to = p.mover.to
        expect(Math.hypot(end.x - to.x, end.z - to.z)).toBeLessThan(0.01)
      }
      // y no tarda una eternidad: como mucho unos 2,3 s por coche de media
      expect(a.end).toBeLessThan(n * 2.3 + 4)
    })
  }

  it('los coches de cada carril circulan por su carril y entran alineados con la plaza', () => {
    const L = computeFloorLayout([1, 2, 3, 4])
    const cars = carsFor(4, 12)
    const plans = planTraffic(orderMovers(enteringMovers(L, cars)), [], floorObstacles(L))
    const o = { x: 0, z: 0, heading: 0, y: 0, scale: 1, visible: true, bay: null as number | null, moving: false }
    for (const p of plans) {
      // 1,2 m antes de llegar, el rumbo ya es el de la plaza (±12°)
      const tEnd = p.start + p.total
      let t = tEnd
      for (; t > p.start; t -= 0.02) {
        poseAt(p, t, o)
        if (Math.hypot(o.x - p.mover.to.x, o.z - p.mover.to.z) > 1.2) break
      }
      const diff = Math.abs(Math.atan2(Math.sin(o.heading - p.mover.to.heading), Math.cos(o.heading - p.mover.to.heading)))
      expect(diff).toBeLessThan((12 * Math.PI) / 180)
    }
  })

  it('reubicaciones reales: de elevador a entrega, de espera a elevador y cambio de altura, mientras el resto está parado', () => {
    const L = computeFloorLayout([1, 2, 3, 4])
    const cars = carsFor(4, 12)
    const byId = new Map(cars.map((c) => [c.id, c]))
    // el coche 1 (elevador 1) pasa a «Listo» y va a la entrega; el 6 (espera) sube a ese elevador; el 2 solo baja de altura
    const moves: Mover[] = [
      relocation(L, byId.get(1)!, { kind: 'ready', slot: 2 }, 'ready'),
      relocation(L, byId.get(6)!, { kind: 'bay', bay: 1 }, 'diagnosing'),
      relocation(L, byId.get(2)!, { kind: 'bay', bay: 2 }, 'received'),
    ]
    const moving = new Set(moves.map((m) => m.id))
    const statics = parkedStatics(L, cars).filter((s) => !moving.has(s.id))
    // la plaza de entrega 2 (destino del 1) estaba libre
    const plans = planTraffic(orderMovers(moves), statics, floorObstacles(L))
    check(plans, statics, L)
    // el 6 espera a que el 1 haya dejado el elevador 1
    const p1 = plans.find((p) => p.mover.id === 1)!
    const p6 = plans.find((p) => p.mover.id === 6)!
    expect(p6.start).toBeGreaterThan(p1.start)
  })

  it('cada elevador y cada plaza como origen y destino: sin choques con el resto parado (todas las carrocerías)', () => {
    const L = computeFloorLayout([1, 2, 3, 4])
    const cars = carsFor(4, 12)
    const spots = fillSpots(4)
    const free = spots.filter((s) => !cars.some((c) => spotKey(c.spot) === spotKey(s)))
    expect(free.length).toBeGreaterThan(0)
    let worst = Infinity
    for (const c of cars) {
      for (const dest of free) {
        const status: WorkOrderStatus = dest.kind === 'bay' ? 'in_progress' : dest.kind === 'ready' ? 'ready' : 'received'
        const m = relocation(L, c, dest, status)
        const statics = parkedStatics(L, cars).filter((s) => s.id !== c.id)
        const plans = planTraffic([m], statics, floorObstacles(L))
        const a = analyzePlans(plans, statics, floorObstacles(L), 0.05)
        worst = Math.min(worst, a.minCarGap)
        expect(a.minObstacleGap).toBeGreaterThanOrEqual(OBSTACLE_MARGIN - 0.06)
      }
    }
    expect(worst).toBeGreaterThanOrEqual(MARGIN - 0.06)
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
  it('las alturas de elevador son las del estado', () => {
    expect(LIFT_HEIGHT.in_progress).toBeGreaterThan(LIFT_HEIGHT.diagnosing)
    expect(LIFT_HEIGHT.ready).toBe(0)
  })
})
