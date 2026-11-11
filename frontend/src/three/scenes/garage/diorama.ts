/**
 * Piezas del garaje isométrico construidas en CPU y fusionadas (pocos draw calls): nave estática, marcas del suelo,
 * rótulos del suelo (números de plaza y ENTRADA) y plataforma giratoria. Misma paleta y materiales que el taller.
 */
import * as THREE from 'three'
import { mixHex } from '../../color'
import { atlasDecals, colored, cyl, mergeAndDispose, rbox, strip, type DecalItem, type Decals, type DioramaPalette } from '../workshop/diorama'
import { PORTAL_DX } from '../workshop/layout'
import { LANE_W, PAD_H, PAD_R, SLAB_H, SLOT_D, SLOT_PITCH, WALL_H, WALL_T, type GarageLayout } from './layout'

export function buildGarageStatic(L: GarageLayout, pal: DioramaPalette): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  const x0 = L.minX - WALL_T
  const x1 = L.apronX
  const z0 = L.backZ - WALL_T
  const z1 = L.frontZ
  // Losa de la maqueta (la cara de arriba en y = 0)
  parts.push(colored(rbox(x1 - x0 + 0.6, SLAB_H, z1 - z0 + 0.6, 0.22, (x0 + x1) / 2, -SLAB_H / 2, (z0 + z1) / 2, 4), pal.slab))
  // Muro del fondo (con ventanas sobre cada plaza) y muro izquierdo
  const backLen = L.maxX - x0 + 0.1
  parts.push(colored(rbox(backLen, WALL_H, WALL_T, 0.08, x0 + backLen / 2, WALL_H / 2, L.backZ - WALL_T / 2), pal.wall))
  const sideLen = z1 - z0 - 0.4
  parts.push(colored(rbox(WALL_T, WALL_H, sideLen, 0.08, L.minX - WALL_T / 2, WALL_H / 2, z0 + sideLen / 2), pal.wall))
  parts.push(colored(rbox(backLen + 0.04, 0.14, WALL_T + 0.06, 0.05, x0 + backLen / 2, WALL_H, L.backZ - WALL_T / 2), pal.propDark))
  parts.push(colored(rbox(WALL_T + 0.06, 0.14, sideLen + 0.04, 0.05, L.minX - WALL_T / 2, WALL_H, z0 + sideLen / 2), pal.propDark))
  const win = mixHex(pal.wall, pal.hemiSky, 0.55)
  for (const s of L.slots) {
    parts.push(colored(rbox(2.3, 1.05, 0.12, 0.05, s.x, 1.55, L.backZ + 0.02), pal.propDark))
    parts.push(colored(rbox(2.1, 0.85, 0.06, 0.04, s.x, 1.55, L.backZ + 0.09, 1), win))
    parts.push(colored(rbox(0.07, 0.85, 0.08, 0.02, s.x, 1.55, L.backZ + 0.11, 1), pal.propDark))
  }
  // Pórtico de la entrada (dos pilares y dintel), fuera de la zona de giro
  for (const side of [-1, 1]) {
    parts.push(colored(rbox(0.34, 2.6, 0.34, 0.08, L.maxX + PORTAL_DX, 1.3, L.laneZ + side * (LANE_W / 2 + 0.25)), pal.post))
  }
  parts.push(colored(rbox(0.4, 0.3, LANE_W + 0.9, 0.08, L.maxX + PORTAL_DX, 2.62, L.laneZ), pal.postDark))
  // Atrezo junto al muro: armario de herramientas, estante y neumáticos (lejos del camino de los coches)
  const z = L.backZ + 0.32
  parts.push(colored(rbox(0.9, 1.0, 0.5, 0.06, L.minX + 0.75, 0.5, z), pal.prop))
  parts.push(colored(rbox(0.94, 0.06, 0.54, 0.02, L.minX + 0.75, 1.03, z, 1), pal.propDark))
  for (const dy of [0.28, 0.55, 0.8]) parts.push(colored(rbox(0.8, 0.03, 0.02, 0.01, L.minX + 0.75, dy, z + 0.26, 1), pal.propDark))
  parts.push(colored(rbox(0.9, 1.0, 0.5, 0.06, L.maxX - 0.75, 0.5, z), pal.prop))
  parts.push(colored(rbox(0.94, 0.06, 0.54, 0.02, L.maxX - 0.75, 1.03, z, 1), pal.propDark))
  for (let k = 0; k < 3; k++) parts.push(colored(cyl(0.34, 0.22, L.minX + 2.0, 0.11 + k * 0.23, L.backZ + 0.55), pal.tyre))
  return mergeAndDispose(parts)
}

export function buildGarageMarkings(L: GarageLayout, pal: DioramaPalette): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  const lx0 = L.minX + 0.2
  const lx1 = L.apronX - 0.2
  parts.push(colored(strip(lx1 - lx0, LANE_W, (lx0 + lx1) / 2, L.laneZ, 0.004), pal.lane))
  for (let x = lx0 + 0.8; x < lx1 - 0.8; x += 1.6) parts.push(colored(strip(0.8, 0.09, x + 0.4, L.laneZ), pal.line))
  for (const side of [-1, 1]) parts.push(colored(strip(lx1 - lx0, 0.06, (lx0 + lx1) / 2, L.laneZ + side * (LANE_W / 2 - 0.08)), pal.line))
  // Plazas: dos laterales y la línea de fondo
  const top = L.slotZ - SLOT_D / 2
  for (const s of L.slots) {
    for (const side of [-1, 1]) parts.push(colored(strip(0.07, SLOT_D - 0.3, s.x + side * (SLOT_PITCH / 2 - 0.25), L.slotZ + 0.15), pal.line))
    parts.push(colored(strip(SLOT_PITCH - 0.5, 0.07, s.x, top + SLOT_D - 0.15), pal.line))
  }
  return mergeAndDispose(parts)
}

export function buildGarageDecals(L: GarageLayout, color: string): Decals | null {
  const items: DecalItem[] = L.slots.map((s, k) => ({ text: String(k + 1), size: 1.0, x: s.x + SLOT_PITCH / 2 - 0.9, z: L.slotZ - SLOT_D / 2 + 0.7 }))
  items.push({ text: 'ENTRADA', size: 0.42, x: (L.maxX + L.apronX) / 2 - 0.4, z: L.laneZ + LANE_W / 2 + 0.6, spacing: 12 })
  return atlasDecals(items, color)
}

/** Plataforma giratoria: disco con un aro claro y cuatro marcas, para que se note el giro (color por vértice). */
export function buildPad(pal: DioramaPalette): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  const disc = cyl(PAD_R, PAD_H, 0, PAD_H / 2, 0, 48)
  parts.push(colored(disc, mixHex(pal.postDark, pal.slab, 0.35)))
  const ring = new THREE.RingGeometry(PAD_R - 0.28, PAD_R - 0.1, 48)
  ring.rotateX(-Math.PI / 2)
  ring.translate(0, PAD_H + 0.004, 0)
  parts.push(colored(ring, mixHex(pal.line, '#ffffff', 0.3)))
  for (let i = 0; i < 4; i++) {
    const m = rbox(0.5, 0.012, 0.16, 0.02, 0, PAD_H + 0.006, PAD_R - 0.7, 1)
    m.rotateY((i * Math.PI) / 2)
    parts.push(colored(m, mixHex(pal.line, '#ffffff', 0.3)))
  }
  return mergeAndDispose(parts)
}
