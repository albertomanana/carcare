/**
 * Perfiles laterales con esquinas redondeadas ("polilínea con empalmes"), sin dependencias de three.js.
 * Los usan tanto el modelo 3D como la silueta SVG, así 2D y 3D tienen exactamente la misma forma.
 *
 * Un perfil es una curva y = f(x) monótona en x (de la trasera, x negativa, al morro, x positiva).
 * Cada punto puede llevar un radio de empalme: la esquina se sustituye por un arco tangente.
 */

/** [x, y, radio de empalme opcional] en metros. */
export type ProfilePoint = readonly [number, number, number?]

export interface Profile {
  readonly xMin: number
  readonly xMax: number
  /** Puntos muestreados (para SVG y búsquedas). */
  readonly samples: ReadonlyArray<readonly [number, number]>
  /** y(x) por interpolación lineal sobre las muestras (fuera de rango se satura). */
  at(x: number): number
}

const ARC_STEP = (1.5 * Math.PI) / 180

export function makeProfile(points: readonly ProfilePoint[]): Profile {
  const pts = points.map((p) => [p[0], p[1], p[2] ?? 0] as const)
  const out: [number, number][] = [[pts[0][0], pts[0][1]]]

  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i - 1]
    const [cx, cy, r] = pts[i]
    const [nx, ny] = pts[i + 1]
    if (r <= 0) {
      out.push([cx, cy])
      continue
    }
    let d1x = cx - px
    let d1y = cy - py
    let d2x = nx - cx
    let d2y = ny - cy
    const l1 = Math.hypot(d1x, d1y)
    const l2 = Math.hypot(d2x, d2y)
    d1x /= l1
    d1y /= l1
    d2x /= l2
    d2y /= l2
    const cross = d1x * d2y - d1y * d2x
    const dot = Math.min(1, Math.max(-1, d1x * d2x + d1y * d2y))
    const turn = Math.acos(dot) // ángulo de giro entre segmentos
    if (turn < 1e-4) {
      out.push([cx, cy])
      continue
    }
    let t = r * Math.tan(turn / 2)
    let rr = r
    const tMax = Math.min(l1, l2) * 0.5
    if (t > tMax) {
      t = tMax
      rr = t / Math.tan(turn / 2)
    }
    const t1x = cx - d1x * t
    const t1y = cy - d1y * t
    // Normal hacia el interior del giro
    const s = cross > 0 ? 1 : -1
    const ncx = t1x - d1y * rr * s
    const ncy = t1y + d1x * rr * s
    const a0 = Math.atan2(t1y - ncy, t1x - ncx)
    const steps = Math.max(2, Math.ceil(turn / ARC_STEP))
    for (let k = 0; k <= steps; k++) {
      const a = a0 + s * turn * (k / steps)
      out.push([ncx + Math.cos(a) * rr, ncy + Math.sin(a) * rr])
    }
  }
  const last = pts[pts.length - 1]
  out.push([last[0], last[1]])

  // Garantiza monotonía estricta en x (los arcos casi verticales pueden repetir x)
  const samples: [number, number][] = []
  for (const p of out) {
    const prev = samples[samples.length - 1]
    if (prev && p[0] <= prev[0] + 1e-6) {
      if (p[0] < prev[0] - 1e-6) continue
      prev[1] = p[1]
      continue
    }
    samples.push([p[0], p[1]])
  }

  const xs = samples.map((p) => p[0])
  const ys = samples.map((p) => p[1])
  const n = xs.length

  // Interpolación cúbica monótona (Fritsch–Carlson): pendiente continua ⇒ reflejos limpios en el clearcoat
  // (con interpolación lineal, cada muestra del arco era un quiebro visible en los reflejos).
  const d: number[] = []
  for (let k = 0; k < n - 1; k++) d.push((ys[k + 1] - ys[k]) / (xs[k + 1] - xs[k]))
  const m: number[] = new Array(n).fill(0)
  m[0] = d[0] ?? 0
  m[n - 1] = d[n - 2] ?? 0
  for (let k = 1; k < n - 1; k++) m[k] = d[k - 1] * d[k] <= 0 ? 0 : (d[k - 1] + d[k]) / 2
  for (let k = 0; k < n - 1; k++) {
    if (d[k] === 0) {
      m[k] = 0
      m[k + 1] = 0
      continue
    }
    const a = m[k] / d[k]
    const b = m[k + 1] / d[k]
    const h = a * a + b * b
    if (h > 9) {
      const t = 3 / Math.sqrt(h)
      m[k] = t * a * d[k]
      m[k + 1] = t * b * d[k]
    }
  }

  return {
    xMin: xs[0],
    xMax: xs[n - 1],
    samples,
    at(x: number) {
      if (x <= xs[0]) return ys[0]
      if (x >= xs[n - 1]) return ys[n - 1]
      let lo = 0
      let hi = n - 1
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1
        if (xs[mid] <= x) lo = mid
        else hi = mid
      }
      const hx = xs[hi] - xs[lo]
      const t = (x - xs[lo]) / hx
      const t2 = t * t
      const t3 = t2 * t
      return (2 * t3 - 3 * t2 + 1) * ys[lo] + (t3 - 2 * t2 + t) * hx * m[lo] + (-2 * t3 + 3 * t2) * ys[hi] + (t3 - t2) * hx * m[hi]
    },
  }
}

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v)
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}
/** Mínimo suave (redondea la esquina entre dos curvas). */
export function smin(a: number, b: number, k: number) {
  const h = clamp(0.5 + (0.5 * (b - a)) / k, 0, 1)
  return lerp(b, a, h) - k * h * (1 - h)
}
