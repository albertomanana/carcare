/**
 * Rueda procedural: neumático torneado (lathe) con hombro y surcos, llanta con radios (forma con huecos extruida
 * con bisel), labio, buje con tuercas, disco de freno y pinza. Eje de la rueda = +z (cara exterior hacia +z).
 */
import * as THREE from 'three'
import type { RimStyle } from './specs'
import type { Detail } from './geometry'
import { mergeAll } from './merge'

export interface WheelParts {
  tire: THREE.BufferGeometry
  rimFace: THREE.BufferGeometry
  rimBarrel: THREE.BufferGeometry
  hub: THREE.BufferGeometry
  disc: THREE.BufferGeometry
  caliper: THREE.BufferGeometry
}

export interface WheelDims {
  radius: number
  width: number
  rimRatio: number
  style: RimStyle
}

const V2 = (x: number, y: number) => new THREE.Vector2(x, y)

/** Lathe alrededor de Y y girado para que el eje sea Z. */
function latheZ(points: THREE.Vector2[], segments: number) {
  const g = new THREE.LatheGeometry(points, segments)
  g.rotateX(Math.PI / 2)
  g.deleteAttribute('uv')
  return g
}

/** Suaviza un polígono cerrado (Chaikin): esquinas redondeadas sin calcular empalmes. */
function chaikin(pts: THREE.Vector2[], iterations: number) {
  let p = pts
  for (let it = 0; it < iterations; it++) {
    const out: THREE.Vector2[] = []
    for (let i = 0; i < p.length; i++) {
      const a = p[i]
      const b = p[(i + 1) % p.length]
      out.push(V2(a.x * 0.75 + b.x * 0.25, a.y * 0.75 + b.y * 0.25), V2(a.x * 0.25 + b.x * 0.75, a.y * 0.25 + b.y * 0.75))
    }
    p = out
  }
  return p
}

function tireGeometry(R: number, w: number, rb: number, hi: boolean) {
  const h = w / 2
  const side = R - rb
  const pts: THREE.Vector2[] = []
  const add = (r: number, a: number) => pts.push(V2(r, a))
  // de la cara interior (a = -h) a la exterior (a = +h)
  add(rb - 0.004, -h * 0.8)
  add(rb + side * 0.12, -h * 0.94)
  add(rb + side * 0.45, -h * 1.0)
  add(rb + side * 0.78, -h * 0.98)
  add(R - 0.022, -h * 0.9)
  add(R - 0.006, -h * 0.78)
  add(R, -h * 0.66)
  // banda de rodadura con dos surcos
  const grooves = [-0.3, 0.3]
  for (const gc of grooves) {
    add(R, h * (gc - 0.07))
    add(R - 0.009, h * (gc - 0.05))
    add(R - 0.009, h * (gc + 0.05))
    add(R, h * (gc + 0.07))
  }
  add(R, h * 0.66)
  add(R - 0.006, h * 0.78)
  add(R - 0.022, h * 0.9)
  add(rb + side * 0.78, h * 0.98)
  add(rb + side * 0.45, h * 1.0)
  add(rb + side * 0.12, h * 0.94)
  add(rb - 0.004, h * 0.8)
  return latheZ(pts, hi ? 72 : 28)
}

/** Corona de la llanta con huecos entre radios. */
function rimFaceGeometry(rFace: number, style: RimStyle, hi: boolean) {
  const n = style === 'six' ? 6 : style === 'multi' ? 10 : 5
  const spokeW = style === 'multi' ? rFace * 0.11 : style === 'six' ? rFace * 0.2 : style === 'aero' ? rFace * 0.42 : rFace * 0.24
  const r2 = rFace * (style === 'aero' ? 0.8 : 0.86)
  let r1 = rFace * (style === 'aero' ? 0.5 : 0.36)
  const hw = (r: number) => Math.PI / n - Math.asin(Math.min(1, spokeW / (2 * r)))
  while (hw(r1) < 0.08 && r1 < r2 - 0.02) r1 += 0.005

  const shape = new THREE.Shape()
  shape.absarc(0, 0, rFace, 0, Math.PI * 2, false)
  const steps = hi ? 10 : 5
  for (let k = 0; k < n; k++) {
    const c = (k / n) * Math.PI * 2 + Math.PI / 2
    const poly: THREE.Vector2[] = []
    for (let i = 0; i <= steps; i++) {
      const a = c - hw(r2) + (2 * hw(r2) * i) / steps
      poly.push(V2(Math.cos(a) * r2, Math.sin(a) * r2))
    }
    for (let i = 1; i < steps; i++) {
      const r = r2 + ((r1 - r2) * i) / steps
      const a = c + hw(r)
      poly.push(V2(Math.cos(a) * r, Math.sin(a) * r))
    }
    for (let i = 0; i <= steps; i++) {
      const a = c + hw(r1) - (2 * hw(r1) * i) / steps
      poly.push(V2(Math.cos(a) * r1, Math.sin(a) * r1))
    }
    for (let i = 1; i < steps; i++) {
      const r = r1 + ((r2 - r1) * i) / steps
      const a = c - hw(r)
      poly.push(V2(Math.cos(a) * r, Math.sin(a) * r))
    }
    const smooth = chaikin(poly, hi ? 2 : 1)
    shape.holes.push(new THREE.Path(smooth))
  }
  const depth = 0.022
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.007,
    bevelSize: 0.0045,
    bevelSegments: hi ? 3 : 1,
    curveSegments: hi ? 64 : 24,
  })
  g.deleteAttribute('uv')
  g.translate(0, 0, -depth)
  return g
}

function hubGeometry(rFace: number, lugs: number, hi: boolean) {
  const seg = hi ? 32 : 14
  const parts: THREE.BufferGeometry[] = []
  const cap = new THREE.CylinderGeometry(rFace * 0.17, rFace * 0.2, 0.02, seg)
  cap.rotateX(Math.PI / 2)
  cap.translate(0, 0, 0.012)
  parts.push(cap)
  const nut = new THREE.CylinderGeometry(rFace * 0.035, rFace * 0.04, 0.02, 6)
  nut.rotateX(Math.PI / 2)
  for (let k = 0; k < lugs; k++) {
    const a = (k / lugs) * Math.PI * 2
    const c = nut.clone()
    c.translate(Math.cos(a) * rFace * 0.27, Math.sin(a) * rFace * 0.27, 0.006)
    parts.push(c)
  }
  nut.dispose()
  return parts
}

function discGeometry(r0: number, r1: number, t: number, hi: boolean) {
  const h = t / 2
  // perfil cerrado con esquinas duplicadas (aristas vivas)
  const p = [V2(r0, -h), V2(r0, -h), V2(r1, -h), V2(r1, -h), V2(r1, h), V2(r1, h), V2(r0, h), V2(r0, h), V2(r0, -h)]
  return latheZ(p, hi ? 48 : 20)
}

function caliperGeometry(rDisc: number, hi: boolean) {
  const a0 = -0.42
  const a1 = 0.42
  const ri = rDisc - 0.085
  const ro = rDisc + 0.018
  const s = new THREE.Shape()
  const N = hi ? 12 : 5
  for (let i = 0; i <= N; i++) {
    const a = a0 + ((a1 - a0) * i) / N
    const v = V2(Math.cos(a) * ro, Math.sin(a) * ro)
    if (i === 0) s.moveTo(v.x, v.y)
    else s.lineTo(v.x, v.y)
  }
  for (let i = N; i >= 0; i--) {
    const a = a0 + ((a1 - a0) * i) / N
    s.lineTo(Math.cos(a) * ri, Math.sin(a) * ri)
  }
  s.closePath()
  const depth = 0.05
  const g = new THREE.ExtrudeGeometry(s, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.01,
    bevelSegments: hi ? 3 : 1,
    curveSegments: 4,
  })
  g.deleteAttribute('uv')
  g.translate(0, 0, -depth / 2)
  return g
}

const cache = new Map<string, WheelParts & { dims: WheelDims; faceZ: number; discZ: number; rDisc: number }>()

/**
 * Piezas de UNA rueda en su espacio local (centro en el origen, eje +z, cara exterior en +z).
 * La pinza se coloca a ángulo 0 (+x); el ensamblador la gira.
 */
export function getWheelParts(dims: WheelDims, detail: Detail) {
  const key = `${dims.radius}|${dims.width}|${dims.rimRatio}|${dims.style}|${detail}`
  const hit = cache.get(key)
  if (hit) return hit
  const hi = detail === 'high'
  const R = dims.radius
  const w = dims.width
  const rb = R * dims.rimRatio
  const rFace = rb - 0.012
  const faceZ = w * 0.34
  const tire = tireGeometry(R, w, rb, hi)

  const face = rimFaceGeometry(rFace, dims.style, hi)
  face.translate(0, 0, faceZ)

  // Barril (interior oscuro) + labio exterior
  const barrel = latheZ(
    [V2(rb - 0.006, -w * 0.42), V2(rb - 0.006, -w * 0.42), V2(rb - 0.012, -w * 0.4), V2(rb - 0.016, faceZ - 0.03), V2(rb - 0.016, faceZ + 0.004)],
    hi ? 56 : 24,
  )
  const lip = new THREE.TorusGeometry(rb - 0.004, 0.0085, hi ? 8 : 4, hi ? 72 : 28)
  lip.deleteAttribute('uv')
  lip.translate(0, 0, faceZ + 0.006)

  const hubParts = hubGeometry(rFace, dims.style === 'six' ? 6 : 5, hi)
  for (const h of hubParts) h.translate(0, 0, faceZ - 0.012)

  const rDisc = Math.min(rb - 0.05, R * 0.56)
  const discZ = -w * 0.04
  const disc = discGeometry(rFace * 0.32, rDisc, 0.026, hi)
  const hat = new THREE.CylinderGeometry(rFace * 0.33, rFace * 0.33, 0.06, hi ? 28 : 12)
  hat.rotateX(Math.PI / 2)
  hat.translate(0, 0, discZ + 0.02)
  hat.deleteAttribute('uv')
  disc.translate(0, 0, discZ)

  const caliper = caliperGeometry(rDisc, hi)
  caliper.translate(0, 0, discZ + 0.004)

  const out = {
    tire,
    rimFace: mergeLocal([face, lip]),
    rimBarrel: barrel,
    hub: mergeLocal(hubParts),
    disc: mergeLocal([disc, hat]),
    caliper,
    dims,
    faceZ,
    discZ,
    rDisc,
  }
  cache.set(key, out)
  return out
}

function mergeLocal(geos: THREE.BufferGeometry[]) {
  const out = mergeAll(geos)
  for (const g of geos) g.dispose()
  return out
}
