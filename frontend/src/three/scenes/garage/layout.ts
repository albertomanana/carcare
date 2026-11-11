/**
 * Garaje isométrico para particulares: distribución, plazas estables y ruta de entrada. Lógica pura (sin React ni WebGL).
 *
 *   fondo (−z)   [muro con ventanas]
 *                ═══════ calzada ═══════ ← ENTRADA (por la derecha, +x)
 *   frente (+z)  P1   P2   P3   P4   P5   P6     ← una plaza por vehículo (máx. 6), de morro hacia el espectador
 *
 * Las plazas se anclan por la izquierda: añadir un vehículo añade una plaza a la derecha y no mueve a los demás. El
 * coche entra por la calzada y gira hacia su plaza con un arco (mismo planificador sin choques que el taller). La plaza
 * del coche seleccionado lleva una plataforma giratoria: la separación entre plazas deja sitio para que el coche gire.
 */
import type { GarageVehicle } from '../../types'
import { PORTAL_DX, quarter, R_TURN } from '../workshop/layout'
import type { Box, P2, Pose, Route } from '../workshop/motion'

export const MAX_SLOTS = 6
export const SLOT_PITCH = 4.6
export const SLOT_D = 5.8
export const LANE_W = 4.2
export const MARGIN = 0.9
export const WALL_H = 2.6
export const WALL_T = 0.32
export const SLAB_H = 0.5
export const APRON = 5.2
/** Radio de la plataforma giratoria y alto con el que sube el coche seleccionado. */
export const PAD_R = 2.55
export const PAD_H = 0.14

export interface GarageLayout {
  /** Número de plazas dibujadas (1…MAX_SLOTS). */
  n: number
  slots: { x: number; z: number }[]
  laneZ: number
  slotZ: number
  minX: number
  maxX: number
  apronX: number
  backZ: number
  frontZ: number
  entrance: { x: number; z: number }
}

export function computeGarageLayout(count: number): GarageLayout {
  const n = Math.min(MAX_SLOTS, Math.max(1, Math.round(count)))
  const minX = 0
  const maxX = 2 * MARGIN + n * SLOT_PITCH
  const backZ = 0
  const laneZ = 0.6 + LANE_W / 2
  const mouth = laneZ + LANE_W / 2 + 0.5
  const slotZ = mouth + SLOT_D / 2
  const frontZ = slotZ + SLOT_D / 2 + 1.2
  return {
    n,
    slots: Array.from({ length: n }, (_, k) => ({ x: MARGIN + SLOT_PITCH / 2 + k * SLOT_PITCH, z: slotZ })),
    laneZ,
    slotZ,
    minX,
    maxX,
    apronX: maxX + APRON,
    backZ,
    frontZ,
    entrance: { x: maxX + APRON - 1.2, z: laneZ },
  }
}

/** Pilares del pórtico de la entrada: los únicos obstáculos fijos por los que pasa un coche. */
export function garageObstacles(L: GarageLayout): Box[] {
  return [-1, 1].map((side) => ({ x: L.maxX + PORTAL_DX, z: L.laneZ + side * (LANE_W / 2 + 0.25), hx: 0.17, hz: 0.17 }))
}

export function slotPose(L: GarageLayout, slot: number): Pose | null {
  const s = L.slots[slot]
  return s ? { x: s.x, z: s.z, heading: 0, y: 0 } : null
}

export function entrancePose(L: GarageLayout): Pose {
  return { x: L.entrance.x, z: L.entrance.z, heading: -Math.PI / 2, y: 0 }
}

export const slotKey = (slot: number) => `slot-${slot}`

export function slotFromKey(key: string): number | null {
  const m = /^slot-(\d+)$/.exec(key)
  return m ? Number(m[1]) : null
}

/** Ruta de entrada: por la calzada hasta el arranque del arco y giro hacia la plaza, alineado al llegar. */
export function garageRoute(L: GarageLayout, toSlot: number): Route | null {
  const to = slotPose(L, toSlot)
  if (!to) return null
  const e: P2 = [L.entrance.x, L.laneZ]
  const a: P2 = [to.x + R_TURN, L.laneZ]
  const pts: P2[] = [e]
  if (e[0] - a[0] > 0.2) pts.push(a)
  pts.push(...quarter([a[0], L.laneZ + R_TURN], R_TURN, [0, -1], [-1, 0]))
  pts.push([to.x, to.z])
  return { reverse: null, forward: pts }
}

/**
 * Plazas estables: cada vehículo conserva la suya; los nuevos ocupan la plaza libre más baja. Solo se muestran
 * `MAX_SLOTS` (primero los que ya tenían plaza y después los nuevos, en el orden recibido).
 */
export function assignGarageSlots(ids: number[], prev: Map<number, number>): { slots: Map<number, number>; shown: number[]; hidden: number } {
  const slots = new Map<number, number>()
  const used = new Set<number>()
  const keep = ids.filter((id) => {
    const p = prev.get(id)
    return p !== undefined && p < MAX_SLOTS && !used.has(p) && (used.add(p), true)
  })
  const shown = [...keep]
  for (const id of keep) slots.set(id, prev.get(id)!)
  for (const id of ids) {
    if (slots.has(id) || shown.length >= MAX_SLOTS) continue
    let k = 0
    while (used.has(k)) k++
    used.add(k)
    slots.set(id, k)
    shown.push(id)
  }
  // los visibles, ordenados por plaza
  const order = [...slots.keys()].sort((x, y) => slots.get(x)! - slots.get(y)!)
  return { slots, shown: order, hidden: ids.length - shown.length }
}

export function sameGarageSlots(a: Map<number, number>, b: Map<number, number>): boolean {
  if (a.size !== b.size) return false
  for (const [k, v] of a) if (b.get(k) !== v) return false
  return true
}

/** Texto accesible de un vehículo: nombre y, si la tiene, matrícula entre paréntesis. */
export function vehicleAria(v: GarageVehicle): string {
  return v.plate ? `${v.name} (${v.plate})` : v.name
}
