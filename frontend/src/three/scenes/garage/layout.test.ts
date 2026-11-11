import { describe, expect, it } from 'vitest'
import type { BodyType } from '@/api/types'
import { getCarBuild } from '../../car/build'
import { BODY_SPECS } from '../../car/specs'
import { analyzePlans, boxGap, MARGIN, OBSTACLE_MARGIN, orderMovers, planTraffic, poseAt, type CarDims, type Mover } from '../workshop/motion'
import { CAR_MAX_L, CAR_MAX_W } from '../workshop/layout'
import { assignGarageSlots, computeGarageLayout, entrancePose, garageObstacles, garageRoute, MAX_SLOTS, PAD_R, slotKey, slotPose } from './layout'

const BODIES = Object.keys(BODY_SPECS) as BodyType[]
const dimsOf = (b: BodyType): CarDims => {
  const s = getCarBuild(b, 'clay').size
  return { length: s.length, width: s.width }
}

function movers(n: number, offset = 0): Mover[] {
  const L = computeGarageLayout(n)
  return Array.from({ length: n }, (_, k) => {
    const to = slotPose(L, k)!
    return {
      id: k + 1,
      dims: dimsOf(BODIES[(k + offset) % BODIES.length]),
      from: entrancePose(L),
      fromKey: 'entrance',
      entering: true,
      fromBay: null,
      to,
      toKey: slotKey(k),
      toBay: null,
      route: garageRoute(L, k),
    }
  })
}

describe('garaje isométrico: distribución', () => {
  it('una plaza por vehículo (1 a 6), ancladas por la izquierda', () => {
    for (let n = 1; n <= MAX_SLOTS; n++) {
      const L = computeGarageLayout(n)
      expect(L.slots).toHaveLength(n)
    }
    const a = computeGarageLayout(2)
    const b = computeGarageLayout(5)
    expect(b.slots[0].x).toBe(a.slots[0].x)
    expect(b.slots[1].x).toBe(a.slots[1].x)
    expect(computeGarageLayout(9).n).toBe(MAX_SLOTS)
  })

  it('con 6 plazas, un coche girando sobre su plataforma no toca a los vecinos ni a las paredes', () => {
    const L = computeGarageLayout(6)
    const big: CarDims = { length: CAR_MAX_L, width: CAR_MAX_W }
    for (let k = 0; k < 6; k++) {
      const s = L.slots[k]
      for (let a = 0; a < Math.PI; a += 0.05) {
        for (const j of [k - 1, k + 1]) {
          if (j < 0 || j >= 6) continue
          expect(boxGap({ x: s.x, z: s.z, heading: a, dims: big }, { x: L.slots[j].x, z: L.slots[j].z, heading: 0, dims: big })).toBeGreaterThan(0.15)
        }
      }
      expect(s.x - PAD_R).toBeGreaterThan(L.minX + 0.2)
      expect(Math.hypot(CAR_MAX_L / 2, CAR_MAX_W / 2)).toBeLessThan(s.z - L.laneZ - 2.1 + 0.6)
    }
  })

  it('las plazas se conservan al añadir y quitar vehículos', () => {
    const first = assignGarageSlots([10, 11, 12], new Map())
    expect([...first.slots.entries()]).toEqual([[10, 0], [11, 1], [12, 2]])
    const second = assignGarageSlots([10, 12, 13], first.slots)
    expect(second.slots.get(10)).toBe(0)
    expect(second.slots.get(12)).toBe(2)
    expect(second.slots.get(13)).toBe(1)
    const many = assignGarageSlots(Array.from({ length: 9 }, (_, i) => i + 1), new Map())
    expect(many.shown).toHaveLength(6)
    expect(many.hidden).toBe(3)
  })
})

describe('garaje isométrico: entrada sin choques (simulación sin WebGL)', () => {
  for (const n of [1, 2, 3, 4, 5, 6]) {
    it(`${n} ${n === 1 ? 'coche entra' : 'coches entran'} en cola sin tocarse ni rozar el pórtico`, () => {
      const L = computeGarageLayout(n)
      const plans = planTraffic(orderMovers(movers(n)), [], garageObstacles(L))
      const a = analyzePlans(plans, [], garageObstacles(L))
      expect(a.minCarGap).toBeGreaterThanOrEqual(MARGIN - 0.06)
      expect(a.minObstacleGap).toBeGreaterThanOrEqual(OBSTACLE_MARGIN - 0.06)
      expect(a.minFlowRatio).toBeGreaterThanOrEqual(1)
      // todos acaban en su plaza, alineados con ella
      for (const p of plans) {
        const end = poseAt(p, a.end + 1)
        expect(Math.hypot(end.x - p.mover.to.x, end.z - p.mover.to.z)).toBeLessThan(0.01)
        expect(Math.abs(Math.sin(end.heading))).toBeLessThan(0.02)
      }
      expect(a.end).toBeLessThan(n * 2.4 + 3)
    })
  }

  it('desde cada carrocería (peor caso con un solo coche): sin choques con los demás ya aparcados', () => {
    const L = computeGarageLayout(6)
    for (let k = 0; k < 6; k++) {
      const m = movers(6, k)[k]
      const statics = movers(6, k)
        .filter((o) => o.id !== m.id)
        .map((o) => ({ id: o.id, dims: o.dims, pose: o.to }))
      const plans = planTraffic([m], statics, garageObstacles(L))
      const a = analyzePlans(plans, statics, garageObstacles(L), 0.04)
      expect(a.minCarGap).toBeGreaterThanOrEqual(MARGIN - 0.06)
    }
  })
})
