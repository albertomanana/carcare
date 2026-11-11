/**
 * Maqueta isométrica del taller: distribución de la nave, plazas estables y rutas por la calzada.
 * Lógica pura (sin React ni WebGL): se prueba con Vitest.
 *
 *   fondo (−z)   [muro]  E1  E2  E3  E4  …            ← elevadores, el coche entra de morro (mira a −z)
 *                ═══════ calzada ═══════════════ ← ENTRADA (por la derecha, +x)
 *   frente (+z)  P P P P P P   ·   L L L             ← espera (izquierda) y entrega (derecha, junto a la salida)
 *
 * Un coche solo cambia de sitio cuando cambia el estado real de su orden: entra, sube a un elevador, pasa a «Listo».
 */
import type { Bay, WorkOrder, WorkOrderStatus } from '@/api/types'

// ───────────────────────── Medidas (m) ─────────────────────────

export const BAY_W = 4.6
export const BAY_D = 6.6
export const LANE_W = 3.6
export const STALL_W = 2.65
export const STALL_D = 5.2
/** Explanada de la entrada, a la derecha de la nave. */
export const APRON = 4.6
export const MARGIN = 0.7
export const ZONE_GAP = 1.3
export const WALL_H = 2.2
export const WALL_T = 0.32
export const SLAB_H = 0.5
export const POST_H = 2.5

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

/** Posición de un coche: centro en planta, rumbo (rad, morro hacia (sin θ, cos θ) en x/z) y altura. */
export interface Pose {
  x: number
  z: number
  heading: number
  y: number
}

export type Spot = { kind: 'bay'; bay: number } | { kind: 'park'; slot: number } | { kind: 'ready'; slot: number }

export interface FloorLayout {
  bays: { number: number; x: number; z: number }[]
  park: { x: number; z: number }[]
  ready: { x: number; z: number }[]
  bayZ: number
  laneZ: number
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
  const laneZ = bayZ + BAY_D / 2 + 0.3 + LANE_W / 2
  const stallZ = laneZ + LANE_W / 2 + 0.3 + STALL_D / 2
  const backZ = bayZ - BAY_D / 2 - 0.7
  const frontZ = stallZ + STALL_D / 2 + 1.5

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

export function entrancePose(L: FloorLayout): Pose {
  return { x: L.entrance.x, z: L.entrance.z, heading: -Math.PI / 2, y: 0 }
}

export type P2 = [number, number]

export interface Route {
  /** Marcha atrás para salir de la plaza (el morro mira al contrario de la marcha), o null. */
  reverse: P2[] | null
  /** Trayecto hacia delante por la calzada hasta el centro de la plaza de destino. */
  forward: P2[]
}

function mouthZ(L: FloorLayout, spot: Spot): number {
  return spot.kind === 'bay' ? L.bayZ + BAY_D / 2 + 0.1 : L.stallZ - STALL_D / 2 - 0.1
}

/**
 * Ruta de `from` (pose actual; `fromSpot` = plaza en la que está aparcado, 'entrance' o null si va de camino)
 * a la plaza `to`. Sale marcha atrás girando hacia el lado contrario del destino, recorre la calzada y entra de morro.
 */
export function planRoute(L: FloorLayout, from: Pose, fromSpot: Spot | 'entrance' | null, to: Spot, toPose: Pose): Route {
  const lane = L.laneZ
  let reverse: P2[] | null = null
  let start: P2
  let d: number
  const pts: P2[] = []

  if (fromSpot && fromSpot !== 'entrance') {
    const dx = toPose.x - from.x
    d = Math.abs(dx) < 0.3 ? (toPose.x > (L.minX + L.maxX) / 2 ? -1 : 1) : Math.sign(dx)
    const side = Math.sign(from.z - lane) || -1
    const mz = mouthZ(L, fromSpot)
    start = [from.x - d * 2.5, lane]
    reverse = [[from.x, from.z], [from.x, mz], [from.x - d * 0.9, lane + side * 0.55], start]
    pts.push(start)
  } else if (fromSpot === 'entrance') {
    d = -1
    start = [from.x, from.z]
    pts.push(start, [L.maxX + 0.4, lane])
  } else {
    // a mitad de camino: sigue de frente un poco y continúa
    const lead: P2 = [from.x + Math.sin(from.heading) * 1.2, from.z + Math.cos(from.heading) * 1.2]
    d = Math.sign(toPose.x - lead[0]) || 1
    start = [from.x, from.z]
    pts.push(start, lead)
  }

  const last = () => pts[pts.length - 1]
  const dside = Math.sign(toPose.z - lane) || 1
  const approach: P2 = [toPose.x - d * 2.7, lane]
  if (d * (approach[0] - last()[0]) > 0.6) pts.push(approach)
  const turn: P2 = [toPose.x - d * 0.75, lane + dside * 0.95]
  if (d * (turn[0] - last()[0]) > 0.25) pts.push(turn)
  pts.push([toPose.x, mouthZ(L, to)], [toPose.x, toPose.z])
  return { reverse, forward: pts }
}

/** Longitud aproximada de una polilínea (para la duración del trayecto). */
export function polyLength(pts: P2[]): number {
  let s = 0
  for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
  return s
}

/** Duración de la marcha (s): ~8 m/s de maqueta, entre 1 y 3 s. */
export function driveDuration(length: number): number {
  return clamp(length / 8, 1, 3)
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
