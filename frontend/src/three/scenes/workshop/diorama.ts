/**
 * Piezas de la maqueta del taller construidas en CPU y fusionadas para gastar pocos draw calls:
 *  - `buildStatic`: losa, muros, bordillos, columnas y bases de los elevadores y atrezo, en UNA geometría con color por
 *    vértice (1 draw call + 1 en la pasada de sombras);
 *  - `buildMarkings`: calzada, línea discontinua y marcas de plazas y elevadores (1 draw call, solo recibe sombra);
 *  - `buildDecals`: rótulos del suelo (números de elevador, ENTRADA, ESPERA, ENTREGA) en un atlas (1 draw call);
 *  - `liftCarriage`: la parte móvil del elevador (carros, brazos y tacos), compartida por todos los elevadores.
 */
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { mixHex } from '../../color'
import type { ThemeTokens } from '../../env'
import { BAY_D, BAY_W, LANE_W, POST_H, POST_X, PORTAL_DX, SLAB_H, STALL_D, STALL_W, WALL_H, WALL_T, type FloorLayout } from './layout'

export interface DioramaPalette {
  background: string
  slab: string
  lane: string
  line: string
  wall: string
  post: string
  postDark: string
  prop: string
  propDark: string
  tyre: string
  decal: string
  glass: string
  hemiSky: string
  hemiGround: string
  hemi: number
  sun: number
  shadowOpacity: number
}

/** Paleta de maqueta a partir de los tokens del tema (gris claro con un tinte azul pastel; en oscuro, cabina apagada). */
export function dioramaPalette(t: ThemeTokens): DioramaPalette {
  if (t.light) {
    // el fondo es --base tal cual: la escena se funde con la página
    const background = t.base
    const slab = mixHex(t.surface, '#eaf0f6', 0.35)
    return {
      background,
      slab,
      lane: mixHex(slab, '#94a0ad', 0.2),
      line: mixHex(slab, '#ffffff', 0.85),
      wall: mixHex(t.surface2, '#dfe6ee', 0.4),
      post: '#6d7f93',
      postDark: '#4b5866',
      prop: '#8b9bb0',
      propDark: '#5c6878',
      tyre: '#3a3f46',
      decal: mixHex(slab, t.fgSubtle, 0.55),
      glass: '#4f6276',
      hemiSky: '#ffffff',
      hemiGround: mixHex(background, '#7d8a99', 0.45),
      hemi: 1.75,
      sun: 2.1,
      shadowOpacity: 0.16,
    }
  }
  const background = t.base
  const slab = mixHex(t.surface3, '#3d4a59', 0.4)
  return {
    background,
    slab,
    lane: mixHex(slab, '#0d1218', 0.28),
    line: mixHex(slab, '#c9d3dd', 0.45),
    wall: mixHex(t.surface3, '#33404e', 0.3),
    post: '#5a6b7e',
    postDark: '#3c4855',
    prop: '#5f6f84',
    propDark: '#3e4957',
    tyre: '#22262b',
    decal: mixHex(slab, t.fgSubtle, 0.6),
    glass: '#28333f',
    hemiSky: '#d7e2ee',
    hemiGround: mixHex(background, '#000000', 0.3),
    hemi: 1.35,
    sun: 1.7,
    shadowOpacity: 0.3,
  }
}

// ───────────────────────── Utilidades ─────────────────────────

export function colored(g: THREE.BufferGeometry, hex: string): THREE.BufferGeometry {
  let out = g.index ? g.toNonIndexed() : g
  if (out !== g) g.dispose()
  out.deleteAttribute('uv')
  if (!out.getAttribute('normal')) out.computeVertexNormals()
  const c = new THREE.Color(hex)
  const n = out.getAttribute('position').count
  const arr = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r
    arr[i * 3 + 1] = c.g
    arr[i * 3 + 2] = c.b
  }
  out.setAttribute('color', new THREE.BufferAttribute(arr, 3))
  return out
}

export function rbox(w: number, h: number, d: number, r: number, x: number, y: number, z: number, seg = 2): THREE.BufferGeometry {
  const g = new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001))
  g.translate(x, y, z)
  return g
}

export function cyl(r: number, h: number, x: number, y: number, z: number, seg = 18): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r, r, h, seg, 1)
  g.translate(x, y, z)
  return g
}

export function mergeAndDispose(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const g = mergeGeometries(parts, false)
  for (const p of parts) p.dispose()
  g.computeBoundingSphere()
  g.computeBoundingBox()
  return g
}

// ───────────────────────── Estático ─────────────────────────

export function buildStatic(L: FloorLayout, pal: DioramaPalette): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  const x0 = L.minX - WALL_T
  const x1 = L.apronX
  const z0 = L.backZ - WALL_T
  const z1 = L.frontZ
  // Losa de la maqueta (la cara de arriba en y = 0)
  parts.push(colored(rbox(x1 - x0 + 0.6, SLAB_H, z1 - z0 + 0.6, 0.22, (x0 + x1) / 2, -SLAB_H / 2, (z0 + z1) / 2, 4), pal.slab))
  // Muro del fondo y muro izquierdo
  const backLen = L.maxX - x0 + 0.1
  parts.push(colored(rbox(backLen, WALL_H, WALL_T, 0.08, x0 + backLen / 2, WALL_H / 2, L.backZ - WALL_T / 2), pal.wall))
  const sideLen = z1 - z0 - 0.4
  parts.push(colored(rbox(WALL_T, WALL_H, sideLen, 0.08, L.minX - WALL_T / 2, WALL_H / 2, z0 + sideLen / 2), pal.wall))
  // Remate del muro (una banda más oscura arriba)
  parts.push(colored(rbox(backLen + 0.04, 0.14, WALL_T + 0.06, 0.05, x0 + backLen / 2, WALL_H, L.backZ - WALL_T / 2), pal.propDark))
  parts.push(colored(rbox(WALL_T + 0.06, 0.14, sideLen + 0.04, 0.05, L.minX - WALL_T / 2, WALL_H, z0 + sideLen / 2), pal.propDark))
  // Bordillo derecho (con hueco para la calzada) y bordillo del frente, bajos para no tapar nada
  const curbH = 0.22
  const laneLo = L.laneZ - LANE_W / 2 - 0.2
  const laneHi = L.laneZ + LANE_W / 2 + 0.2
  if (laneLo - L.backZ > 0.4) parts.push(colored(rbox(0.22, curbH, laneLo - L.backZ, 0.06, L.maxX, curbH / 2, (L.backZ + laneLo) / 2), pal.propDark))
  if (L.frontZ - laneHi > 0.4) parts.push(colored(rbox(0.22, curbH, L.frontZ - 0.5 - laneHi, 0.06, L.maxX, curbH / 2, (laneHi + L.frontZ - 0.5) / 2), pal.propDark))
  // Pórtico de la entrada (dos pilares y dintel), sobre el borde de la nave
  for (const side of [-1, 1]) {
    parts.push(colored(rbox(0.34, 2.6, 0.34, 0.08, L.maxX + PORTAL_DX, 1.3, L.laneZ + side * (LANE_W / 2 + 0.25)), pal.post))
  }
  parts.push(colored(rbox(0.4, 0.3, LANE_W + 0.9, 0.08, L.maxX + PORTAL_DX, 2.62, L.laneZ), pal.postDark))

  // Elevadores: bases y columnas (la parte móvil va aparte)
  for (const b of L.bays) {
    for (const side of [-1, 1]) {
      const px = b.x + side * POST_X
      parts.push(colored(rbox(0.66, 0.07, 0.74, 0.03, px, 0.035, b.z, 1), pal.postDark))
      parts.push(colored(rbox(0.3, POST_H, 0.38, 0.06, px, POST_H / 2, b.z), pal.post))
      parts.push(colored(rbox(0.36, 0.1, 0.44, 0.04, px, POST_H + 0.05, b.z, 1), pal.postDark))
    }
  }

  // Atrezo junto al muro: un armario de herramientas entre cada par de elevadores y neumáticos en la esquina
  for (let i = 0; i <= L.bays.length; i++) {
    const x = L.bays.length ? L.bays[0].x - BAY_W / 2 + i * BAY_W : 0
    if (x < L.minX + 0.5 || x > L.maxX - 0.5) continue
    const z = L.backZ + 0.32
    parts.push(colored(rbox(0.9, 1.0, 0.5, 0.06, x, 0.5, z), pal.prop))
    parts.push(colored(rbox(0.94, 0.06, 0.54, 0.02, x, 1.03, z, 1), pal.propDark))
    for (const dy of [0.28, 0.55, 0.8]) parts.push(colored(rbox(0.8, 0.03, 0.02, 0.01, x, dy, z + 0.26, 1), pal.propDark))
  }
  const tx = L.minX + 0.6
  for (const [dz, n] of [[0.6, 4], [1.4, 3]] as const) {
    for (let k = 0; k < n; k++) parts.push(colored(cyl(0.34, 0.22, tx, 0.11 + k * 0.23, L.backZ + dz + 0.1), pal.tyre))
  }
  // Banco de trabajo en el muro izquierdo, junto a la zona de espera
  const bz = L.stallZ
  parts.push(colored(rbox(0.7, 0.08, 1.8, 0.03, L.minX + 0.4, 0.9, bz, 1), pal.prop))
  for (const dz of [-0.8, 0.8]) parts.push(colored(rbox(0.6, 0.86, 0.08, 0.02, L.minX + 0.4, 0.43, bz + dz, 1), pal.propDark))

  return mergeAndDispose(parts)
}

// ───────────────────────── Marcas del suelo ─────────────────────────

export function strip(w: number, d: number, x: number, z: number, y = 0.006): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(w, d)
  g.rotateX(-Math.PI / 2)
  g.translate(x, y, z)
  return g
}

export function buildMarkings(L: FloorLayout, pal: DioramaPalette): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  // Calzada (desde el muro izquierdo hasta el borde de la explanada)
  const lx0 = L.minX + 0.2
  const lx1 = L.apronX - 0.2
  parts.push(colored(strip(lx1 - lx0, LANE_W, (lx0 + lx1) / 2, L.laneZ, 0.004), pal.lane))
  // Línea discontinua central
  for (let x = lx0 + 0.8; x < lx1 - 0.8; x += 1.6) parts.push(colored(strip(0.8, 0.09, x + 0.4, L.laneZ), pal.line))
  // Bordes de la calzada
  for (const side of [-1, 1]) parts.push(colored(strip(lx1 - lx0, 0.06, (lx0 + lx1) / 2, L.laneZ + side * (LANE_W / 2 - 0.08)), pal.line))
  // Elevadores: rectángulo de la plaza
  const w = BAY_W - 0.6
  const d = BAY_D - 0.5
  for (const b of L.bays) {
    parts.push(colored(strip(w, 0.07, b.x, b.z - d / 2), pal.line))
    parts.push(colored(strip(0.07, d, b.x - w / 2, b.z), pal.line))
    parts.push(colored(strip(0.07, d, b.x + w / 2, b.z), pal.line))
  }
  // Plazas de espera y entrega: separadores
  for (const row of [L.park, L.ready]) {
    if (!row.length) continue
    const zc = L.stallZ
    for (let k = 0; k <= row.length; k++) {
      const x = row[0].x - STALL_W / 2 + k * STALL_W
      parts.push(colored(strip(0.07, STALL_D - 0.3, x, zc + 0.15), pal.line))
    }
    parts.push(colored(strip(row.length * STALL_W, 0.07, row[0].x - STALL_W / 2 + (row.length * STALL_W) / 2, zc + STALL_D / 2), pal.line))
  }
  return mergeAndDispose(parts)
}

// ───────────────────────── Rótulos del suelo (atlas) ─────────────────────────

export interface DecalItem {
  text: string
  /** Altura de la letra en metros. */
  size: number
  x: number
  z: number
  /** Espaciado entre letras (px del atlas). */
  spacing?: number
}

export interface Decals {
  geometry: THREE.BufferGeometry
  texture: THREE.CanvasTexture
}

/** Todos los rótulos del suelo en una textura y una geometría (1 draw call). null si no hay canvas 2D. */
export function buildDecals(L: FloorLayout, color: string): Decals | null {
  if (typeof document === 'undefined') return null
  const items: DecalItem[] = []
  for (const b of L.bays) items.push({ text: String(b.number), size: 1.05, x: b.x + BAY_W / 2 - 1.0, z: b.z + BAY_D / 2 - 0.95 })
  const midPark = (L.zones.park[0] + L.zones.park[1]) / 2
  const midReady = (L.zones.ready[0] + L.zones.ready[1]) / 2
  const zText = L.stallZ + STALL_D / 2 + 0.6
  items.push({ text: 'ESPERA', size: 0.5, x: midPark, z: zText, spacing: 14 })
  items.push({ text: 'ENTREGA', size: 0.5, x: midReady, z: zText, spacing: 14 })
  items.push({ text: 'ENTRADA', size: 0.42, x: (L.maxX + L.apronX) / 2, z: L.laneZ + LANE_W / 2 + 0.55, spacing: 12 })
  return atlasDecals(items, color)
}

/** Rótulos del suelo (texto en metros sobre el plano y = 0) en una textura y una geometría. null si no hay canvas 2D. */
export function atlasDecals(items: DecalItem[], color: string): Decals | null {
  if (typeof document === 'undefined') return null
  const PX = 96 // px por cada `size` de 1 (alto de la letra en el atlas)
  const font = (px: number) => `650 ${px}px "Archivo Variable", system-ui, sans-serif`
  const measure = document.createElement('canvas').getContext('2d')
  if (!measure) return null
  type Placed = DecalItem & { w: number; h: number; cx: number; cy: number; px: number }
  const placed: Placed[] = []
  const atlasW = 1024
  let cx = 0
  let cy = 0
  let rowH = 0
  for (const it of items) {
    const px = Math.round(PX * Math.min(1.2, it.size * 1.6))
    measure.font = font(px)
    const spacing = it.spacing ?? 0
    const w = Math.ceil(measure.measureText(it.text).width + spacing * it.text.length + 16)
    const h = Math.ceil(px * 1.25)
    if (cx + w > atlasW) {
      cx = 0
      cy += rowH
      rowH = 0
    }
    placed.push({ ...it, w, h, cx, cy, px })
    cx += w
    rowH = Math.max(rowH, h)
  }
  const atlasH = THREE.MathUtils.ceilPowerOfTwo(Math.max(16, cy + rowH))
  const c = document.createElement('canvas')
  c.width = atlasW
  c.height = atlasH
  const g = c.getContext('2d')
  if (!g) return null
  g.fillStyle = color
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  for (const p of placed) {
    g.font = font(p.px)
    ;(g as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${p.spacing ?? 0}px`
    g.fillText(p.text, p.cx + p.w / 2 + (p.spacing ?? 0) / 2, p.cy + p.h / 2 + p.px * 0.04)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4

  const quads: THREE.BufferGeometry[] = []
  for (const p of placed) {
    const hm = (p.h / p.px) * p.size * 0.75
    const wm = (p.w / p.h) * hm
    const q = new THREE.PlaneGeometry(wm, hm)
    const uv = q.getAttribute('uv') as THREE.BufferAttribute
    for (let i = 0; i < uv.count; i++) {
      const u = (p.cx + uv.getX(i) * p.w) / atlasW
      const v = 1 - (p.cy + (1 - uv.getY(i)) * p.h) / atlasH
      uv.setXY(i, u, v)
    }
    q.rotateX(-Math.PI / 2)
    q.translate(p.x, 0.009, p.z)
    quads.push(q)
  }
  const geometry = mergeGeometries(quads, false)
  for (const q of quads) q.dispose()
  geometry.computeBoundingSphere()
  return { geometry, texture: tex }
}

// ───────────────────────── Parte móvil del elevador ─────────────────────────

const carriageCache = new Map<string, THREE.BufferGeometry>()

/** Carros, brazos y tacos (y = 0 en el suelo). Se comparte entre elevadores del mismo tema. */
export function liftCarriage(pal: DioramaPalette): THREE.BufferGeometry {
  const key = `${pal.post}|${pal.postDark}|${pal.tyre}`
  let g = carriageCache.get(key)
  if (g) return g
  const parts: THREE.BufferGeometry[] = []
  const armY = 0.12
  for (const side of [-1, 1]) {
    parts.push(colored(rbox(0.42, 0.34, 0.5, 0.05, side * (POST_X - 0.02), armY + 0.14, 0), pal.postDark))
    for (const dz of [1.15, -1.15]) {
      const fx = side * (POST_X - 0.16)
      const tx = side * 0.6
      const len = Math.hypot(tx - fx, dz)
      const arm = new RoundedBoxGeometry(len, 0.08, 0.14, 1, 0.03)
      arm.rotateY(-Math.atan2(dz, tx - fx))
      arm.translate((fx + tx) / 2, armY, dz / 2)
      parts.push(colored(arm, pal.post))
      parts.push(colored(cyl(0.11, 0.06, tx, armY + 0.06, dz, 14), pal.tyre))
    }
  }
  g = mergeAndDispose(parts)
  carriageCache.set(key, g)
  return g
}

/** Contorno de selección (rectángulo redondeado hueco) para un elevador o una plaza. */
export function selectionOutline(kind: 'bay' | 'stall'): THREE.BufferGeometry {
  const w = kind === 'bay' ? BAY_W - 0.35 : STALL_W - 0.2
  const d = kind === 'bay' ? BAY_D - 0.25 : STALL_D - 0.1
  const t = 0.14
  const rr = (s: THREE.Path, x: number, y: number, ww: number, hh: number, r: number) => {
    s.moveTo(x + r, y)
    s.lineTo(x + ww - r, y)
    s.quadraticCurveTo(x + ww, y, x + ww, y + r)
    s.lineTo(x + ww, y + hh - r)
    s.quadraticCurveTo(x + ww, y + hh, x + ww - r, y + hh)
    s.lineTo(x + r, y + hh)
    s.quadraticCurveTo(x, y + hh, x, y + hh - r)
    s.lineTo(x, y + r)
    s.quadraticCurveTo(x, y, x + r, y)
  }
  const shape = new THREE.Shape()
  rr(shape, -w / 2, -d / 2, w, d, 0.4)
  const hole = new THREE.Path()
  rr(hole, -w / 2 + t, -d / 2 + t, w - 2 * t, d - 2 * t, 0.3)
  shape.holes.push(hole)
  const g = new THREE.ShapeGeometry(shape, 6)
  g.rotateX(-Math.PI / 2)
  g.translate(0, 0.012, 0)
  return g
}
