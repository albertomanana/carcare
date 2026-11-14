/**
 * Maqueta isométrica del taller: distribución de la nave, plazas estables y rutas por la calzada.
 * Lógica pura (sin React ni WebGL): se prueba con Vitest.
 *
 *   fondo (−z)   [muro]  E1  E2  E3  E4  …            ← elevadores, el coche entra de morro (mira a −z)
 *                ═══ carril N ═══ calzada ═══ carril S ═══ ← ENTRADA (por la derecha, +x)
 *   frente (+z)  P P P P P P   ·   L L L             ← espera (izquierda) y entrega (derecha, junto a la salida)
 *
 * La calzada tiene dos carriles: los coches que van a un elevador circulan por el N (lado de los elevadores) y los que
 * van a la espera o a la entrega, por el S. Cada giro a una plaza es un arco de radio fijo: el coche llega alineado.
 * Un coche solo cambia de sitio cuando cambia el estado real de su orden: entra, sube a un elevador, pasa a «Listo».
 */
import type { Bay, WorkOrder, WorkOrderStatus } from '@/api/types'
import type { Box, P2, Pose, Route } from './motion'

// ───────────────────────── Medidas (m) ─────────────────────────

/** Los coches reales de las 9 carrocerías miden como máximo 5,35 × 2,02 m (se comprueba en los tests). */
export const CAR_MAX_L = 5.4
export const CAR_MAX_W = 2.05

export const BAY_W = 4.6
export const BAY_D = 6.6
export const LANE_W = 4.8
/** Separación del eje de cada carril respecto al eje de la calzada. */
export const LANE_OFF = 1.2
export const STALL_W = 3.1
export const STALL_D = 5.8
/** Explanada de la entrada, a la derecha de la nave. */
export const APRON = 4.6
export const MARGIN = 0.7
export const ZONE_GAP = 1.3
export const WALL_H = 2.2
export const WALL_T = 0.32
export const SLAB_H = 0.5
export const POST_H = 2.5
/** Separación de las columnas del elevador respecto a su centro. */
export const POST_X = 1.62
/** Hueco entre la boca de un elevador y el borde de la calzada: el coche termina el giro antes de llegar a las columnas. */
export const LANE_GAP = 1.5
/** Hueco entre el borde de la calzada y la boca de las plazas de espera y entrega (margen para incorporarse en diagonal). */
export const STALL_GAP = 0.9
/** Longitud de la incorporación diagonal de un carril a otro. */
export const MERGE = 3.6
/** Radio del giro hacia una plaza de espera o entrega, hacia un elevador, y de la marcha atrás al salir. */
export const R_TURN = 3.4
export const R_BAY = 2.6
export const R_REV = 2.2
/** Distancia del pórtico de la entrada al borde de la nave (hacia la explanada): fuera de la zona de giro. */
export const PORTAL_DX = 2.9

/** Altura del coche sobre el elevador según el estado (m): en reparación o esperando piezas, arriba. */
export const LIFT_HEIGHT: Record<WorkOrderStatus, number> = {
  received: 0,
  diagnosing: 0.5,
  waiting_parts: 1.1,
  in_progress: 1.1,
  ready: 0,
  delivered: 0,
  cancelled: 0,
}

// ───────────────────────── Tipos ─────────────────────────

export type Spot = { kind: 'bay'; bay: number } | { kind: 'park'; slot: number } | { kind: 'ready'; slot: number }

export interface FloorLayout {
  bays: { number: number; x: number; z: number }[]
  park: { x: number; z: number }[]
  ready: { x: number; z: number }[]
  bayZ: number
  laneZ: number
  /** Eje del carril de los elevadores (lado del fondo). */
  laneN: number
  /** Eje del carril de la espera y la entrega (lado del frente). */
  laneS: number
  stallZ: number
  /** Borde interior izquierdo (cara del muro). */
  minX: number
  /** Borde derecho de la nave (empieza la explanada de la entrada). */
  maxX: number
  /** Borde exterior de la explanada. */
  apronX: number
  backZ: number
  frontZ: number
  /** Donde aparece un coche que entra (sobre la explanada, mirando hacia la nave). */
  entrance: { x: number; z: number }
  /** Tramos en x de cada zona del frente (para los rótulos del suelo). */
  zones: { park: [number, number]; ready: [number, number] }
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Plazas de espera y de entrega: dependen solo del número de elevadores (estables mientras no cambie). */
export function slotCapacity(nBays: number): { park: number; ready: number } {
  return { park: clamp(nBays + 2, 4, 8), ready: clamp(Math.ceil(nBays / 2) + 1, 2, 4) }
}

export function computeFloorLayout(bayNumbers: number[]): FloorLayout {
  const n = Math.max(1, bayNumbers.length)
  const cap = slotCapacity(bayNumbers.length)
  const bayRow = n * BAY_W
  const frontRow = cap.park * STALL_W + ZONE_GAP + cap.ready * STALL_W
  const inner = Math.max(bayRow, frontRow, 3 * BAY_W) + 2 * MARGIN
  const minX = -inner / 2
  const maxX = inner / 2

  const bayZ = 0
  const laneZ = bayZ + BAY_D / 2 + LANE_GAP + LANE_W / 2
  const stallZ = laneZ + LANE_W / 2 + STALL_GAP + STALL_D / 2
  const backZ = bayZ - BAY_D / 2 - 0.7
  const frontZ = stallZ + STALL_D / 2 + 1.0

  const bx0 = minX + MARGIN + (inner - 2 * MARGIN - bayRow) / 2 + BAY_W / 2
  const bays = bayNumbers.map((number, i) => ({ number, x: bx0 + i * BAY_W, z: bayZ }))
  const px0 = minX + MARGIN + STALL_W / 2
  const park = Array.from({ length: cap.park }, (_, k) => ({ x: px0 + k * STALL_W, z: stallZ }))
  const rx1 = maxX - MARGIN - STALL_W / 2
  const ready = Array.from({ length: cap.ready }, (_, k) => ({ x: rx1 - (cap.ready - 1 - k) * STALL_W, z: stallZ }))

  return {
    bays,
    park,
    ready,
    bayZ,
    laneZ,
    laneN: laneZ - LANE_OFF,
    laneS: laneZ + LANE_OFF,
    stallZ,
    minX,
    maxX,
    apronX: maxX + APRON,
    backZ,
    frontZ,
    entrance: { x: maxX + APRON - 1.2, z: laneZ },
    zones: {
      park: [px0 - STALL_W / 2, px0 + (cap.park - 0.5) * STALL_W],
      ready: [rx1 - (cap.ready - 0.5) * STALL_W, rx1 + STALL_W / 2],
    },
  }
}

/** Radio en planta de la figura del mecánico (m). */
export const MECHANIC_R = 0.24

/**
 * Dónde trabaja el mecánico de un elevador: al lado del coche que da a la cámara (+x), por delante de la columna (+z),
 * mirando al coche. Queda fuera del ancho del coche más ancho y fuera de la base de la columna (se comprueba en los tests).
 */
export function mechanicSpot(bay: { x: number; z: number }): { x: number; z: number; heading: number } {
  return { x: bay.x + CAR_MAX_W / 2 + MECHANIC_R + 0.08, z: bay.z + 1.3, heading: -Math.PI / 2 }
}

/** Obstáculos fijos por los que no puede pasar un coche: bases de las columnas de los elevadores y pilares del pórtico. */
export function floorObstacles(L: FloorLayout): Box[] {
  const out: Box[] = []
  for (const b of L.bays) for (const side of [-1, 1]) out.push({ x: b.x + side * POST_X, z: b.z, hx: 0.33, hz: 0.37 })
  for (const side of [-1, 1]) out.push({ x: L.maxX + PORTAL_DX, z: L.laneZ + side * (LANE_W / 2 + 0.25), hx: 0.17, hz: 0.17 })
  return out
}

// ───────────────────────── Plazas estables ─────────────────────────

export interface CarSlot {
  order: WorkOrder
  spot: Spot
}

export interface Assignment {
  cars: CarSlot[]
  /** id de orden → plaza de espera o de entrega (para conservarla en la siguiente actualización). */
  slots: Map<number, Spot>
  /** Órdenes sin elevador que no caben en su zona (se cuentan en la leyenda). */
  overflow: { park: number; ready: number }
}

/**
 * Coloca cada orden: la de un elevador, en su elevador; sin elevador, «Listo» ⇒ entrega y el resto ⇒ espera.
 * Las plazas se conservan entre actualizaciones (`prev`): un coche no se mueve porque otro se vaya.
 * Las nuevas ocupan la plaza libre más baja, en el orden de `waiting` (fuera de plazo y urgentes primero).
 */
export function assignSpots(bays: Bay[], waiting: WorkOrder[], cap: { park: number; ready: number }, prev: Map<number, Spot>): Assignment {
  const cars: CarSlot[] = []
  const seen = new Set<number>()
  for (const b of bays) {
    if (b.work_order && !seen.has(b.work_order.id)) {
      seen.add(b.work_order.id)
      cars.push({ order: b.work_order, spot: { kind: 'bay', bay: b.number } })
    }
  }
  const pending = waiting.filter((o) => !seen.has(o.id))
  const slots = new Map<number, Spot>()
  const used = { park: new Set<number>(), ready: new Set<number>() }
  const zoneOf = (o: WorkOrder): 'park' | 'ready' => (o.status === 'ready' ? 'ready' : 'park')

  // 1) conservan su plaza las que siguen en la misma zona
  const fresh: WorkOrder[] = []
  for (const o of pending) {
    const z = zoneOf(o)
    const p = prev.get(o.id)
    if (p && p.kind === z && p.slot < cap[z] && !used[z].has(p.slot)) {
      used[z].add(p.slot)
      slots.set(o.id, p)
    } else fresh.push(o)
  }
  // 2) las nuevas (o que cambian de zona), en la plaza libre más baja
  const overflow = { park: 0, ready: 0 }
  for (const o of fresh) {
    const z = zoneOf(o)
    let k = 0
    while (used[z].has(k)) k++
    if (k >= cap[z]) {
      overflow[z]++
      continue
    }
    used[z].add(k)
    slots.set(o.id, { kind: z, slot: k })
  }
  for (const o of pending) {
    const s = slots.get(o.id)
    if (s) cars.push({ order: o, spot: s })
  }
  return { cars, slots, overflow }
}

export function sameSpot(a: Spot | null, b: Spot | null): boolean {
  if (!a || !b) return a === b
  if (a.kind !== b.kind) return false
  return a.kind === 'bay' ? a.bay === (b as { bay: number }).bay : a.slot === (b as { slot: number }).slot
}

/** Inversa de `spotKey` ('bay-2', 'park-0', 'ready-1'); null si la clave no es de una plaza. */
export function spotFromKey(key: string): Spot | null {
  const m = /^(bay|park|ready)-(\d+)$/.exec(key)
  if (!m) return null
  return m[1] === 'bay' ? { kind: 'bay', bay: Number(m[2]) } : { kind: m[1] as 'park' | 'ready', slot: Number(m[2]) }
}

export function spotKey(s: Spot): string {
  return s.kind === 'bay' ? `bay-${s.bay}` : `${s.kind}-${s.slot}`
}

// ───────────────────────── Posiciones y rutas ─────────────────────────

/** Centro y rumbo de una plaza. Elevador: de morro hacia el muro (θ = π). Espera y entrega: de morro al frente (θ = 0). */
export function spotPose(L: FloorLayout, spot: Spot, status: WorkOrderStatus): Pose | null {
  if (spot.kind === 'bay') {
    const b = L.bays.find((x) => x.number === spot.bay)
    return b ? { x: b.x, z: b.z, heading: Math.PI, y: LIFT_HEIGHT[status] } : null
  }
  const s = (spot.kind === 'park' ? L.park : L.ready)[spot.slot]
  return s ? { x: s.x, z: s.z, heading: 0, y: 0 } : null
}

/** Dónde aparece un coche que entra: ya en el carril de su destino (carril N para un elevador, S para espera y entrega). */
export function entrancePose(L: FloorLayout, to: Spot): Pose {
  return { x: L.entrance.x, z: to.kind === 'bay' ? L.laneN : L.laneS, heading: -Math.PI / 2, y: 0 }
}

/** Puntos de un cuarto de circunferencia (sin el primero): centro `c`, radio `r`, del vector `from` al `to` (perpendiculares). */
export function quarter(c: P2, r: number, from: P2, to: P2, n = 6): P2[] {
  const out: P2[] = []
  for (let i = 1; i <= n; i++) {
    const t = (i / n) * (Math.PI / 2)
    const a = Math.cos(t)
    const b = Math.sin(t)
    out.push([c[0] + r * (from[0] * a + to[0] * b), c[1] + r * (from[1] * a + to[1] * b)])
  }
  return out
}

/** Ruta hacia delante desde `e` (rumbo `d` = ±1 en x) hasta el centro de la plaza `to`, entrando con un arco alineado. */
function forwardRoute(L: FloorLayout, e: P2, d: -1 | 1, to: Spot, toPose: Pose): P2[] {
  const laneD = to.kind === 'bay' ? L.laneN : L.laneS
  const side = to.kind === 'bay' ? -1 : 1
  const R = to.kind === 'bay' ? R_BAY : R_TURN
  const pts: P2[] = [e]
  const a: P2 = [toPose.x - d * R, laneD]
  const merge: P2 = [e[0] + d * MERGE, laneD]
  if (Math.abs(e[1] - laneD) > 0.05 && d * (a[0] - merge[0]) > 0.2) pts.push(merge)
  if (d * (a[0] - pts[pts.length - 1][0]) > 0.2) pts.push(a)
  // arco: centro a `side` del eje del carril; sale en la dirección d y llega en la dirección de la plaza
  const o: P2 = [a[0], laneD + side * R]
  pts.push(...quarter(o, R, [0, -side], [d, 0]))
  pts.push([toPose.x, toPose.z])
  return pts
}

/**
 * Ruta de `from` (pose en reposo) a la plaza `to`. Desde 'entrance' entra por el pórtico y se incorpora a su carril.
 * Desde una plaza sale marcha atrás con un arco hacia el lado del destino, y puede seguir retrocediendo por la calzada
 * si hace falta sitio para el giro de entrada.
 */
export function planRoute(L: FloorLayout, from: Pose, fromSpot: Spot | 'entrance', to: Spot, toPose: Pose): Route {
  if (fromSpot === 'entrance') return { reverse: null, forward: forwardRoute(L, [from.x, from.z], -1, to, toPose) }
  const sgn = fromSpot.kind === 'bay' ? 1 : -1
  const dx = toPose.x - from.x
  const d: -1 | 1 = Math.abs(dx) < 0.3 ? (toPose.x > (L.minX + L.maxX) / 2 ? -1 : 1) : dx > 0 ? 1 : -1
  const zs = L.laneZ - sgn * R_REV
  const o: P2 = [from.x - d * R_REV, zs]
  const rev: P2[] = [[from.x, from.z], [from.x, zs]]
  rev.push(...quarter(o, R_REV, [d, 0], [0, sgn]))
  let e: P2 = [from.x - d * R_REV, L.laneZ]
  // sitio para incorporarse al carril y empezar el arco de entrada
  const a = toPose.x - d * (to.kind === 'bay' ? R_BAY : R_TURN)
  const extra = Math.max(0, MERGE + 0.2 - d * (a - e[0]))
  if (extra > 0) {
    e = [e[0] - d * extra, L.laneZ]
    rev.push(e)
  }
  return { reverse: rev, forward: forwardRoute(L, e, d, to, toPose) }
}

// ───────────────────────── Color de maqueta ─────────────────────────

/** Azul, amarillo, blanco y rojo de maqueta para los coches sin color registrado (fijo por id). */
export const CLAY_FALLBACKS = ['#5b84d6', '#e9c454', '#efede7', '#d45d48'] as const

function hexToHsl(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1, 7), 16)
  const r = ((n >> 16) & 255) / 255
  const g = ((n >> 8) & 255) / 255
  const b = (n & 255) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  h /= 6
  return [h, s, l]
}

function hslToHex(h: number, s: number, l: number): string {
  const f = (n: number) => {
    const k = (n + h * 12) % 12
    const a = s * Math.min(l, 1 - l)
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(c * 255)
      .toString(16)
      .padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

/**
 * Pintura real llevada a tono de arcilla: un poco menos saturada y sin negros ni blancos puros, para que la forma se
 * lea con la luz. Sin color registrado ⇒ uno de los cuatro de maqueta, fijo por id de vehículo.
 */
export function clayColor(colorHex: string | null | undefined, vehicleId: number): string {
  const ok = !!colorHex && /^#?[0-9a-f]{6}$/i.test(colorHex.trim())
  if (!ok) return CLAY_FALLBACKS[Math.abs(vehicleId) % CLAY_FALLBACKS.length]
  const hex = `#${colorHex!.trim().replace('#', '').toLowerCase()}`
  const [h, s, l] = hexToHsl(hex)
  return hslToHex(h, s * 0.85, clamp(l, 0.2, 0.88))
}
