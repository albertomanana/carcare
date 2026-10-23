/**
 * Ensamblado del coche: carrocería + habitáculo + detalles + ruedas + accesorios, fusionado POR MATERIAL
 * (≈15–20 draw calls por coche). Se memoriza por (carrocería, detalle): lo comparten todos los lienzos,
 * el renderizador de miniaturas y los coches del taller. El color va en el material, no en la geometría.
 */
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import type { BodyType, Zone } from '@/api/types'
import { buildBodyDetails, buildGreenhouse, buildLowerBody, buildOpenWindshield, type Detail, type GeoPart, type MatKey } from './geometry'
import { buildInternals } from './internals'
import { matrix, mergeAll, transformed } from './merge'
import { clamp } from './profile'
import { getBodyShape, type BodyShape } from './shape'
import { getWheelParts } from './wheels'

export interface CarPart {
  mat: MatKey
  geometry: THREE.BufferGeometry
}

export interface CarBuild {
  type: BodyType
  detail: Detail
  shape: BodyShape
  /** Exterior + interior visible, fusionado por material. */
  parts: CarPart[]
  /** Habitáculo (techo y lunas) para pintar su cara interna en oscuro. */
  cabinShell: THREE.BufferGeometry | null
  /** Piezas solo para rayos X (motor, caja, batería, escape, suspensión), fusionadas por material. */
  xrayParts: CarPart[]
  /** Geometrías que se iluminan al seleccionar cada zona. */
  highlight: Record<Zone, THREE.BufferGeometry[]>
  size: { length: number; width: number; height: number }
}

const cache = new Map<string, CarBuild>()

export function getCarBuild(type: BodyType, detail: Detail = 'high'): CarBuild {
  const key = `${type}|${detail}`
  let b = cache.get(key)
  if (!b) {
    b = createCarBuild(type, detail)
    cache.set(key, b)
  }
  return b
}

/** Libera todas las geometrías memorizadas (p. ej. al salir de la app en tests). */
export function disposeCarBuilds() {
  for (const b of cache.values()) {
    for (const p of b.parts) p.geometry.dispose()
    for (const p of b.xrayParts) p.geometry.dispose()
    b.cabinShell?.dispose()
    for (const list of Object.values(b.highlight)) for (const g of list) g.dispose()
  }
  cache.clear()
}

function createCarBuild(type: BodyType, detail: Detail): CarBuild {
  const s = getBodyShape(type)
  const spec = s.spec
  const hi = detail === 'high'
  const byMat = new Map<MatKey, THREE.BufferGeometry[]>()
  const push = (mat: MatKey, g: THREE.BufferGeometry) => {
    let arr = byMat.get(mat)
    if (!arr) byMat.set(mat, (arr = []))
    arr.push(g)
  }
  const pushParts = (parts: GeoPart[]) => parts.forEach((p) => push(p.mat, p.geometry))

  const lower = buildLowerBody(s, detail)
  pushParts(lower)
  const gh = buildGreenhouse(s, detail)
  pushParts(gh)
  const details = buildBodyDetails(s, detail).parts
  pushParts(details)
  pushParts(buildOpenWindshield(s, detail))

  // ── Ruedas
  const wp = getWheelParts({ radius: s.wheelR, width: spec.tireWidth, rimRatio: spec.rimRatio, style: spec.rim }, detail)
  const wheelGeos: Record<'tire' | 'rimFace' | 'rimBarrel' | 'hub' | 'disc' | 'caliper', THREE.BufferGeometry[]> = {
    tire: [],
    rimFace: [],
    rimBarrel: [],
    hub: [],
    disc: [],
    caliper: [],
  }
  const caliperWorldAngle = (160 * Math.PI) / 180
  for (const ax of [s.axleFront, s.axleRear]) {
    for (const side of [1, -1]) {
      const m = matrix([ax, s.wheelR, side * s.wheelZ], [0, side > 0 ? 0 : Math.PI, 0])
      for (const k of ['tire', 'rimFace', 'rimBarrel', 'hub', 'disc'] as const) wheelGeos[k].push(transformed(wp[k], m))
      const local = side > 0 ? caliperWorldAngle : Math.PI - caliperWorldAngle
      const cm = m.clone().multiply(matrix([0, 0, 0], [0, 0, local]))
      wheelGeos.caliper.push(transformed(wp.caliper, cm))
    }
  }
  const tires = mergeAll(wheelGeos.tire)
  const discs = mergeAll(wheelGeos.disc)
  const calipers = mergeAll(wheelGeos.caliper)
  const rimFaces = mergeAll([...wheelGeos.rimFace, ...wheelGeos.hub])
  const barrels = mergeAll(wheelGeos.rimBarrel)
  for (const list of Object.values(wheelGeos)) for (const g of list) g.dispose()
  push('rubber', tires)
  push('rim', rimFaces)
  push('rimDark', barrels)
  push('disc', discs)
  push('caliper', calipers)

  // ── Retrovisores, tiradores y barras de techo
  const acc = accessories(s, hi)
  for (const a of acc) push(a.mat, a.geometry)

  // ── Interior visible e internos
  const internals = buildInternals(s, detail)
  const xrayByMat = new Map<MatKey, THREE.BufferGeometry[]>()
  const zoneInternals = new Map<Zone, THREE.BufferGeometry[]>()
  for (const p of internals) {
    if (p.visible) push(p.mat, p.geometry)
    else {
      let arr = xrayByMat.get(p.mat)
      if (!arr) xrayByMat.set(p.mat, (arr = []))
      arr.push(p.geometry)
    }
    let z = zoneInternals.get(p.zone)
    if (!z) zoneInternals.set(p.zone, (z = []))
    z.push(p.geometry)
  }

  // ── Fusión por material
  const parts: CarPart[] = []
  const merged = new Map<MatKey, THREE.BufferGeometry>()
  for (const [mat, list] of byMat) {
    const g = mergeAll(list, mat === 'grille')
    merged.set(mat, g)
    parts.push({ mat, geometry: g })
  }
  const xrayParts: CarPart[] = []
  for (const [mat, list] of xrayByMat) xrayParts.push({ mat, geometry: mergeAll(list) })

  // Resaltado por zona (geometrías fusionadas, una por zona)
  const z = (zone: Zone) => (zoneInternals.get(zone)?.length ? [mergeAll(zoneInternals.get(zone)!)] : [])
  const lights = details.filter((d) => d.zone === 'electrical').map((d) => d.geometry)
  const shell = mergeAll([...lower.filter((p) => p.mat === 'paint').map((p) => p.geometry), ...gh.map((p) => p.geometry)])
  const highlight: Record<Zone, THREE.BufferGeometry[]> = {
    engine: z('engine'),
    transmission: z('transmission'),
    brakes: [discs, calipers],
    tyres: [tires],
    suspension: z('suspension'),
    electrical: [...z('electrical'), mergeAll(lights)],
    body: [shell],
    interior: z('interior'),
    exhaust: z('exhaust'),
    general: [shell, tires],
  }

  // Liberar las piezas sueltas (ya están copiadas en las fusionadas)
  for (const list of byMat.values()) for (const g of list) if (!isShared(g, merged, highlight)) g.dispose()
  for (const p of internals) p.geometry.dispose()

  const cabinShell = gh.length ? mergeAll(gh.map((p) => p.geometry)) : null

  let height = 0
  for (const [, y] of s.top.samples) height = Math.max(height, y)
  if (s.roof) for (const [, y] of s.roof.samples) height = Math.max(height, y)
  if (spec.openWindshield) height = Math.max(height, spec.openWindshield.topY)

  return {
    type,
    detail,
    shape: s,
    parts,
    cabinShell,
    xrayParts,
    highlight,
    size: { length: s.front - s.rear, width: spec.width, height },
  }
}

/** Rectángulo de esquinas redondeadas centrado en el origen (plano XY). */
function roundedRect(w: number, h: number, r: number): THREE.Shape {
  const x = -w / 2
  const y = -h / 2
  const sh = new THREE.Shape()
  sh.moveTo(x + r, y)
  sh.lineTo(x + w - r, y)
  sh.quadraticCurveTo(x + w, y, x + w, y + r)
  sh.lineTo(x + w, y + h - r)
  sh.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  sh.lineTo(x + r, y + h)
  sh.quadraticCurveTo(x, y + h, x, y + h - r)
  sh.lineTo(x, y + r)
  sh.quadraticCurveTo(x, y, x + r, y)
  return sh
}

function isShared(g: THREE.BufferGeometry, merged: Map<MatKey, THREE.BufferGeometry>, hl: Record<Zone, THREE.BufferGeometry[]>) {
  for (const m of merged.values()) if (m === g) return true
  for (const list of Object.values(hl)) if (list.includes(g)) return true
  return false
}

function accessories(s: BodyShape, hi: boolean): GeoPart[] {
  const spec = s.spec
  const out: GeoPart[] = []

  // Retrovisores en la base del montante A
  if (s.ghRange) {
    const dloFront = spec.dlo ? spec.dlo.front : s.ghRange[1] - 0.2
    const mx = Math.min(dloFront - 0.06, s.ghRange[1] - 0.12)
    const g = s.gh(mx)
    if (g) {
      const big = spec.type === 'van' || spec.type === 'pickup'
      const dx = big ? 0.1 : 0.085 // fondo (eje x) de la carcasa en su parte trasera
      const dy = big ? 0.2 : 0.115 // alto
      const dz = big ? 0.2 : 0.2 // vuelo hacia fuera
      const r = Math.min(dx, dy) * 0.42
      const yC = g.yb + dy / 2 + 0.045
      const zIn = g.Wb + 0.035 // la carcasa empieza separada de la puerta (la une el brazo)
      for (const side of [1, -1]) {
        // Carcasa: caja redondeada deformada en "gota": la cara delantera se abomba (aerodinámica),
        // la trasera queda plana para el espejo y la punta exterior baja y se estrecha.
        const shell = new RoundedBoxGeometry(dx, dy, dz, hi ? 5 : 2, r)
        shell.deleteAttribute('uv')
        const pos = shell.getAttribute('position') as THREE.BufferAttribute
        for (let i = 0; i < pos.count; i++) {
          const x = pos.getX(i)
          const y = pos.getY(i)
          const zz = pos.getZ(i) / (dz / 2) // -1 (junto a la puerta) .. 1 (fuera)
          const yy = y / (dy / 2)
          const out = Math.max(0, zz)
          const k = 1 - 0.14 * out
          // abombado delantero: máximo en el centro de la cara, nulo en los bordes
          const bulge = x > 0 ? (x / (dx / 2)) * 0.05 * Math.max(0, 1 - yy * yy) * Math.max(0, 1 - zz * zz * 0.7) : 0
          // el lado de la puerta es más bajo (cuello hacia el brazo)
          const neck = 1 - 0.18 * Math.max(0, -zz) * Math.max(0, -zz)
          pos.setXYZ(i, x * k + bulge, y * k * neck - 0.012 * out, pos.getZ(i))
        }
        shell.computeVertexNormals()
        shell.translate(mx, yC, side * (zIn + dz / 2))
        out.push({ mat: 'paint', geometry: shell })
        // Espejo: placa redondeada en la cara trasera
        const glassShape = roundedRect(dz * 0.8, dy * 0.66, Math.min(dz, dy) * 0.18)
        const mirror = new THREE.ShapeGeometry(glassShape, hi ? 6 : 2)
        mirror.deleteAttribute('uv')
        // el plano XY mira a +z: girado mira a -x (hacia atrás); su ancho queda en z
        mirror.rotateY(-Math.PI / 2)
        mirror.translate(mx - (dx / 2) * 0.93 - 0.0015, yC - 0.004, side * (zIn + dz / 2 + 0.004))
        out.push({ mat: 'chrome', geometry: mirror })
        // Brazo: de la base del montante A a la carcasa
        const arm = new RoundedBoxGeometry(0.075, 0.035, zIn - g.Wb + 0.03, 1, 0.012)
        arm.deleteAttribute('uv')
        arm.translate(mx + 0.004, yC - dy * 0.22, side * (g.Wb + (zIn - g.Wb) / 2))
        out.push({ mat: 'trim', geometry: arm })
        // Base triangular (sail) en la esquina de la ventanilla
        const sail = new RoundedBoxGeometry(0.12, 0.07, 0.03, 1, 0.01)
        sail.deleteAttribute('uv')
        sail.translate(mx + 0.01, g.yb + 0.045, side * (g.Wb + 0.01))
        out.push({ mat: 'trim', geometry: sail })
      }
    }
  }

  // Tiradores de puerta
  const doorList = [...spec.doors].sort((a, b) => b - a)
  for (let i = 0; i < doorList.length - 1; i++) {
    const x1 = doorList[i]
    const x0 = doorList[i + 1]
    if (x1 - x0 < 0.45) continue
    if (spec.type === 'van' && i > 0) continue
    const hx = x0 + 0.17
    const c = s.lower(hx)
    const y = c.ys - 0.05
    const z = s.outerZ(c, clamp(y, c.yB, c.yT))
    if (z === null) continue
    for (const side of [1, -1]) {
      const h = new THREE.CapsuleGeometry(0.014, 0.12, 2, hi ? 8 : 4)
      h.deleteAttribute('uv')
      h.rotateZ(Math.PI / 2)
      h.scale(1, 1, 0.6)
      h.translate(hx, y, side * (z + 0.004))
      out.push({ mat: 'chrome', geometry: h })
    }
  }

  // Barras de techo
  if (spec.roofRails && s.roof && s.ghRange) {
    const xa = spec.rearGlassTopX + 0.12
    const xb = spec.windshieldTopX - 0.12
    for (const side of [1, -1]) {
      const pts: THREE.Vector3[] = []
      for (let k = 0; k <= 16; k++) {
        const x = xa + ((xb - xa) * k) / 16
        const g = s.gh(x)
        if (!g) continue
        const lift = k === 0 || k === 16 ? 0.012 : 0.045
        pts.push(new THREE.Vector3(x, g.yTop + lift, side * (g.cornerEnd[0] - 0.02)))
      }
      if (pts.length < 4) continue
      const curve = new THREE.CatmullRomCurve3(pts)
      const t = new THREE.TubeGeometry(curve, hi ? 64 : 20, 0.014, hi ? 8 : 4, false)
      t.deleteAttribute('uv')
      out.push({ mat: 'trim', geometry: t })
    }
  }
  return out
}
