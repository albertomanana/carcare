/**
 * Componentes interiores SIMPLIFICADOS e ilustrativos (no representan el vehículo real):
 * motor, caja de cambios y palieres, batería, escape, muelles/amortiguadores y habitáculo (asientos, salpicadero, volante).
 * Sirven para la vista de rayos X y para resaltar la zona seleccionada.
 */
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import type { Zone } from '@/api/types'
import type { Detail, MatKey } from './geometry'
import type { BodyShape } from './shape'

export interface InternalPart {
  zone: Zone
  mat: MatKey
  geometry: THREE.BufferGeometry
  /** true ⇒ también se ve en modo normal (interior a través de las lunas, cola de escape). */
  visible?: boolean
}

function rbox(w: number, h: number, d: number, r: number, hi: boolean) {
  const g = new RoundedBoxGeometry(w, h, d, hi ? 3 : 1, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3))
  g.deleteAttribute('uv')
  return g
}

function cyl(r0: number, r1: number, h: number, seg: number) {
  const g = new THREE.CylinderGeometry(r0, r1, h, seg)
  g.deleteAttribute('uv')
  return g
}

function tube(points: THREE.Vector3[], r: number, hi: boolean, tension = 0.5) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', tension)
  const g = new THREE.TubeGeometry(curve, hi ? 96 : 32, r, hi ? 12 : 6, false)
  g.deleteAttribute('uv')
  return g
}

/** Muelle helicoidal: tubo siguiendo una hélice (eje Y). */
function coil(radius: number, wire: number, height: number, turns: number, hi: boolean) {
  const pts: THREE.Vector3[] = []
  const N = turns * (hi ? 24 : 10)
  for (let i = 0; i <= N; i++) {
    const t = i / N
    const a = t * turns * Math.PI * 2
    pts.push(new THREE.Vector3(Math.cos(a) * radius, t * height - height / 2, Math.sin(a) * radius))
  }
  const curve = new THREE.CatmullRomCurve3(pts)
  const g = new THREE.TubeGeometry(curve, N * 2, wire, hi ? 6 : 4, false)
  g.deleteAttribute('uv')
  return g
}

export function buildInternals(s: BodyShape, detail: Detail): InternalPart[] {
  const hi = detail === 'high'
  const spec = s.spec
  const out: InternalPart[] = []
  const add = (zone: Zone, mat: MatKey, geometry: THREE.BufferGeometry, visible = false) => out.push({ zone, mat, geometry, visible })
  const hw = s.halfWidth

  // ── Motor (transversal, sobre el eje delantero)
  const eL = 0.46
  const eW = Math.min(0.66, hw * 0.72)
  const eH = 0.34
  const ex = s.axleFront + 0.12
  const hoodY = s.top.at(ex)
  const floorY = s.bottom.at(ex)
  const ey = Math.max(floorY + 0.06 + eH / 2, Math.min(hoodY - 0.14 - eH / 2, s.wheelR + 0.16))
  {
    const block = rbox(eL, eH, eW, 0.05, hi)
    block.translate(ex, ey, -0.04)
    add('engine', 'engine', block)
    const cover = rbox(eL * 0.62, 0.075, eW * 0.86, 0.03, hi)
    cover.translate(ex - 0.02, ey + eH / 2 + 0.035, -0.04)
    add('engine', 'engineDark', cover)
    const plenum = cyl(0.055, 0.055, eW * 0.8, hi ? 20 : 8)
    plenum.rotateX(Math.PI / 2)
    plenum.translate(ex + eL / 2 + 0.02, ey + eH / 2 - 0.02, -0.04)
    add('engine', 'engine', plenum)
    for (let k = 0; k < 4; k++) {
      const z = -0.04 - eW * 0.3 + (eW * 0.6 * k) / 3
      const runner = tube(
        [
          new THREE.Vector3(ex + 0.05, ey + eH / 2 + 0.02, z),
          new THREE.Vector3(ex + eL / 2 - 0.02, ey + eH / 2 + 0.07, z),
          new THREE.Vector3(ex + eL / 2 + 0.04, ey + eH / 2 + 0.0, z),
        ],
        0.018,
        hi,
      )
      add('engine', 'engine', runner)
    }
    const pulley = cyl(0.08, 0.08, 0.04, hi ? 24 : 10)
    pulley.rotateX(Math.PI / 2)
    pulley.translate(ex + 0.08, ey - 0.04, -0.04 + eW / 2 + 0.03)
    add('engine', 'engineDark', pulley)
    const pan = rbox(eL * 0.8, 0.09, eW * 0.7, 0.03, hi)
    pan.translate(ex, ey - eH / 2 - 0.03, -0.04)
    add('engine', 'engineDark', pan)
  }

  // ── Caja de cambios y palieres
  {
    const gz = -0.04 - eW / 2 - 0.13
    const bell = cyl(0.17, 0.12, 0.26, hi ? 28 : 10)
    bell.rotateX(Math.PI / 2)
    bell.translate(ex - 0.04, ey - 0.03, gz)
    add('transmission', 'engineDark', bell)
    const box = rbox(0.3, 0.24, 0.2, 0.05, hi)
    box.translate(ex - 0.12, ey - 0.06, gz - 0.02)
    add('transmission', 'engine', box)
    for (const side of [1, -1]) {
      const shaft = tube(
        [
          new THREE.Vector3(ex - 0.06, ey - 0.08, side > 0 ? -0.04 + eW / 2 - 0.05 : gz),
          new THREE.Vector3(s.axleFront, s.wheelR, side * (s.wheelZ - spec.tireWidth / 2 - 0.02)),
        ],
        0.022,
        hi,
      )
      add('transmission', 'spring', shaft)
    }
  }

  // ── Batería
  {
    const bx = ex + 0.02
    const bz = Math.min(hw * 0.62, -0.04 + eW / 2 + 0.2)
    const by = Math.min(hoodY - 0.26, ey + 0.05)
    const bat = rbox(0.24, 0.19, 0.17, 0.015, hi)
    bat.translate(bx, by, bz)
    add('electrical', 'battery', bat)
    const top = rbox(0.25, 0.03, 0.18, 0.01, hi)
    top.translate(bx, by + 0.105, bz)
    add('electrical', 'engineDark', top)
    for (const dx of [-0.07, 0.07]) {
      const term = cyl(0.014, 0.016, 0.03, 10)
      term.translate(bx + dx, by + 0.13, bz + 0.04)
      add('electrical', 'chrome', term)
    }
  }

  // ── Escape: del colector al silenciador y a la cola (lado derecho, +z)
  {
    const z = hw * 0.36
    const xTip = s.rear + 0.06
    const underY = (x: number) => s.bottom.at(x) - 0.055
    const muffX = s.axleRear - s.archR - 0.18
    const tipY = Math.max(0.16, s.bottom.at(s.rear + 0.2) - 0.035)
    const path = [
      new THREE.Vector3(ex + eL / 2 - 0.02, ey - 0.02, 0.0),
      new THREE.Vector3(ex + eL / 2 + 0.04, ey - eH / 2 - 0.02, 0.04),
      new THREE.Vector3(ex - 0.1, underY(ex - 0.1), z * 0.4),
      new THREE.Vector3(s.axleFront - 0.6, underY(s.axleFront - 0.6), z * 0.7),
      new THREE.Vector3((s.axleFront + s.axleRear) / 2, underY(0), z),
      new THREE.Vector3(muffX + 0.4, underY(muffX + 0.4), z),
    ]
    add('exhaust', 'exhaust', tube(path, 0.026, hi))
    const cat = new THREE.CapsuleGeometry(0.06, 0.22, hi ? 6 : 3, hi ? 16 : 8)
    cat.deleteAttribute('uv')
    cat.rotateZ(Math.PI / 2)
    cat.translate(s.axleFront - 0.55, underY(s.axleFront - 0.55) + 0.01, z * 0.68)
    add('exhaust', 'exhaust', cat)
    const muff = new THREE.CapsuleGeometry(0.085, 0.36, hi ? 6 : 3, hi ? 20 : 8)
    muff.deleteAttribute('uv')
    muff.rotateZ(Math.PI / 2)
    muff.scale(1, 0.8, 1.25)
    muff.translate(muffX + 0.05, underY(muffX) + 0.01, z)
    add('exhaust', 'exhaust', muff)
    const toRear = tube(
      [
        new THREE.Vector3(muffX - 0.2, underY(muffX) + 0.01, z),
        new THREE.Vector3(s.axleRear, Math.min(underY(s.axleRear), s.wheelR - 0.06), z),
        new THREE.Vector3(s.rear + 0.3, tipY, z),
        new THREE.Vector3(xTip + 0.08, tipY, z),
      ],
      0.024,
      hi,
    )
    add('exhaust', 'exhaust', toRear)
    // Cola cromada (visible también en modo normal)
    const tip = cyl(0.036, 0.034, 0.16, hi ? 24 : 10)
    tip.rotateZ(Math.PI / 2)
    tip.translate(xTip, tipY, z)
    add('exhaust', 'chrome', tip, true)
    const tipIn = cyl(0.026, 0.026, 0.012, hi ? 20 : 8)
    tipIn.rotateZ(Math.PI / 2)
    tipIn.translate(xTip - 0.077, tipY, z)
    add('exhaust', 'underbody', tipIn, true)
  }

  // ── Suspensión: muelle + amortiguador por rueda
  for (const ax of [s.axleFront, s.axleRear]) {
    for (const side of [1, -1]) {
      const z = side * (s.wheelZ - spec.tireWidth / 2 - 0.1)
      const h = Math.max(0.24, s.archR + 0.02)
      const y = s.wheelR + h / 2 + 0.02
      const spring = coil(0.065, 0.011, h * 0.8, 6, hi)
      spring.translate(ax + (ax > 0 ? -0.03 : 0.03), y, z)
      add('suspension', 'spring', spring)
      const shock = cyl(0.022, 0.022, h * 1.05, hi ? 12 : 6)
      shock.translate(ax + (ax > 0 ? -0.03 : 0.03), y, z)
      add('suspension', 'engineDark', shock)
      const arm = rbox(0.36, 0.035, 0.24, 0.012, hi)
      arm.translate(ax, s.wheelR - 0.08, z - side * 0.12)
      add('suspension', 'engineDark', arm)
    }
  }

  // ── Habitáculo: asientos, salpicadero y volante (visibles a través de las lunas)
  {
    const seatRow = (sx: number, bench: boolean) => {
      const floor = s.bottom.at(sx) + 0.1
      const belt = s.top.at(sx)
      const cushionY = Math.max(floor + 0.2, belt - 0.42)
      const zs = bench ? [0] : [hw * 0.42, -hw * 0.42]
      const wSeat = bench ? hw * 1.45 : 0.5
      for (const z of zs) {
        const cushion = rbox(0.5, 0.13, wSeat, 0.05, hi)
        cushion.translate(sx + 0.02, cushionY, z)
        add('interior', 'seat', cushion, true)
        const back = rbox(0.12, 0.58, wSeat, 0.05, hi)
        back.rotateZ(0.2)
        back.translate(sx - 0.22, cushionY + 0.3, z)
        add('interior', 'seat', back, true)
        const heads = bench ? [hw * 0.45, -hw * 0.45] : [0]
        for (const hz of heads) {
          const head = rbox(0.1, 0.16, 0.26, 0.04, hi)
          head.rotateZ(0.18)
          head.translate(sx - 0.29, cushionY + 0.67, z + hz)
          add('interior', 'seat', head, true)
        }
      }
    }
    seatRow(spec.seats.frontX, false)
    if (spec.seats.rearX !== null) seatRow(spec.seats.rearX, true)

    const wsBase = s.ghRange ? s.ghRange[1] : (spec.openWindshield?.baseX ?? s.axleFront - 0.2)
    const dashX = wsBase - 0.32
    const dashY = s.top.at(dashX) - 0.06
    const dash = rbox(0.42, 0.2, hw * 1.7, 0.06, hi)
    dash.translate(dashX, dashY, 0)
    add('interior', 'interior', dash, true)
    const wheel = new THREE.TorusGeometry(0.18, 0.02, hi ? 10 : 6, hi ? 40 : 16)
    wheel.deleteAttribute('uv')
    wheel.rotateY(Math.PI / 2)
    wheel.rotateZ(0.42)
    wheel.translate(dashX - 0.3, dashY + 0.05, -hw * 0.42)
    add('interior', 'seat', wheel, true)
  }

  return out
}
