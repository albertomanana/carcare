/**
 * Coche de maqueta «de arcilla» (taller isométrico): bloques redondeados por carrocería, sin marcas.
 * Tres geometrías por carrocería (pintura, lunas y detalles con color por vértice), memorizadas y compartidas por
 * todos los coches: 3 draw calls por coche y ~2–3 mil triángulos. Morro hacia +z, ruedas en y = 0.
 */
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { BodyType } from '@/api/types'

interface ClaySpec {
  L: number
  W: number
  wheelR: number
  /** Hueco bajo la carrocería. */
  clear: number
  lowerH: number
  /** Habitáculo como fracciones de la longitud desde atrás: [base trasera, techo trasero, techo delantero, base delantera]. */
  cabin: [number, number, number, number]
  cabinH: number
  kind?: 'van' | 'pickup' | 'open'
}

const SPECS: Record<BodyType, ClaySpec> = {
  hatchback: { L: 4.05, W: 1.78, wheelR: 0.33, clear: 0.17, lowerH: 0.62, cabin: [0.05, 0.13, 0.56, 0.73], cabinH: 0.58 },
  sedan: { L: 4.65, W: 1.8, wheelR: 0.33, clear: 0.15, lowerH: 0.6, cabin: [0.22, 0.33, 0.6, 0.75], cabinH: 0.54 },
  wagon: { L: 4.75, W: 1.8, wheelR: 0.33, clear: 0.16, lowerH: 0.62, cabin: [0.04, 0.07, 0.6, 0.75], cabinH: 0.56 },
  suv: { L: 4.6, W: 1.9, wheelR: 0.4, clear: 0.26, lowerH: 0.76, cabin: [0.05, 0.09, 0.6, 0.74], cabinH: 0.64 },
  coupe: { L: 4.4, W: 1.82, wheelR: 0.33, clear: 0.13, lowerH: 0.55, cabin: [0.2, 0.36, 0.58, 0.75], cabinH: 0.46 },
  convertible: { L: 4.3, W: 1.8, wheelR: 0.32, clear: 0.14, lowerH: 0.58, cabin: [0.42, 0.44, 0.64, 0.72], cabinH: 0.4, kind: 'open' },
  minivan: { L: 4.9, W: 1.92, wheelR: 0.34, clear: 0.17, lowerH: 0.72, cabin: [0.04, 0.06, 0.7, 0.86], cabinH: 0.72 },
  van: { L: 5.3, W: 2.0, wheelR: 0.36, clear: 0.2, lowerH: 0.85, cabin: [0.62, 0.64, 0.78, 0.9], cabinH: 0.92, kind: 'van' },
  pickup: { L: 5.3, W: 1.95, wheelR: 0.4, clear: 0.26, lowerH: 0.78, cabin: [0.4, 0.43, 0.64, 0.75], cabinH: 0.64, kind: 'pickup' },
}

export interface ClayCarGeometry {
  paint: THREE.BufferGeometry
  glass: THREE.BufferGeometry
  /** Neumáticos, tapacubos, parachoques y pilotos (color por vértice). */
  trim: THREE.BufferGeometry
  size: { length: number; width: number; height: number }
}

const TYRE = new THREE.Color('#2a2e33')
const HUB = new THREE.Color('#c9ccd1')
const BUMPER = new THREE.Color('#41474e')
const HEAD = new THREE.Color('#fff3d2')
const TAIL = new THREE.Color('#c4473c')
const SEAT = new THREE.Color('#3b4148')

/** Prepara una pieza para fusionar: sin UV, sin índice y (si se da) con color por vértice. */
function prep(g: THREE.BufferGeometry, color?: THREE.Color): THREE.BufferGeometry {
  let out = g.index ? g.toNonIndexed() : g
  if (out !== g) g.dispose()
  out.deleteAttribute('uv')
  if (!out.getAttribute('normal')) out.computeVertexNormals()
  if (color) {
    const n = out.getAttribute('position').count
    const c = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      c[i * 3] = color.r
      c[i * 3 + 1] = color.g
      c[i * 3 + 2] = color.b
    }
    out.setAttribute('color', new THREE.BufferAttribute(c, 3))
  }
  return out
}

function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const g = mergeGeometries(parts, false)
  for (const p of parts) p.dispose()
  g.computeBoundingSphere()
  g.computeBoundingBox()
  return g
}

function box(w: number, h: number, d: number, r: number, x: number, y: number, z: number, seg = 3): THREE.BufferGeometry {
  const g = new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001))
  g.translate(x, y, z)
  return g
}

/** Prisma de perfil trapezoidal (en z/y) extruido a lo ancho (x), con bisel redondeado. */
function cabinPrism(zRB: number, zRT: number, zFT: number, zFB: number, y0: number, h: number, width: number, bevel = 0.06): THREE.BufferGeometry {
  const s = new THREE.Shape()
  s.moveTo(zRB, 0)
  s.lineTo(zFB, 0)
  s.lineTo(zFT, h)
  s.lineTo(zRT, h)
  s.closePath()
  const depth = Math.max(0.02, width - bevel * 2)
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 2, curveSegments: 1 })
  // forma (x→z del coche, y→y), extrusión (z→x del coche)
  g.rotateY(-Math.PI / 2)
  g.translate(depth / 2, y0, 0)
  return g
}

function build(type: BodyType): ClayCarGeometry {
  const s = SPECS[type]
  const { L, W, wheelR, clear, lowerH } = s
  const z = (f: number) => -L / 2 + f * L
  const top = clear + lowerH
  const paint: THREE.BufferGeometry[] = []
  const glass: THREE.BufferGeometry[] = []
  const trim: THREE.BufferGeometry[] = []

  // Carrocería baja
  paint.push(prep(box(W, lowerH, L, 0.2, 0, clear + lowerH / 2, 0, 4)))

  const [rb, rt, ft, fb] = s.cabin
  const cw = W * 0.84
  if (s.kind === 'open') {
    // descapotable: parabrisas fino y asientos
    glass.push(prep(cabinPrism(z(ft) - 0.05, z(ft) - 0.02, z(ft) + 0.02, z(fb), top - 0.02, s.cabinH, cw, 0.03)))
    for (const sx of [-1, 1]) trim.push(prep(box(0.56, 0.5, 0.55, 0.12, sx * W * 0.22, top + 0.18, z(0.5)), SEAT))
  } else {
    glass.push(prep(cabinPrism(z(rb), z(rt), z(ft), z(fb), top - 0.04, s.cabinH, cw)))
    // techo de pintura sobre las lunas
    const roofLen = z(ft) - z(rt) + 0.12
    paint.push(prep(box(cw + 0.08, 0.11, roofLen, 0.05, 0, top - 0.04 + s.cabinH + 0.03, (z(ft) + z(rt)) / 2)))
  }
  if (s.kind === 'van') {
    // caja de carga de pintura detrás de la cabina
    const cargoEnd = z(rt) + 0.1
    const cargoLen = cargoEnd - z(0.005)
    paint.push(prep(box(W * 0.98, s.cabinH + 0.12, cargoLen, 0.16, 0, top - 0.02 + (s.cabinH + 0.12) / 2, z(0.005) + cargoLen / 2, 4)))
  }
  if (s.kind === 'pickup') {
    // caja abierta: suelo oscuro hundido y bordes de pintura
    const b0 = z(0.03)
    const b1 = z(0.38)
    trim.push(prep(box(W * 0.8, 0.04, b1 - b0, 0.02, 0, top + 0.005, (b0 + b1) / 2, 1), SEAT))
    for (const sx of [-1, 1]) paint.push(prep(box(0.1, 0.22, b1 - b0, 0.04, sx * (W / 2 - 0.08), top + 0.1, (b0 + b1) / 2, 2)))
    paint.push(prep(box(W - 0.06, 0.22, 0.1, 0.04, 0, top + 0.1, b0 + 0.05, 2)))
  }

  // Ruedas con tapacubos
  const axle = Math.min(0.95, L * 0.2)
  for (const az of [L / 2 - axle, -L / 2 + axle]) {
    for (const sx of [-1, 1]) {
      const t = new THREE.CylinderGeometry(wheelR, wheelR, 0.3, 20, 1)
      t.rotateZ(Math.PI / 2)
      t.translate(sx * (W / 2 - 0.12), wheelR, az)
      trim.push(prep(t, TYRE))
      const h = new THREE.CylinderGeometry(wheelR * 0.52, wheelR * 0.52, 0.32, 14, 1)
      h.rotateZ(Math.PI / 2)
      h.translate(sx * (W / 2 - 0.12), wheelR, az)
      trim.push(prep(h, HUB))
    }
  }
  // Parachoques
  for (const end of [1, -1]) trim.push(prep(box(W * 0.97, 0.16, 0.16, 0.06, 0, clear + 0.12, end * (L / 2 - 0.02), 2), BUMPER))
  // Faros y pilotos
  for (const sx of [-1, 1]) {
    trim.push(prep(box(0.36, 0.11, 0.06, 0.03, sx * W * 0.31, clear + lowerH * 0.72, L / 2 + 0.005, 1), HEAD))
    trim.push(prep(box(0.32, 0.1, 0.06, 0.03, sx * W * 0.33, clear + lowerH * 0.74, -L / 2 - 0.005, 1), TAIL))
  }

  const height = s.kind === 'van' ? top + s.cabinH + 0.1 : top + s.cabinH + 0.1
  return { paint: merge(paint), glass: merge(glass), trim: merge(trim), size: { length: L, width: W, height } }
}

const cache = new Map<BodyType, ClayCarGeometry>()

export function getClayCar(type: BodyType): ClayCarGeometry {
  let g = cache.get(type)
  if (!g) {
    g = build(type)
    cache.set(type, g)
  }
  return g
}

// ───────────────────────── Materiales de arcilla (compartidos) ─────────────────────────

const paintCache = new Map<string, THREE.MeshStandardMaterial>()

/** Pintura de arcilla mate: roughness 0,7 y metalness 0,1, una por color. */
export function clayPaint(color: string): THREE.MeshStandardMaterial {
  let m = paintCache.get(color)
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.1 })
    paintCache.set(color, m)
  }
  return m
}

let trimMat: THREE.MeshStandardMaterial | null = null
export function clayTrim(): THREE.MeshStandardMaterial {
  trimMat ??= new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0.1 })
  return trimMat
}

const glassCache = new Map<string, THREE.MeshStandardMaterial>()
export function clayGlass(color: string): THREE.MeshStandardMaterial {
  let m = glassCache.get(color)
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.32, metalness: 0.1 })
    glassCache.set(color, m)
  }
  return m
}
