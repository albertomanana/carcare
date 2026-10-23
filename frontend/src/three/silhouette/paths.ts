/**
 * Trazados SVG de la vista lateral, derivados de la MISMA forma matemática que el modelo 3D (car/shape.ts).
 * Sin three.js: entra en el bundle inicial y sirve de respaldo universal.
 */
import type { BodyType } from '@/api/types'
import { getBodyShape } from '../car/shape'

export interface SilhouettePaths {
  viewBox: [number, number, number, number]
  body: string
  cabin: string | null
  glass: string | null
  pillars: string[]
  /** Parabrisas suelto del descapotable (polígono). */
  openWindshield: string | null
  seats: string[]
  shoulder: string
  sill: string
  doors: string[]
  headlight: string
  taillight: string
  wheels: { cx: number; cy: number; r: number; rim: number; arch: number }[]
  spokes: number
  groundY: number
  length: number
}

const cache = new Map<BodyType, SilhouettePaths>()

/** En SVG la y crece hacia abajo: invertimos. 3 decimales bastan (mm). */
const P = (x: number, y: number) => `${x.toFixed(3)} ${(-y).toFixed(3)}`

function poly(pts: [number, number][]) {
  return `M${pts.map(([x, y]) => P(x, y)).join('L')}Z`
}

export function getSilhouettePaths(type: BodyType): SilhouettePaths {
  const hit = cache.get(type)
  if (hit) return hit
  const s = getBodyShape(type)
  const spec = s.spec
  const step = 0.01

  // ── Carrocería baja: línea superior (trasera→morro) y línea inferior con pasos de rueda (morro→trasera)
  const pts: [number, number][] = []
  for (const [x, y] of s.top.samples) pts.push([x, y])
  const bottom: [number, number][] = []
  const xs: number[] = []
  for (let x = s.front; x >= s.rear; x -= step) xs.push(x)
  for (const ax of [s.axleFront, s.axleRear]) {
    for (let k = 0; k <= 40; k++) xs.push(ax + s.archR * Math.cos((Math.PI * k) / 40))
  }
  xs.push(s.rear)
  xs.sort((a, b) => b - a)
  for (const x of xs) bottom.push([x, Math.min(s.bottomAt(x), s.top.at(x) - 0.02)])
  const body = poly([...pts, ...bottom])

  // ── Habitáculo (techo)
  let cabin: string | null = null
  if (s.roof && s.ghRange) {
    const [a, b] = s.ghRange
    const up: [number, number][] = []
    for (let x = a; x <= b; x += step) up.push([x, Math.max(s.roof.at(x), s.top.at(x))])
    up.push([b, s.top.at(b)])
    const down: [number, number][] = []
    for (let x = b; x >= a; x -= step) down.push([x, s.top.at(x) - 0.01])
    cabin = poly([...up, ...down])
  }

  // ── Lunas laterales y montantes
  let glass: string | null = null
  const pillars: string[] = []
  if (s.dloRange) {
    const [a, b] = s.dloRange
    const upper: [number, number][] = []
    const lower: [number, number][] = []
    for (let x = a; x <= b + 1e-9; x += step / 2) {
      const d = s.dloAt(Math.min(x, b))
      if (!d) continue
      upper.push([x, d[1]])
      lower.push([x, d[0]])
    }
    if (upper.length > 2) glass = poly([...lower, ...upper.reverse()])
    for (const px of spec.dlo?.pillars ?? []) {
      const l: [number, number][] = []
      const u: [number, number][] = []
      for (let x = px - 0.045; x <= px + 0.045; x += 0.015) {
        const d = s.dloAt(x)
        if (!d) continue
        l.push([x, d[0] - 0.01])
        u.push([x, d[1] + 0.01])
      }
      if (l.length > 1) pillars.push(poly([...l, ...u.reverse()]))
    }
  }

  // ── Descapotable: parabrisas suelto y reposacabezas
  let openWindshield: string | null = null
  const seats: string[] = []
  if (spec.openWindshield) {
    const w = spec.openWindshield
    const by = s.top.at(w.baseX)
    openWindshield = poly([
      [w.baseX, by - 0.01],
      [w.topX, w.topY],
      [w.topX - 0.06, w.topY - 0.005],
      [w.baseX - 0.07, by - 0.01],
    ])
  }
  if (!s.roof) {
    for (const sx of [spec.seats.frontX, spec.seats.rearX]) {
      if (sx === null) continue
      const by = s.top.at(sx)
      seats.push(poly([
        [sx - 0.14, by - 0.02],
        [sx - 0.17, by + 0.24],
        [sx - 0.15, by + 0.3],
        [sx - 0.03, by + 0.3],
        [sx - 0.02, by + 0.24],
        [sx + 0.0, by - 0.02],
      ]))
    }
  }

  // ── Línea de hombro (reflejo) y estribo
  const sh: [number, number][] = []
  const sill: [number, number][] = []
  const x0 = s.rear + 0.12
  const x1 = s.front - 0.25
  for (let x = x0; x <= x1; x += 0.02) {
    const c = s.lower(x)
    sh.push([x, c.ys])
  }
  for (let x = s.axleRear + s.archR + 0.04; x <= s.axleFront - s.archR - 0.04; x += 0.05) {
    sill.push([x, s.bottom.at(x) + 0.05])
  }
  const line = (p: [number, number][]) => (p.length ? `M${p.map(([x, y]) => P(x, y)).join('L')}` : '')

  // ── Juntas de puertas
  const doors = spec.doors.map((dx) => {
    const c = s.lower(dx)
    return `M${P(dx, c.yT - 0.03)}L${P(dx, Math.max(c.yB + 0.03, s.bottomAt(dx) + 0.03))}`
  })

  // ── Faros y pilotos (finas lentes junto a los extremos)
  const hy = spec.headlightY
  const ty = spec.taillightY
  const headlight = poly([
    [s.front - 0.34, hy + 0.03],
    [s.front - 0.04, hy + 0.04],
    [s.front - 0.015, hy - 0.005],
    [s.front - 0.06, hy - 0.04],
    [s.front - 0.3, hy - 0.02],
  ])
  const taillight = poly([
    [s.rear + 0.01, ty + 0.03],
    [s.rear + 0.26, ty + 0.025],
    [s.rear + 0.28, ty - 0.015],
    [s.rear + 0.02, ty - 0.035],
  ])

  const wheels = [s.axleRear, s.axleFront].map((ax) => ({
    cx: ax,
    cy: -s.wheelR,
    r: s.wheelR,
    rim: s.wheelR * spec.rimRatio,
    arch: s.archR,
  }))

  let maxY = 0
  for (const [, y] of s.top.samples) maxY = Math.max(maxY, y)
  if (s.roof) for (const [, y] of s.roof.samples) maxY = Math.max(maxY, y)
  if (spec.openWindshield) maxY = Math.max(maxY, spec.openWindshield.topY, s.top.at(spec.seats.frontX) + 0.3)
  const padX = 0.14
  const vb: [number, number, number, number] = [s.rear - padX, -(maxY + 0.1), s.front - s.rear + padX * 2, maxY + 0.2]

  const out: SilhouettePaths = {
    viewBox: vb,
    body,
    cabin,
    glass,
    pillars,
    openWindshield,
    seats,
    shoulder: line(sh),
    sill: line(sill),
    doors,
    headlight,
    taillight,
    wheels,
    spokes: spec.rim === 'six' ? 6 : spec.rim === 'multi' ? 10 : 5,
    groundY: 0,
    length: s.front - s.rear,
  }
  cache.set(type, out)
  return out
}
