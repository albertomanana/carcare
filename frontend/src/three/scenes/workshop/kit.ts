/**
 * Nave del taller «Apex Telemetry» (Fase 2): la misma planta de `layout.ts` con color y más detalle.
 *  - `workshopPalette`: suelo epoxi, líneas luminosas (naranja en los elevadores, ámbar en la espera, esmeralda en la
 *    entrega), carros rojos y naranjas, bidones, madera y acero. De noche manda el contraste: nave oscura y luz cálida
 *    en cada puesto con trabajo.
 *  - `buildWorkshopStatic`: losa, muros con franja, pórtico, elevadores de dos columnas con cilindro y
 *    cuadro de mando, carros de herramientas, estantería de neumáticos, bidones, compresor, banco y conos: UNA
 *    geometría con color por vértice (1 draw call + 1 de sombras).
 *  - `buildFloorPaint`: calzada y línea discontinua (mate, recibe sombra).
 *  - `buildGlow`: las líneas luminosas y su halo (2 draw calls, sin luz ni sombra).
 * Todo es CPU puro salvo las texturas del halo y de los charcos de luz, que necesitan un canvas 2D.
 */
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import type { ThemeTokens } from '../../env'
import { colored, cyl, dioramaPalette, mergeAndDispose, rbox, strip, type DioramaPalette } from './diorama'
import { BAY_D, BAY_W, LANE_W, POST_H, POST_X, PORTAL_DX, SLAB_H, STALL_D, STALL_W, WALL_H, WALL_T, type FloorLayout } from './layout'

export interface WorkshopPalette extends DioramaPalette {
  /** Suelo epoxi (plano brillante sobre la losa). */
  floor: string
  floorRoughness: number
  /** Cuánto refleja el suelo (0…1). */
  mirror: number
  bayLine: string
  parkLine: string
  readyLine: string
  stripe: string
  cartA: string
  cartB: string
  drumA: string
  drumB: string
  wood: string
  steel: string
  hazard: string
  cone: string
  hub: string
  sunColor: string
  /** Opacidad del halo de las líneas. */
  halo: number
  /** Charco de luz cálida bajo cada puesto con trabajo. */
  pool: string
  poolOpacity: number
  lampColor: string
  /** Intensidad de la luz de cada puesto ocupado (candelas). */
  lampIntensity: number
}

export function workshopPalette(t: ThemeTokens): WorkshopPalette {
  const base = dioramaPalette(t)
  const shared = {
    bayLine: '#ff5500',
    parkLine: '#f59e0b',
    readyLine: '#10b981',
    stripe: '#ff5500',
    cartA: '#d42a2a',
    cartB: '#ff6a1a',
    drumA: '#2b86c5',
    drumB: '#16a37a',
    hazard: '#f5a70b',
    cone: '#ff5a14',
  }
  if (t.light) {
    return {
      ...base,
      ...shared,
      slab: '#bcc3d0',
      floor: '#e6e9ef',
      floorRoughness: 0.32,
      mirror: 0.22,
      lane: '#c6ccd8',
      line: '#ffffff',
      wall: '#f1f3f7',
      post: '#44506a',
      postDark: '#2c3549',
      prop: '#7c889f',
      propDark: '#4a556b',
      tyre: '#262a33',
      hub: '#aab3c2',
      wood: '#c79a62',
      steel: '#b9c2d0',
      hemiSky: '#ffffff',
      hemiGround: '#aeb8c8',
      hemi: 1.7,
      sun: 2.2,
      sunColor: '#fff3e2',
      shadowOpacity: 0.2,
      halo: 0.28,
      pool: '#ff9d57',
      poolOpacity: 0.3,
      lampColor: '#ffb070',
      lampIntensity: 9,
    }
  }
  return {
    ...base,
    ...shared,
    slab: '#1a2031',
    floor: '#313a54',
    floorRoughness: 0.26,
    mirror: 0.4,
    lane: '#232a3e',
    line: '#93a0bc',
    wall: '#3b4767',
    post: '#56658a',
    postDark: '#2c3550',
    prop: '#65739a',
    propDark: '#39435e',
    tyre: '#12151c',
    hub: '#8792aa',
    wood: '#a87b49',
    steel: '#9aa5bb',
    hemiSky: '#d5e0ff',
    hemiGround: '#232c44',
    hemi: 1.9,
    sun: 2.0,
    sunColor: '#dfe8ff',
    shadowOpacity: 0.4,
    halo: 0.5,
    pool: '#ff8a3d',
    poolOpacity: 0.42,
    lampColor: '#ffab66',
    lampIntensity: 22,
  }
}

// ───────────────────────── Piezas ─────────────────────────

const X_AXIS = new THREE.Vector3(1, 0, 0)

/** Neumático de pie (eje en z) con su llanta. */
function tyreUpright(x: number, y: number, z: number, pal: WorkshopPalette): THREE.BufferGeometry[] {
  const t = new THREE.TorusGeometry(0.27, 0.105, 8, 16)
  t.translate(x, y, z)
  const hub = new THREE.CylinderGeometry(0.17, 0.17, 0.12, 12)
  hub.rotateX(Math.PI / 2)
  hub.translate(x, y, z)
  return [colored(t, pal.tyre), colored(hub, pal.hub)]
}

/** Carro de herramientas con cajones, bandeja, asa y ruedas. `front` = +1 si los cajones miran a +z. */
function toolCart(x: number, z: number, color: string, pal: WorkshopPalette): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = []
  const w = 0.86
  const d = 0.48
  const h = 0.74
  const y0 = 0.14
  parts.push(colored(rbox(w, h, d, 0.05, x, y0 + h / 2, z), color))
  // bandeja superior y tirador
  parts.push(colored(rbox(w + 0.04, 0.05, d + 0.04, 0.02, x, y0 + h + 0.025, z, 1), pal.propDark))
  parts.push(colored(rbox(0.04, 0.04, d - 0.08, 0.015, x + w / 2 + 0.06, y0 + h - 0.08, z, 1), pal.steel))
  // cajones: frentes un poco salientes con su tirador
  for (let i = 0; i < 4; i++) {
    const yy = y0 + 0.1 + i * 0.165
    parts.push(colored(rbox(w - 0.1, 0.13, 0.02, 0.008, x, yy, z + d / 2 + 0.006, 1), color))
    parts.push(colored(rbox(w - 0.34, 0.022, 0.02, 0.008, x, yy + 0.035, z + d / 2 + 0.022, 1), pal.steel))
  }
  // ruedas
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const wh = new THREE.CylinderGeometry(0.07, 0.07, 0.05, 10)
      wh.rotateZ(Math.PI / 2)
      wh.translate(x + sx * (w / 2 - 0.1), 0.07, z + sz * (d / 2 - 0.09))
      parts.push(colored(wh, pal.tyre))
    }
  return parts
}

function drum(x: number, z: number, color: string, pal: WorkshopPalette): THREE.BufferGeometry[] {
  return [
    colored(cyl(0.29, 0.86, x, 0.43, z, 20), color),
    colored(cyl(0.305, 0.04, x, 0.29, z, 20), pal.propDark),
    colored(cyl(0.305, 0.04, x, 0.6, z, 20), pal.propDark),
    colored(cyl(0.27, 0.03, x, 0.875, z, 20), pal.propDark),
  ]
}

function cone(x: number, z: number, pal: WorkshopPalette): THREE.BufferGeometry[] {
  const body = new THREE.CylinderGeometry(0.035, 0.15, 0.44, 14)
  body.translate(x, 0.25, z)
  const band = new THREE.CylinderGeometry(0.075, 0.105, 0.1, 14)
  band.translate(x, 0.3, z)
  return [colored(rbox(0.36, 0.035, 0.36, 0.015, x, 0.018, z, 1), pal.cone), colored(body, pal.cone), colored(band, '#f4f6fb')]
}

// ───────────────────────── Estático ─────────────────────────

export function buildWorkshopStatic(L: FloorLayout, pal: WorkshopPalette): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  const x0 = L.minX - WALL_T
  const x1 = L.apronX
  const z0 = L.backZ - WALL_T
  const z1 = L.frontZ
  // Losa de la maqueta (la cara de arriba queda bajo el plano de epoxi)
  parts.push(colored(rbox(x1 - x0 + 0.6, SLAB_H, z1 - z0 + 0.6, 0.22, (x0 + x1) / 2, -SLAB_H / 2 - 0.004, (z0 + z1) / 2, 4), pal.slab))

  // Muros del fondo y de la izquierda, con remate oscuro y una franja naranja a media altura
  const backLen = L.maxX - x0 + 0.1
  const sideLen = z1 - z0 - 0.4
  parts.push(colored(rbox(backLen, WALL_H, WALL_T, 0.08, x0 + backLen / 2, WALL_H / 2, L.backZ - WALL_T / 2), pal.wall))
  parts.push(colored(rbox(WALL_T, WALL_H, sideLen, 0.08, L.minX - WALL_T / 2, WALL_H / 2, z0 + sideLen / 2), pal.wall))
  parts.push(colored(rbox(backLen + 0.04, 0.14, WALL_T + 0.06, 0.05, x0 + backLen / 2, WALL_H, L.backZ - WALL_T / 2), pal.propDark))
  parts.push(colored(rbox(WALL_T + 0.06, 0.14, sideLen + 0.04, 0.05, L.minX - WALL_T / 2, WALL_H, z0 + sideLen / 2), pal.propDark))
  parts.push(colored(rbox(backLen - 0.5, 0.16, 0.03, 0.01, x0 + backLen / 2, 1.42, L.backZ + 0.012, 1), pal.stripe))
  parts.push(colored(rbox(0.03, 0.16, sideLen - 0.6, 0.01, L.minX + 0.012, 1.42, z0 + sideLen / 2, 1), pal.stripe))
  // zócalo oscuro
  parts.push(colored(rbox(backLen - 0.3, 0.2, 0.03, 0.01, x0 + backLen / 2, 0.1, L.backZ + 0.012, 1), pal.propDark))
  parts.push(colored(rbox(0.03, 0.2, sideLen - 0.4, 0.01, L.minX + 0.012, 0.1, z0 + sideLen / 2, 1), pal.propDark))

  // Bordillo derecho (con hueco para la calzada)
  const curbH = 0.22
  const laneLo = L.laneZ - LANE_W / 2 - 0.2
  const laneHi = L.laneZ + LANE_W / 2 + 0.2
  if (laneLo - L.backZ > 0.4) parts.push(colored(rbox(0.22, curbH, laneLo - L.backZ, 0.06, L.maxX, curbH / 2, (L.backZ + laneLo) / 2), pal.hazard))
  if (L.frontZ - laneHi > 0.4) parts.push(colored(rbox(0.22, curbH, L.frontZ - 0.5 - laneHi, 0.06, L.maxX, curbH / 2, (laneHi + L.frontZ - 0.5) / 2), pal.hazard))

  // Pórtico de la entrada: pilares con banda ámbar y dintel
  const portalX = L.maxX + PORTAL_DX
  for (const side of [-1, 1]) {
    const pz = L.laneZ + side * (LANE_W / 2 + 0.25)
    parts.push(colored(rbox(0.34, 2.6, 0.34, 0.08, portalX, 1.3, pz), pal.post))
    parts.push(colored(rbox(0.37, 0.34, 0.37, 0.06, portalX, 0.62, pz, 1), pal.hazard))
    parts.push(...cone(portalX + 0.2, L.laneZ + side * (LANE_W / 2 + 1.05), pal))
  }
  parts.push(colored(rbox(0.4, 0.3, LANE_W + 0.9, 0.08, portalX, 2.62, L.laneZ), pal.postDark))
  parts.push(colored(rbox(0.43, 0.08, LANE_W + 0.3, 0.03, portalX, 2.5, L.laneZ, 1), pal.stripe))

  // Elevadores de dos columnas: placa con bandas, columna, cilindro, remate naranja y cuadro de mando (sin travesaño: el coche sube por encima de las columnas)
  for (const b of L.bays) {
    for (const side of [-1, 1]) {
      const px = b.x + side * POST_X
      parts.push(colored(rbox(0.66, 0.07, 0.74, 0.03, px, 0.035, b.z, 1), pal.postDark))
      for (const dz of [-0.24, 0, 0.24]) parts.push(colored(rbox(0.67, 0.074, 0.08, 0.02, px, 0.036, b.z + dz, 1), pal.hazard))
      parts.push(colored(rbox(0.3, POST_H, 0.38, 0.06, px, POST_H / 2, b.z), pal.post))
      parts.push(colored(cyl(0.05, POST_H - 0.5, px + side * 0.02, POST_H / 2 + 0.1, b.z - 0.25, 10), pal.steel))
      parts.push(colored(rbox(0.36, 0.12, 0.44, 0.04, px, POST_H + 0.06, b.z, 1), pal.stripe))
    }
    // cuadro de mando en la columna derecha, hacia la calzada
    parts.push(colored(rbox(0.22, 0.32, 0.1, 0.03, b.x + POST_X, 1.25, b.z + 0.24, 1), pal.propDark))
    parts.push(colored(rbox(0.1, 0.06, 0.03, 0.01, b.x + POST_X, 1.33, b.z + 0.3, 1), pal.readyLine))
    parts.push(colored(rbox(0.1, 0.06, 0.03, 0.01, b.x + POST_X, 1.2, b.z + 0.3, 1), pal.cartA))
  }

  // Carros de herramientas junto al muro del fondo, entre elevadores: rojo y naranja alternos
  for (let i = 0; i <= L.bays.length; i++) {
    const x = L.bays.length ? L.bays[0].x - BAY_W / 2 + i * BAY_W : 0
    if (x < L.minX + 0.9 || x > L.maxX - 0.6) continue
    parts.push(...toolCart(x, L.backZ + 0.36, i % 2 ? pal.cartB : pal.cartA, pal))
  }

  // Esquina del fondo a la izquierda: pilas de neumáticos y compresor ámbar
  const tx = L.minX + 0.55
  for (const [dz, n] of [[0.55, 4], [1.3, 2]] as const) {
    for (let k = 0; k < n; k++) {
      parts.push(colored(cyl(0.33, 0.21, tx, 0.105 + k * 0.22, L.backZ + dz, 16), pal.tyre))
      if (k === n - 1) parts.push(colored(cyl(0.17, 0.02, tx, 0.22 * n + 0.004, L.backZ + dz, 12), pal.hub))
    }
  }
  const tank = new THREE.CylinderGeometry(0.26, 0.26, 0.86, 16)
  tank.applyQuaternion(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2))
  tank.translate(L.minX + 1.5, 0.46, L.backZ + 0.4)
  parts.push(colored(tank, pal.hazard))
  parts.push(colored(rbox(0.3, 0.2, 0.26, 0.04, L.minX + 1.5, 0.82, L.backZ + 0.4, 1), pal.propDark))
  for (const dx of [-0.3, 0.3]) parts.push(colored(rbox(0.06, 0.2, 0.4, 0.02, L.minX + 1.5 + dx, 0.1, L.backZ + 0.4, 1), pal.propDark))

  // Estantería de neumáticos en el muro izquierdo: dos baldas con los neumáticos de pie
  const rz0 = L.backZ + 2.2
  const rackLen = 2.3
  const rx = L.minX + 0.42
  for (const dz of [0, rackLen]) for (const dx of [-0.26, 0.26]) parts.push(colored(rbox(0.06, 1.95, 0.06, 0.015, rx + dx, 0.975, rz0 + dz, 1), pal.steel))
  for (const y of [0.3, 1.1, 1.92]) parts.push(colored(rbox(0.6, 0.05, rackLen + 0.1, 0.015, rx, y, rz0 + rackLen / 2, 1), pal.propDark))
  for (const y of [0.3, 1.1]) for (let k = 0; k < 7; k++) parts.push(...tyreUpright(rx, y + 0.4, rz0 + 0.22 + k * 0.31, pal))

  // Bidones junto al bordillo del fondo a la derecha
  parts.push(...drum(L.maxX - 0.55, L.backZ + 0.5, pal.drumA, pal))
  parts.push(...drum(L.maxX - 0.55, L.backZ + 1.2, pal.drumB, pal))
  parts.push(...drum(L.maxX - 1.22, L.backZ + 0.5, pal.drumA, pal))

  // Banco de trabajo en el muro izquierdo, junto a la zona de espera: tablero de madera, patas y tornillo rojo
  const bz = L.stallZ
  parts.push(colored(rbox(0.74, 0.08, 1.9, 0.03, L.minX + 0.42, 0.9, bz, 1), pal.wood))
  for (const dz of [-0.84, 0.84]) parts.push(colored(rbox(0.62, 0.86, 0.08, 0.02, L.minX + 0.42, 0.43, bz + dz, 1), pal.steel))
  parts.push(colored(rbox(0.66, 0.05, 1.7, 0.02, L.minX + 0.42, 0.3, bz, 1), pal.propDark))
  parts.push(colored(rbox(0.2, 0.16, 0.26, 0.03, L.minX + 0.5, 1.02, bz + 0.55, 1), pal.cartA))
  parts.push(colored(rbox(0.3, 0.22, 0.3, 0.03, L.minX + 0.4, 1.05, bz - 0.5, 1), pal.cartB))
  // panel de herramientas en el muro, sobre el banco
  parts.push(colored(rbox(0.03, 0.7, 1.7, 0.01, L.minX + 0.014, 1.75, bz, 1), pal.propDark))
  for (const [dy, dz, len] of [[0.18, -0.5, 0.36], [0.02, -0.05, 0.5], [-0.14, 0.4, 0.3], [0.16, 0.5, 0.22]] as const) {
    const tool = new RoundedBoxGeometry(0.02, 0.05, len, 1, 0.01)
    tool.applyQuaternion(new THREE.Quaternion().setFromAxisAngle(X_AXIS, dz * 0.4))
    tool.translate(L.minX + 0.036, 1.75 + dy, bz + dz)
    parts.push(colored(tool, pal.steel))
  }

  return mergeAndDispose(parts)
}

// ───────────────────────── Suelo ─────────────────────────

/** Calzada y línea discontinua: pintura mate sobre el epoxi. */
export function buildFloorPaint(L: FloorLayout, pal: WorkshopPalette): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  const lx0 = L.minX + 0.2
  const lx1 = L.apronX - 0.2
  parts.push(colored(strip(lx1 - lx0, LANE_W, (lx0 + lx1) / 2, L.laneZ, 0.004), pal.lane))
  for (let x = lx0 + 0.8; x < lx1 - 0.8; x += 1.6) parts.push(colored(strip(0.8, 0.09, x + 0.4, L.laneZ, 0.007), pal.line))
  for (const side of [-1, 1]) parts.push(colored(strip(lx1 - lx0, 0.06, (lx0 + lx1) / 2, L.laneZ + side * (LANE_W / 2 - 0.08), 0.007), pal.line))
  // Bandas de precaución a la entrada de la nave
  for (let k = 0; k < 6; k++) parts.push(colored(strip(0.16, LANE_W - 0.5, L.maxX + 0.5 + k * 0.34, L.laneZ, 0.008), k % 2 ? pal.lane : pal.hazard))
  return mergeAndDispose(parts)
}

interface GlowSeg {
  w: number
  d: number
  x: number
  z: number
  color: string
}

function glowSegments(L: FloorLayout, pal: WorkshopPalette): GlowSeg[] {
  const segs: GlowSeg[] = []
  const t = 0.075
  // Elevadores: plaza abierta hacia la calzada, en naranja
  const w = BAY_W - 0.6
  const d = BAY_D - 0.5
  for (const b of L.bays) {
    segs.push({ w, d: t, x: b.x, z: b.z - d / 2, color: pal.bayLine })
    segs.push({ w: t, d, x: b.x - w / 2, z: b.z, color: pal.bayLine })
    segs.push({ w: t, d, x: b.x + w / 2, z: b.z, color: pal.bayLine })
    // esquinas de la boca
    for (const side of [-1, 1]) segs.push({ w: 0.7, d: t, x: b.x + side * (w / 2 - 0.35), z: b.z + d / 2, color: pal.bayLine })
  }
  // Espera en ámbar y entrega en esmeralda
  for (const [row, color] of [[L.park, pal.parkLine], [L.ready, pal.readyLine]] as const) {
    if (!row.length) continue
    for (let k = 0; k <= row.length; k++) {
      segs.push({ w: t, d: STALL_D - 0.3, x: row[0].x - STALL_W / 2 + k * STALL_W, z: L.stallZ + 0.15, color })
    }
    segs.push({ w: row.length * STALL_W, d: t, x: row[0].x - STALL_W / 2 + (row.length * STALL_W) / 2, z: L.stallZ + STALL_D / 2, color })
  }
  return segs
}

export interface Glow {
  /** Trazo nítido de las líneas. */
  core: THREE.BufferGeometry
  /** Halo ancho con degradado (lleva UV: v cruza el ancho). */
  halo: THREE.BufferGeometry
}

/** Líneas luminosas del suelo: un trazo nítido y un halo con mezcla aditiva. */
export function buildGlow(L: FloorLayout, pal: WorkshopPalette): Glow {
  const segs = glowSegments(L, pal)
  const core = mergeAndDispose(segs.map((s) => colored(strip(s.w, s.d, s.x, s.z, 0.012), s.color)))
  const HALO = 0.62
  const halos = segs.map((s) => {
    const alongX = s.w >= s.d
    const g = new THREE.PlaneGeometry(alongX ? s.w + 0.2 : s.d + 0.2, HALO)
    g.rotateX(-Math.PI / 2)
    if (!alongX) g.rotateY(Math.PI / 2)
    g.translate(s.x, 0.01, s.z)
    const c = new THREE.Color(s.color)
    const n = g.getAttribute('position').count
    const arr = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3)
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3))
    return g
  })
  return { core, halo: mergeAndDispose(halos) }
}

// ───────────────────────── Texturas (canvas 2D) ─────────────────────────

let haloTex: THREE.Texture | null = null
/** Degradado transparente → blanco → transparente a lo ancho del halo. null sin canvas 2D. */
export function haloTexture(): THREE.Texture | null {
  if (haloTex || typeof document === 'undefined') return haloTex
  const c = document.createElement('canvas')
  c.width = 4
  c.height = 64
  const g = c.getContext('2d')
  if (!g) return null
  const grad = g.createLinearGradient(0, 0, 0, 64)
  grad.addColorStop(0, 'rgba(255,255,255,0)')
  grad.addColorStop(0.5, 'rgba(255,255,255,1)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 4, 64)
  haloTex = new THREE.CanvasTexture(c)
  return haloTex
}

let poolTex: THREE.Texture | null = null
/** Mancha radial para el charco de luz de un puesto. null sin canvas 2D. */
export function poolTexture(): THREE.Texture | null {
  if (poolTex || typeof document === 'undefined') return poolTex
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')
  if (!g) return null
  const grad = g.createRadialGradient(64, 64, 2, 64, 64, 64)
  grad.addColorStop(0, 'rgba(255,255,255,0.95)')
  grad.addColorStop(0.45, 'rgba(255,255,255,0.4)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  poolTex = new THREE.CanvasTexture(c)
  return poolTex
}

// ───────────────────────── Parte móvil del elevador ─────────────────────────

const carriageCache = new Map<string, THREE.BufferGeometry>()

/** Carros, brazos amarillos y tacos (y = 0 en el suelo). Se comparte entre elevadores del mismo tema. */
export function workshopCarriage(pal: WorkshopPalette): THREE.BufferGeometry {
  const key = `${pal.postDark}|${pal.hazard}|${pal.tyre}`
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
      parts.push(colored(arm, pal.hazard))
      parts.push(colored(cyl(0.11, 0.06, tx, armY + 0.06, dz, 14), pal.tyre))
    }
  }
  g = mergeAndDispose(parts)
  carriageCache.set(key, g)
  return g
}
