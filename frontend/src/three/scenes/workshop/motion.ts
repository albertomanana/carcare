/**
 * Movimiento de los coches de las maquetas isométricas: trayectorias, planificador de tráfico y comprobación de
 * choques. Lógica pura (sin React ni WebGL; solo curvas de three y las curvas de easing de GSAP), así que lo que se
 * simula en los tests es exactamente lo que se ve: el controlador (`traffic.ts`) solo avanza un reloj y llama a
 * `poseAt`, y el planificador decide la hora de salida de cada coche simulando ese mismo `poseAt`.
 *
 * Reglas que garantiza `planTraffic` en cada instante (se comprueban a 20 muestras por segundo):
 *  R1. Dos coches cualesquiera (parados o en marcha) no se acercan a menos de `MARGIN` (caja orientada contra caja).
 *  R2. Un coche no se acerca a menos de `OBSTACLE_MARGIN` de un obstáculo fijo (columnas de elevador, pórtico…).
 *  R3. Dos coches en marcha que van en el mismo sentido por el mismo carril guardan entre centros una distancia de al
 *      menos la longitud del mayor (cola ordenada).
 * Una salida solo se retrasa (nunca se acorta una ruta): el que llega antes al destino sale antes (`orderMovers`).
 */
import gsap from 'gsap'
import * as THREE from 'three'

export interface Pose {
  x: number
  z: number
  /** Rumbo (rad): el morro apunta a (sin θ, cos θ) en (x, z). */
  heading: number
  /** Altura sobre el suelo (elevador subido, plataforma…). */
  y: number
}

export type P2 = [number, number]

export interface CarDims {
  length: number
  width: number
}

export interface Route {
  /** Marcha atrás para salir de la plaza, o null. */
  reverse: P2[] | null
  /** Trayecto hacia delante hasta el centro de la plaza de destino. */
  forward: P2[]
}

export interface Mover {
  id: number
  dims: CarDims
  /** Dónde está (o, si `entering`, dónde aparece). */
  from: Pose
  /** Clave de la plaza de la que sale ('entrance' si entra en escena). */
  fromKey: string
  /** true ⇒ no existe (invisible) hasta que arranca. */
  entering: boolean
  /** Elevador cuyo carro acompaña al coche en `from` (o null). */
  fromBay: number | null
  to: Pose
  toKey: string
  toBay: number | null
  /** null ⇒ no cambia de plaza: solo cambia la altura. */
  route: Route | null
}

export interface StaticCar {
  id: number
  dims: CarDims
  pose: Pose
}

/** Obstáculo fijo (caja alineada con los ejes, centro y semiejes). */
export interface Box {
  x: number
  z: number
  hx: number
  hz: number
}

export const MARGIN = 0.3
export const OBSTACLE_MARGIN = 0.12
export const DT = 0.05

// ───────────────────────── Easing (las de GSAP) ─────────────────────────

const inOut2 = gsap.parseEase('power2.inOut')
const inOut1 = gsap.parseEase('power1.inOut')
const out2 = gsap.parseEase('power2.out')

// ───────────────────────── Segmentos ─────────────────────────

type Seg =
  | { kind: 'lower'; dur: number; y0: number }
  | { kind: 'adjust'; dur: number; y0: number; y1: number }
  | { kind: 'reverse'; dur: number; curve: THREE.CatmullRomCurve3; length: number }
  | { kind: 'forward'; dur: number; curve: THREE.CatmullRomCurve3; length: number }
  | { kind: 'raise'; dur: number; y1: number }

export interface Plan {
  mover: Mover
  /** Hora de salida (s, en el reloj del plan). */
  start: number
  segs: Seg[]
  total: number
}

/** Subdivide los tramos largos: con pocos puntos, la curva se abomba entre dos esquinas y se sale del carril. */
function densify(pts: P2[], step = 1.8): P2[] {
  const out: P2[] = [pts[0]]
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]
    const b = pts[i]
    const n = Math.floor(Math.hypot(b[0] - a[0], b[1] - a[1]) / step)
    for (let k = 1; k <= n; k++) {
      const t = k / (n + 1)
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])
    }
    out.push(b)
  }
  return out
}

function curveOf(pts: P2[]): THREE.CatmullRomCurve3 {
  const c = new THREE.CatmullRomCurve3(
    densify(pts).map(([x, z]) => new THREE.Vector3(x, 0, z)),
    false,
    'centripetal',
  )
  c.arcLengthDivisions = 160
  return c
}

export function polyLength(pts: P2[]): number {
  let s = 0
  for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
  return s
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Duración de la marcha hacia delante (s): ~8 m/s de media, entre 1 y 3 s. */
export function driveDuration(length: number): number {
  return clamp(length / 8, 1, 3)
}

export function buildSegs(m: Mover): { segs: Seg[]; total: number } {
  const segs: Seg[] = []
  if (!m.route) {
    if (Math.abs(m.from.y - m.to.y) > 0.001) segs.push({ kind: 'adjust', dur: 0.8, y0: m.from.y, y1: m.to.y })
  } else {
    if (!m.entering && m.from.y > 0.001) segs.push({ kind: 'lower', dur: 0.55, y0: m.from.y })
    if (m.route.reverse) {
      const length = polyLength(m.route.reverse)
      segs.push({ kind: 'reverse', dur: clamp(length / 3.5, 0.8, 1.5), curve: curveOf(m.route.reverse), length })
    }
    const length = polyLength(m.route.forward)
    segs.push({ kind: 'forward', dur: driveDuration(length), curve: curveOf(m.route.forward), length })
    if (m.to.y > 0.001) segs.push({ kind: 'raise', dur: 0.75, y1: m.to.y })
  }
  return { segs, total: segs.reduce((s, g) => s + g.dur, 0) }
}

/** Duración de la aparición (escala 0,6 → 1) al entrar. */
const POP = 0.3

export interface PoseOut {
  x: number
  z: number
  heading: number
  y: number
  scale: number
  visible: boolean
  /** Elevador cuyo carro sigue al coche en este instante (null: ninguno). */
  bay: number | null
  /** true mientras el coche está en marcha (entre la salida y la llegada). */
  moving: boolean
}

export function newPoseOut(): PoseOut {
  return { x: 0, z: 0, heading: 0, y: 0, scale: 1, visible: true, bay: null, moving: false }
}

const _p = new THREE.Vector3()
const _t = new THREE.Vector3()

/** Posición del coche del plan en el instante `t` (s). Escribe en `out` y lo devuelve. */
export function poseAt(plan: Plan, t: number, out: PoseOut = newPoseOut()): PoseOut {
  const m = plan.mover
  const r = t - plan.start
  out.scale = 1
  out.visible = true
  out.moving = false
  if (r < 0) {
    out.x = m.from.x
    out.z = m.from.z
    out.heading = m.from.heading
    out.y = m.from.y
    out.bay = m.fromBay
    out.visible = !m.entering
    return out
  }
  if (r >= plan.total) {
    out.x = m.to.x
    out.z = m.to.z
    out.heading = m.to.heading
    out.y = m.to.y
    out.bay = m.toBay
    return out
  }
  out.moving = true
  if (m.entering && r < POP) out.scale = 0.6 + 0.4 * out2(r / POP)
  let acc = 0
  for (const g of plan.segs) {
    if (r < acc + g.dur || g === plan.segs[plan.segs.length - 1]) {
      const tau = clamp((r - acc) / g.dur, 0, 1)
      switch (g.kind) {
        case 'lower': {
          out.x = m.from.x
          out.z = m.from.z
          out.heading = m.from.heading
          out.y = g.y0 * (1 - inOut2(tau))
          out.bay = m.fromBay
          break
        }
        case 'adjust': {
          out.x = m.to.x
          out.z = m.to.z
          out.heading = m.to.heading
          out.y = g.y0 + (g.y1 - g.y0) * inOut2(tau)
          out.bay = m.toBay
          break
        }
        case 'reverse':
        case 'forward': {
          const u = clamp(g.kind === 'forward' ? inOut2(tau) : inOut1(tau), 0, 1)
          g.curve.getPointAt(u, _p)
          g.curve.getTangentAt(u, _t)
          out.x = _p.x
          out.z = _p.z
          out.heading = g.kind === 'forward' ? Math.atan2(_t.x, _t.z) : Math.atan2(-_t.x, -_t.z)
          out.y = 0
          out.bay = null
          break
        }
        case 'raise': {
          out.x = m.to.x
          out.z = m.to.z
          out.heading = m.to.heading
          out.y = g.y1 * out2(tau)
          out.bay = m.toBay
          break
        }
      }
      return out
    }
    acc += g.dur
  }
  return out
}

// ───────────────────────── Geometría de choques ─────────────────────────

interface Obb {
  x: number
  z: number
  /** Eje del morro. */
  fx: number
  fz: number
  hl: number
  hw: number
  /** Radio de la circunferencia que lo envuelve. */
  r: number
}

function obb(x: number, z: number, heading: number, dims: CarDims): Obb {
  const hl = dims.length / 2
  const hw = dims.width / 2
  return { x, z, fx: Math.sin(heading), fz: Math.cos(heading), hl, hw, r: Math.hypot(hl, hw) }
}

function boxObb(b: Box): Obb {
  return { x: b.x, z: b.z, fx: 0, fz: 1, hl: b.hz, hw: b.hx, r: Math.hypot(b.hx, b.hz) }
}

/** true si las dos cajas orientadas están a menos de `margin` (SAT con los 4 ejes). */
export function tooClose(a: Obb, b: Obb, margin: number): boolean {
  const dx = b.x - a.x
  const dz = b.z - a.z
  if (dx * dx + dz * dz > (a.r + b.r + margin) * (a.r + b.r + margin)) return false
  const axes: [number, number][] = [
    [a.fx, a.fz],
    [-a.fz, a.fx],
    [b.fx, b.fz],
    [-b.fz, b.fx],
  ]
  for (const [ax, az] of axes) {
    const ra = a.hl * Math.abs(a.fx * ax + a.fz * az) + a.hw * Math.abs(-a.fz * ax + a.fx * az)
    const rb = b.hl * Math.abs(b.fx * ax + b.fz * az) + b.hw * Math.abs(-b.fz * ax + b.fx * az)
    if (Math.abs(dx * ax + dz * az) > ra + rb + margin) return false
  }
  return true
}

/** Distancia mínima entre dos cajas orientadas (0 si se solapan), por muestreo de esquinas y bordes. Solo para tests. */
export function boxGap(a: { x: number; z: number; heading: number; dims: CarDims }, b: { x: number; z: number; heading: number; dims: CarDims }): number {
  const A = obb(a.x, a.z, a.heading, a.dims)
  const B = obb(b.x, b.z, b.heading, b.dims)
  if (!tooClose(A, B, 0)) {
    // separados: busca el margen más grande que aún los mantiene separados
    let lo = 0
    let hi = Math.hypot(B.x - A.x, B.z - A.z)
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2
      if (tooClose(A, B, mid)) hi = mid
      else lo = mid
    }
    return lo
  }
  return 0
}

// ───────────────────────── Planificador ─────────────────────────

/** Muestras de un plan en la rejilla de tiempo (para consultarlas sin recalcular curvas). */
interface Grid {
  plan: Plan
  k0: number
  n: number
  xs: Float32Array
  zs: Float32Array
  hs: Float32Array
}

function gridOf(plan: Plan): Grid {
  const k0 = Math.round(plan.start / DT)
  const n = Math.ceil(plan.total / DT) + 1
  const xs = new Float32Array(n)
  const zs = new Float32Array(n)
  const hs = new Float32Array(n)
  const o = newPoseOut()
  for (let i = 0; i < n; i++) {
    poseAt(plan, (k0 + i) * DT, o)
    xs[i] = o.x
    zs[i] = o.z
    hs[i] = o.heading
  }
  return { plan, k0, n, xs, zs, hs }
}

interface Sample {
  x: number
  z: number
  h: number
  visible: boolean
  moving: boolean
}

function sampleGrid(g: Grid, k: number, out: Sample): Sample {
  const m = g.plan.mover
  const i = k - g.k0
  if (i < 0) {
    out.x = m.from.x
    out.z = m.from.z
    out.h = m.from.heading
    out.visible = !m.entering
    out.moving = false
  } else if (i >= g.n) {
    out.x = m.to.x
    out.z = m.to.z
    out.h = m.to.heading
    out.visible = true
    out.moving = false
  } else {
    out.x = g.xs[i]
    out.z = g.zs[i]
    out.h = g.hs[i]
    out.visible = true
    out.moving = i < g.n - 1
  }
  return out
}

/** ¿Van los dos en el mismo sentido por el mismo carril? (R3) */
function sameFlow(a: Sample, b: Sample): boolean {
  if (Math.abs(a.z - b.z) > 1.2) return false
  // los rumbos pueden ser opuestos si uno va marcha atrás; compara la dirección de marcha por el rumbo (±60°)
  const d = Math.cos(a.h - b.h)
  return d > 0.5
}

const _a: Sample = { x: 0, z: 0, h: 0, visible: true, moving: false }
const _b: Sample = { x: 0, z: 0, h: 0, visible: true, moving: false }

/**
 * Coloca la hora de salida de cada mover (en el orden dado, FIFO: nadie sale antes que el anterior) en la primera hora
 * en que su trayecto completo no choca con nada. Devuelve los planes en el mismo orden.
 */
export function planTraffic(movers: Mover[], statics: StaticCar[], obstacles: Box[], opts: { maxStart?: number } = {}): Plan[] {
  const maxStart = opts.maxStart ?? 120
  const obstacleObbs = obstacles.map(boxObb)
  const staticObbs = statics.map((s) => ({ s, o: obb(s.pose.x, s.pose.z, s.pose.heading, s.dims) }))
  const grids: Grid[] = []
  const plans: Plan[] = []
  let lastStart = 0
  let maxEndK = 0
  const sample = { a: _a, b: _b }
  for (let i = 0; i < movers.length; i++) {
    const m = movers[i]
    const { segs, total } = buildSegs(m)
    const pending = movers.slice(i + 1).filter((p) => !p.entering)
    const pendingObbs = pending.map((p) => obb(p.from.x, p.from.z, p.from.heading, p.dims))
    const conflicts = (plan: Plan): boolean => {
      const g = gridOf(plan)
      const kEnd = Math.max(g.k0 + g.n, maxEndK) + 1
      for (let k = g.k0; k <= kEnd; k++) {
        const me = sampleGrid(g, k, sample.a)
        const meObb = obb(me.x, me.z, me.h, m.dims)
        for (const so of obstacleObbs) if (tooClose(meObb, so, OBSTACLE_MARGIN)) return true
        for (const st of staticObbs) if (tooClose(meObb, st.o, MARGIN)) return true
        for (const po of pendingObbs) if (tooClose(meObb, po, MARGIN)) return true
        for (const og of grids) {
          const o = sampleGrid(og, k, sample.b)
          if (!o.visible) continue
          const od = og.plan.mover.dims
          if (tooClose(meObb, obb(o.x, o.z, o.h, od), MARGIN)) return true
          if (me.moving && o.moving && sameFlow(me, o)) {
            if (Math.hypot(me.x - o.x, me.z - o.z) < Math.max(m.dims.length, od.length) + 0.2) return true
          }
        }
      }
      return false
    }
    let start = lastStart
    let plan: Plan = { mover: m, start, segs, total }
    if (total > 0) {
      let found = false
      for (; start <= maxStart; start = Math.round((start + 0.1) * 100) / 100) {
        plan = { mover: m, start, segs, total }
        if (!conflicts(plan)) {
          found = true
          break
        }
      }
      if (!found) {
        // no hay hueco (p. ej. dos coches que se esperan el uno al otro): el último, cuando todo lo demás haya acabado
        start = Math.max(lastStart, maxEndK * DT) + 0.3
        plan = { mover: m, start, segs, total }
      }
    }
    const g = gridOf(plan)
    grids.push(g)
    plans.push(plan)
    lastStart = start
    maxEndK = Math.max(maxEndK, g.k0 + g.n)
  }
  return plans
}

/**
 * Orden de salida: primero los que dejan una plaza que otro necesita (dependencias), luego los que ya estaban y por
 * último los que entran; entre iguales, el de ruta más corta primero («el que llega antes al destino sale antes»).
 */
export function orderMovers(movers: Mover[]): Mover[] {
  const len = (m: Mover) => (m.route ? polyLength(m.route.forward) + (m.route.reverse ? polyLength(m.route.reverse) : 0) : 0)
  const rank = (m: Mover) => (m.entering ? 2 : 1)
  const key = (a: Mover, b: Mover) => rank(a) - rank(b) || len(a) - len(b) || a.id - b.id
  const left = [...movers].sort(key)
  const out: Mover[] = []
  while (left.length) {
    // el primero cuya plaza de destino no la deja otro que aún no ha salido
    let idx = left.findIndex((m) => !left.some((o) => o !== m && o.fromKey === m.toKey && o.fromKey !== 'entrance'))
    if (idx < 0) idx = 0 // ciclo (intercambio de plazas): se rompe por el orden normal
    out.push(left.splice(idx, 1)[0])
  }
  return out
}

// ───────────────────────── Análisis (tests) ─────────────────────────

export interface Analysis {
  /** Distancia mínima entre cajas de dos coches cualesquiera en cualquier muestra (m). */
  minCarGap: number
  /** Distancia mínima de un coche a un obstáculo (m). */
  minObstacleGap: number
  /** Distancia mínima entre centros de dos coches en marcha en el mismo sentido y carril, dividida por la longitud del mayor. */
  minFlowRatio: number
  /** Instante en que acaba el último movimiento (s). */
  end: number
}

/**
 * Simula todo el plan sin WebGL y devuelve las distancias mínimas (rejilla de `dt` s, más fina que la del planificador).
 */
export function analyzePlans(plans: Plan[], statics: StaticCar[], obstacles: Box[], dt = 0.02): Analysis {
  const end = plans.reduce((e, p) => Math.max(e, p.start + p.total), 0)
  const o = newPoseOut()
  let minCarGap = Infinity
  let minObstacleGap = Infinity
  let minFlowRatio = Infinity
  const cars: { x: number; z: number; heading: number; dims: CarDims; moving: boolean; id: number }[] = []
  for (let t = 0; t <= end + 0.5; t += dt) {
    cars.length = 0
    for (const p of plans) {
      poseAt(p, t, o)
      if (o.visible) cars.push({ x: o.x, z: o.z, heading: o.heading, dims: p.mover.dims, moving: o.moving, id: p.mover.id })
    }
    for (const s of statics) cars.push({ x: s.pose.x, z: s.pose.z, heading: s.pose.heading, dims: s.dims, moving: false, id: s.id })
    for (let i = 0; i < cars.length; i++) {
      for (let j = i + 1; j < cars.length; j++) {
        const a = cars[i]
        const b = cars[j]
        if (Math.hypot(a.x - b.x, a.z - b.z) > 14) continue
        minCarGap = Math.min(minCarGap, boxGap(a, b))
        if (a.moving && b.moving && Math.abs(a.z - b.z) <= 1.2 && Math.cos(a.heading - b.heading) > 0.5) {
          minFlowRatio = Math.min(minFlowRatio, Math.hypot(a.x - b.x, a.z - b.z) / Math.max(a.dims.length, b.dims.length))
        }
      }
      for (const ob of obstacles) {
        const a = cars[i]
        minObstacleGap = Math.min(minObstacleGap, boxGap(a, { x: ob.x, z: ob.z, heading: 0, dims: { length: ob.hz * 2, width: ob.hx * 2 } }))
      }
    }
  }
  return { minCarGap, minObstacleGap, minFlowRatio, end }
}
