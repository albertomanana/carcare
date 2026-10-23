/**
 * Forma derivada de una carrocería: secciones transversales, pasos de rueda, habitáculo y ventanillas.
 * Matemática pura (sin three.js): la usan la malla 3D, los anclajes de zonas y la silueta 2D.
 */
import type { BodyType } from '@/api/types'
import { clamp, makeProfile, smin, smoothstep, type Profile } from './profile'
import { BODY_SPECS, type BodySpec } from './specs'

export interface LowerSection {
  x: number
  taper: number
  /** Semiancho en el hombro (antes del redondeo en planta). */
  W: number
  yT: number
  yB: number
  ys: number
  rtz: number
  rty: number
  rbz: number
  rby: number
  crown: number
  /** Profundidad de caja/habitáculo abierto (0 = techo/capó cerrado). */
  d: number
  /** Semiancho interior de la caja/habitáculo abierto. */
  Wi: number
  tuckTop: number
  tuckBottom: number
}

export interface GreenhouseSection {
  x: number
  yb: number
  y0: number
  yTop: number
  h: number
  /** Semiancho de las lunas a la altura de la cintura. */
  Wb: number
  tumble: number
  crown: number
  /** Inicio del arco superior (lado) y final (techo). */
  cornerStart: [number, number]
  cornerEnd: [number, number]
  cornerCenter: [number, number]
  cornerRadius: number
  cornerA0: number
  cornerA1: number
}

export interface BodyShape {
  spec: BodySpec
  front: number
  rear: number
  halfWidth: number
  axleFront: number
  axleRear: number
  wheelR: number
  archR: number
  /** z del centro de la rueda (cara exterior del neumático casi a ras de la aleta). */
  wheelZ: number
  top: Profile
  bottom: Profile
  roof: Profile | null
  /** Rango x del habitáculo con techo. */
  ghRange: [number, number] | null
  taper(x: number): number
  bottomAt(x: number): number
  lower(x: number): LowerSection
  outerZ(sec: LowerSection, y: number): number | null
  gh(x: number): GreenhouseSection | null
  ghSideZ(g: GreenhouseSection, y: number): number
  /** Ventanilla lateral: límites verticales en x (null si no hay luna en esa x). */
  dloAt(x: number): [number, number] | null
  dloRange: [number, number] | null
}

const cache = new Map<BodyType, BodyShape>()

export function getBodyShape(type: BodyType): BodyShape {
  let s = cache.get(type)
  if (!s) {
    s = createBodyShape(BODY_SPECS[type])
    cache.set(type, s)
  }
  return s
}

function createBodyShape(spec: BodySpec): BodyShape {
  const top = makeProfile(spec.topLine)
  const bottom = makeProfile(spec.bottomLine)
  const roof = spec.roofLine ? makeProfile(spec.roofLine) : null
  const front = top.xMax
  const rear = top.xMin
  const halfWidth = spec.width / 2
  const axleFront = spec.wheelbase / 2
  const axleRear = -spec.wheelbase / 2
  const wheelR = spec.wheelRadius
  const archR = wheelR + spec.archGap
  const wheelZ = halfWidth - 0.025 - spec.tireWidth / 2

  const [lf, pf] = spec.planFront
  const [lr, pr] = spec.planRear

  function taper(x: number) {
    if (x > front - lf) {
      const u = clamp((x - (front - lf)) / lf, 0, 1)
      return Math.pow(Math.max(0, 1 - Math.pow(u, pf)), 1 / pf)
    }
    if (x < rear + lr) {
      const u = clamp((rear + lr - x) / lr, 0, 1)
      return Math.pow(Math.max(0, 1 - Math.pow(u, pr)), 1 / pr)
    }
    return 1
  }

  function archY(x: number) {
    let y = -Infinity
    for (const ax of [axleFront, axleRear]) {
      const dx = Math.abs(x - ax)
      if (dx < archR) {
        const p = spec.archShape
        y = Math.max(y, wheelR + archR * Math.pow(1 - Math.pow(dx / archR, p), 1 / p))
      }
    }
    return y
  }

  function bottomAt(x: number) {
    return Math.max(bottom.at(x), archY(x))
  }

  function flareAt(x: number) {
    const a = Math.exp(-Math.pow((x - axleFront) / 0.55, 2))
    const b = Math.exp(-Math.pow((x - axleRear) / 0.55, 2))
    return spec.flare * Math.max(a, b * 1.15)
  }

  function openDepth(x: number): { d: number; wall: number } {
    const o = spec.bed ?? spec.cockpit
    if (!o) return { d: 0, wall: 0 }
    if (x >= o.from && x <= o.to) return { d: o.depth, wall: o.wall }
    return { d: 0, wall: o.wall }
  }

  function lower(x: number): LowerSection {
    const yT = top.at(x)
    const yB = Math.min(bottomAt(x), yT - 0.02)
    const H = yT - yB
    const rty = Math.min(spec.rTop, H * 0.4)
    const rby = Math.min(spec.rBottom, H * 0.22)
    const W = halfWidth + flareAt(x)
    const rtz = Math.min(rty * 1.15, W * 0.4)
    const rbz = rby
    const ys = clamp(yT - spec.shoulderDrop, yB + rby + 0.005, yT - rty - 0.005)
    const { d, wall } = openDepth(x)
    const cz = W - spec.tuckTop - rtz
    const Wi = d > 0 ? Math.min(cz, W - wall) : cz * 0.82
    return {
      x,
      taper: taper(x),
      W,
      yT,
      yB,
      ys,
      rtz,
      rty,
      rbz,
      rby,
      crown: spec.hoodCrown,
      d,
      Wi,
      tuckTop: spec.tuckTop,
      tuckBottom: spec.tuckBottom,
    }
  }

  function outerZ(sec: LowerSection, y: number): number | null {
    const { yT, yB, rty, rtz, rby, rbz, W, ys } = sec
    if (y > yT + 1e-6 || y < yB - 1e-6) return null
    const zTop = W - sec.tuckTop
    const zBot = W - sec.tuckBottom
    let z: number
    if (y >= yT - rty) {
      const s = clamp((y - (yT - rty)) / rty, 0, 1)
      z = zTop - rtz + rtz * Math.sqrt(1 - s * s)
    } else if (y <= yB + rby) {
      const s = clamp((yB + rby - y) / rby, 0, 1)
      z = zBot - rbz + rbz * Math.sqrt(1 - s * s)
    } else if (y >= ys) {
      const t = clamp((y - ys) / Math.max(1e-4, yT - rty - ys), 0, 1)
      z = W - sec.tuckTop * Math.sin((Math.PI / 2) * t)
    } else {
      const t = clamp((ys - y) / Math.max(1e-4, ys - (yB + rby)), 0, 1)
      z = W - sec.tuckBottom * smoothstep(0, 1, t)
    }
    return z * sec.taper
  }

  // ── Habitáculo ──
  let ghRange: [number, number] | null = null
  if (roof) {
    let a = Infinity
    let b = -Infinity
    for (let x = roof.xMin; x <= roof.xMax; x += 0.002) {
      if (roof.at(x) - top.at(x) > 0.001) {
        a = Math.min(a, x)
        b = Math.max(b, x)
      }
    }
    if (a < b) ghRange = [a - 0.002, b + 0.002]
  }

  function gh(x: number): GreenhouseSection | null {
    if (!roof || !ghRange || x < ghRange[0] || x > ghRange[1]) return null
    const yb = top.at(x)
    const yTop = Math.max(yb, roof.at(x))
    const h = yTop - yb
    const sec = lower(x)
    const Wb = Math.max(0.02, (sec.W - sec.tuckTop) * sec.taper - spec.ghInset)
    const tumble = spec.tumble
    const crown = spec.roofCrown * clamp(h / 0.3, 0, 1)
    // Empalme entre el lateral (inclinado) y el techo (horizontal)
    const pz = Wb - tumble * h // esquina "viva" a la altura del techo
    const dsx = -tumble
    const dsy = 1
    const dsl = Math.hypot(dsx, dsy)
    const ux = dsx / dsl
    const uy = dsy / dsl
    const turn = Math.PI / 2 - Math.atan(tumble)
    const rMax = Math.min(spec.ghCorner, h * 0.45, pz * 0.45)
    const r = Math.max(0, rMax)
    const t = r * Math.tan(turn / 2)
    const c1: [number, number] = [pz - ux * t, yTop - uy * t]
    const c2: [number, number] = [pz - t, yTop]
    // centro: desde c2 hacia abajo r
    const cc: [number, number] = [c2[0], yTop - r]
    const a0 = Math.atan2(c1[1] - cc[1], c1[0] - cc[0])
    const a1 = Math.PI / 2
    return {
      x,
      yb,
      y0: yb - 0.035,
      yTop,
      h,
      Wb,
      tumble,
      crown,
      cornerStart: c1,
      cornerEnd: c2,
      cornerCenter: cc,
      cornerRadius: r,
      cornerA0: a0,
      cornerA1: a1,
    }
  }

  function ghSideZ(g: GreenhouseSection, y: number) {
    return g.Wb - g.tumble * (y - g.yb)
  }

  // ── Ventanillas laterales ──
  const dlo = spec.dlo
  function dloAt(x: number): [number, number] | null {
    if (!dlo) return null
    const g = gh(x)
    if (!g) return null
    const yLow = g.yb + 0.03
    let yHigh = g.cornerStart[1] - 0.025
    const fe = yLow + (dlo.front - x) * dlo.frontSlope
    const re = yLow + (x - dlo.rear) * dlo.rearSlope
    yHigh = smin(yHigh, fe, 0.04)
    yHigh = smin(yHigh, re, 0.04)
    if (yHigh - yLow < 0.004) return null
    return [yLow, yHigh]
  }
  let dloRange: [number, number] | null = null
  if (dlo && ghRange) {
    let a = Infinity
    let b = -Infinity
    for (let x = ghRange[0]; x <= ghRange[1]; x += 0.002) {
      if (dloAt(x)) {
        a = Math.min(a, x)
        b = Math.max(b, x)
      }
    }
    if (a < b) dloRange = [a, b]
  }

  return {
    spec,
    front,
    rear,
    halfWidth,
    axleFront,
    axleRear,
    wheelR,
    archR,
    wheelZ,
    top,
    bottom,
    roof,
    ghRange,
    taper,
    bottomAt,
    lower,
    outerZ,
    gh,
    ghSideZ,
    dloAt,
    dloRange,
  }
}
