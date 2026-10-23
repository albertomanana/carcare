/**
 * Mallas procedurales de la carrocería: "loft" de secciones transversales (carrocería baja y habitáculo)
 * y piezas superpuestas que se adaptan a la superficie (lunas laterales, faros, pilotos, parrilla, molduras).
 *
 * Técnica: para cada estación x se evalúa una sección (semianillo z ≥ 0) y se refleja; las filas del costado
 * usan alturas absolutas, así el lateral queda liso aunque los pasos de rueda recorten la sección.
 * Cada tramo del anillo ("strip") lleva sus propios vértices: se suavizan las normales entre tramos
 * salvo en las aristas vivas (caja del pick-up, habitáculo del descapotable).
 */
import * as THREE from 'three'
import { clamp, lerp } from './profile'
import type { BodyShape, GreenhouseSection, LowerSection } from './shape'

export type MatKey =
  | 'paint'
  | 'glass'
  | 'trim'
  | 'chrome'
  | 'rubber'
  | 'rim'
  | 'rimDark'
  | 'disc'
  | 'caliper'
  | 'underbody'
  | 'cladding'
  | 'interior'
  | 'bedliner'
  | 'lightFront'
  | 'lightRear'
  | 'lens'
  | 'grille'
  | 'engine'
  | 'engineDark'
  | 'battery'
  | 'exhaust'
  | 'spring'
  | 'seat'

export type Detail = 'high' | 'low'

export interface GeoPart {
  geometry: THREE.BufferGeometry
  mat: MatKey
}

// ───────────────────────── Estaciones ─────────────────────────

function uniq(xs: number[], minGap: number) {
  xs.sort((a, b) => a - b)
  const out: number[] = []
  for (const x of xs) if (!out.length || x - out[out.length - 1] > minGap) out.push(x)
  return out
}

function lowerStations(s: BodyShape, detail: Detail): number[] {
  const step = detail === 'high' ? 0.028 : 0.07
  const xs: number[] = []
  for (let x = s.rear; x <= s.front; x += step) xs.push(x)
  xs.push(s.rear, s.front)
  // Extremos: muy densos (el redondeo en planta cambia deprisa)
  const K = detail === 'high' ? 34 : 14
  for (let k = 1; k <= K; k++) {
    const t = Math.pow(k / K, 2)
    xs.push(s.front - s.spec.planFront[0] * t * 1.1, s.rear + s.spec.planRear[0] * t * 1.1)
  }
  // Pasos de rueda: muestreo angular + discontinuidad exacta
  const A = detail === 'high' ? 44 : 18
  for (const ax of [s.axleFront, s.axleRear]) {
    for (let k = 0; k <= A; k++) xs.push(ax + s.archR * Math.cos((Math.PI * k) / A))
    xs.push(ax - s.archR - 0.0012, ax + s.archR + 0.0012, ax - s.archR + 0.0006, ax + s.archR - 0.0006)
  }
  const o = s.spec.bed ?? s.spec.cockpit
  if (o) xs.push(o.from - 0.0012, o.from + 0.0012, o.to - 0.0012, o.to + 0.0012)
  for (const x of s.top.samples) xs.push(x[0])
  return uniq(
    xs.filter((x) => x >= s.rear - 1e-9 && x <= s.front + 1e-9),
    0.0004,
  )
}

function ghStations(s: BodyShape, detail: Detail): number[] {
  if (!s.ghRange || !s.roof) return []
  const [a, b] = s.ghRange
  const step = detail === 'high' ? 0.025 : 0.07
  const xs: number[] = [a, b]
  for (let x = a; x <= b; x += step) xs.push(x)
  for (const p of s.roof.samples) xs.push(p[0])
  const K = detail === 'high' ? 16 : 6
  for (let k = 1; k <= K; k++) {
    const t = Math.pow(k / K, 2) * 0.12
    xs.push(a + t, b - t)
  }
  xs.push(s.spec.windshieldTopX - 0.0008, s.spec.windshieldTopX + 0.0008)
  xs.push(s.spec.rearGlassTopX - 0.0008, s.spec.rearGlassTopX + 0.0008)
  return uniq(
    xs.filter((x) => x >= a && x <= b),
    0.0004,
  )
}

// ───────────────────────── Loft genérico ─────────────────────────

interface LoftSpec {
  stations: number[]
  /** Número de puntos de cada tramo del semianillo (de arriba al centro inferior). */
  stripSizes: number[]
  /** Escribe el semianillo de la estación i en out (pares z,y). */
  ring(x: number, out: Float64Array): void
  /** true ⇒ el semianillo termina en z=0 (se cierra por debajo; anillo completo). */
  closedBottom: boolean
  /** Aristas vivas entre el tramo b y b+1 en la estación x. */
  crease?(boundary: number, x: number): boolean
  /** Material de un quad del tramo `strip` entre estaciones i, i+1 y puntos locales j, j+1. */
  classify(strip: number, i: number, j: number): MatKey
}

function buildLoft(spec: LoftSpec): GeoPart[] {
  const { stations, stripSizes } = spec
  const nS = stations.length
  const nHalf = stripSizes.reduce((a, b) => a + b, 0) - (stripSizes.length - 1)
  const half = new Float64Array(nHalf * 2)
  const halves: Float64Array[] = []
  for (let i = 0; i < nS; i++) {
    spec.ring(stations[i], half)
    halves.push(half.slice())
  }

  // Tramos del anillo completo: lado izquierdo (reflejado, invertido) + lado derecho.
  // Cada tramo es una rejilla propia. Índices de semianillo de cada tramo:
  const stripRanges: [number, number][] = []
  let start = 0
  for (const n of stripSizes) {
    stripRanges.push([start, start + n - 1])
    start += n - 1
  }

  const positions: number[] = []
  const indicesByMat = new Map<MatKey, number[]>()
  // Para suavizar normales entre tramos: pares de vértices coincidentes
  const seams: { a: number; b: number; boundary: number; i: number }[] = []
  // vertexOf[side][strip] = base index
  const stripBase: number[][] = [[], []]

  for (let side = 0; side < 2; side++) {
    const sign = side === 0 ? -1 : 1
    for (let s = 0; s < stripRanges.length; s++) {
      const [h0, h1] = stripRanges[s]
      const cols = h1 - h0 + 1
      const base = positions.length / 3
      stripBase[side][s] = base
      for (let i = 0; i < nS; i++) {
        const hv = halves[i]
        const x = stations[i]
        for (let c = 0; c < cols; c++) {
          // En el lado izquierdo el orden del anillo va de abajo arriba
          const hIdx = side === 0 ? h1 - c : h0 + c
          positions.push(x, hv[hIdx * 2 + 1], sign * hv[hIdx * 2])
        }
      }
      // Triángulos
      for (let i = 0; i < nS - 1; i++) {
        for (let c = 0; c < cols - 1; c++) {
          const jLocal = side === 0 ? cols - 2 - c : c
          const mat = spec.classify(s, i, jLocal)
          let arr = indicesByMat.get(mat)
          if (!arr) indicesByMat.set(mat, (arr = []))
          const a = base + i * cols + c
          const b = base + i * cols + c + 1
          const d = base + (i + 1) * cols + c
          const e = base + (i + 1) * cols + c + 1
          arr.push(a, b, d, b, e, d)
        }
      }
    }
    // Costuras entre tramos consecutivos del mismo lado
    for (let s = 0; s < stripRanges.length - 1; s++) {
      const colsA = stripRanges[s][1] - stripRanges[s][0] + 1
      const colsB = stripRanges[s + 1][1] - stripRanges[s + 1][0] + 1
      for (let i = 0; i < nS; i++) {
        // derecho: fin del tramo s = inicio del s+1; izquierdo: inicio del s = fin del s+1
        const a = side === 1 ? stripBase[side][s] + i * colsA + (colsA - 1) : stripBase[side][s] + i * colsA
        const b = side === 1 ? stripBase[side][s + 1] + i * colsB : stripBase[side][s + 1] + i * colsB + (colsB - 1)
        seams.push({ a, b, boundary: s, i })
      }
    }
  }
  // Costura superior (centro, z = 0) entre lado izquierdo y derecho del primer tramo
  {
    const cols = stripRanges[0][1] - stripRanges[0][0] + 1
    for (let i = 0; i < nS; i++) {
      seams.push({ a: stripBase[0][0] + i * cols + (cols - 1), b: stripBase[1][0] + i * cols, boundary: -1, i })
    }
  }

  const pos = new Float32Array(positions)
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  const all: number[] = []
  for (const arr of indicesByMat.values()) for (const v of arr) all.push(v)
  geo.setIndex(all)
  geo.computeVertexNormals()
  const nrm = geo.getAttribute('normal') as THREE.BufferAttribute
  const tmp = new THREE.Vector3()
  for (const sm of seams) {
    if (sm.boundary >= 0 && spec.crease?.(sm.boundary, stations[sm.i])) continue
    tmp.set(nrm.getX(sm.a) + nrm.getX(sm.b), nrm.getY(sm.a) + nrm.getY(sm.b), nrm.getZ(sm.a) + nrm.getZ(sm.b))
    if (tmp.lengthSq() < 1e-12) continue
    tmp.normalize()
    nrm.setXYZ(sm.a, tmp.x, tmp.y, tmp.z)
    nrm.setXYZ(sm.b, tmp.x, tmp.y, tmp.z)
  }
  // En el centro (z=0) la normal no debe tener componente lateral residual
  const out: GeoPart[] = []
  for (const [mat, idx] of indicesByMat) out.push({ mat, geometry: subGeometry(pos, nrm.array as Float32Array, idx) })
  geo.dispose()
  return out
}

/** Extrae los vértices usados por `idx` en una geometría compacta. */
function subGeometry(pos: Float32Array, nrm: Float32Array, idx: number[], uv?: Float32Array): THREE.BufferGeometry {
  const map = new Map<number, number>()
  const p: number[] = []
  const n: number[] = []
  const u: number[] = []
  const out = new Array<number>(idx.length)
  for (let k = 0; k < idx.length; k++) {
    const v = idx[k]
    let m = map.get(v)
    if (m === undefined) {
      m = map.size
      map.set(v, m)
      p.push(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2])
      n.push(nrm[v * 3], nrm[v * 3 + 1], nrm[v * 3 + 2])
      if (uv) u.push(uv[v * 2], uv[v * 2 + 1])
    }
    out[k] = m
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3))
  if (uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(u, 2))
  g.setIndex(out)
  g.computeBoundingSphere()
  return g
}

// ───────────────────────── Carrocería baja ─────────────────────────

export function buildLowerBody(s: BodyShape, detail: Detail): GeoPart[] {
  const hi = detail === 'high'
  const stations = lowerStations(s, detail)
  const secs: LowerSection[] = stations.map((x) => s.lower(x))
  const spec = s.spec
  // Costado: filas PARAMÉTRICAS por estación (hombro → línea de carácter → [plástico] → bajos).
  // Así ninguna fila se recorta donde el capó baja (evita triángulos astilla y reflejos en escalera)
  // y siempre hay una fila exacta en la línea de carácter y en el borde del plástico inferior.
  const nA = hi ? 10 : 3
  const nB = hi ? (spec.cladding ? 9 : 13) : spec.cladding ? 3 : 5
  const nC = spec.cladding ? (hi ? 5 : 2) : 0
  const n1 = hi ? 9 : 4
  const n2 = hi ? 3 : 2
  const n3 = hi ? 4 : 2
  const n4 = hi ? 16 : 5
  const n5 = 1 + nA + nB + nC
  const n6 = hi ? 6 : 3
  const n7 = hi ? 4 : 2
  const sizes = [n1 + 1, n2 + 1, n3 + 1, n4 + 1, n5, n6 + 1, n7 + 1]
  const sideRows = (c: LowerSection): number[] => {
    const top = c.yT - c.rty
    const lowArch = c.yB + c.rby
    const H0 = c.yT - s.bottom.at(c.x)
    const lowFlat = Math.min(top, s.bottom.at(c.x) + Math.min(spec.rBottom, H0 * 0.22))
    const ys = clamp(c.ys, lowFlat, top)
    const cl = spec.cladding ? clamp(spec.cladding, lowFlat, ys) : lowFlat
    const out: number[] = []
    for (let q = 0; q <= nA; q++) out.push(lerp(top, ys, q / nA))
    for (let q = 1; q <= nB; q++) out.push(lerp(ys, nC ? cl : lowFlat, q / nB))
    for (let q = 1; q <= nC; q++) out.push(lerp(cl, lowFlat, q / nC))
    for (let q = 0; q < out.length; q++) out[q] = clamp(out[q], lowArch, top)
    out[out.length - 1] = lowArch
    return out
  }
  const secByX = new Map<number, LowerSection>()
  stations.forEach((x, i) => secByX.set(x, secs[i]))

  const openMat: MatKey = spec.bed ? 'bedliner' : 'interior'
  const cabin = s.ghRange

  return buildLoft({
    stations,
    stripSizes: sizes,
    closedBottom: true,
    ring(x, out) {
      const c = secByX.get(x) ?? s.lower(x)
      const t = c.taper
      const zTop = c.W - c.tuckTop
      const zBot = c.W - c.tuckBottom
      const cz = zTop - c.rtz
      const topY = (z: number) => {
        const u = clamp(z / cz, 0, 1)
        const k = 1 - u * u
        return c.yT + c.crown * k * k
      }
      let k = 0
      const put = (z: number, y: number) => {
        out[k++] = Math.max(0, z * t)
        out[k++] = y
      }
      const yFloor = c.d > 0 ? c.yT - c.d : topY(c.Wi)
      // S1 suelo / capó
      for (let q = 0; q <= n1; q++) {
        const z = (c.Wi * q) / n1
        put(z, c.d > 0 ? c.yT - c.d : topY(z))
      }
      // S2 pared interior
      const yRail = c.d > 0 ? c.yT : topY(c.Wi)
      for (let q = 1; q <= n2; q++) put(c.Wi, lerp(yFloor, yRail, q / n2))
      // S3 borde superior
      for (let q = 1; q <= n3; q++) {
        const z = lerp(c.Wi, cz, q / n3)
        put(z, c.d > 0 ? c.yT : topY(z))
      }
      // S4 hombro redondeado
      for (let q = 1; q <= n4; q++) {
        const a = (Math.PI / 2) * (1 - q / n4)
        put(cz + c.rtz * Math.cos(a), c.yT - c.rty + c.rty * Math.sin(a))
      }
      // S5 costado (filas paramétricas; la primera coincide con el final de S4)
      const rowsC = sideRows(c)
      for (let q = 1; q < n5; q++) {
        const y = rowsC[q]
        const z = (s.outerZ(c, y) ?? 0) / Math.max(t, 1e-6)
        put(z, y)
      }
      // S6 redondeo inferior
      for (let q = 1; q <= n6; q++) {
        const a = (-Math.PI / 2) * (q / n6)
        put(zBot - c.rbz + c.rbz * Math.cos(a), c.yB + c.rby + c.rby * Math.sin(a))
      }
      // S7 bajos
      for (let q = 1; q <= n7; q++) put((zBot - c.rbz) * (1 - q / n7), c.yB)
    },
    crease(boundary, x) {
      const c = secByX.get(x)
      if (!c) return false
      // aristas de la caja / habitáculo abierto
      return (boundary === 0 || boundary === 1) && c.d > 0
    },
    classify(strip, i, j) {
      const a = secs[i]
      const b = secs[i + 1]
      if (strip <= 1) {
        if (a.d > 0 || b.d > 0) return openMat
        // Suelo bajo el habitáculo: oscuro (se ve a través del parabrisas)
        if (cabin && a.x > cabin[0] + 0.03 && b.x < cabin[1] - 0.03) return 'interior'
        return 'paint'
      }
      if (strip === 4) {
        if (nC && j >= nA + nB) return 'cladding'
        return 'paint'
      }
      if (strip === 5) return spec.cladding ? 'cladding' : 'paint'
      if (strip === 6) return 'underbody'
      return 'paint'
    },
  })
}

// ───────────────────────── Habitáculo ─────────────────────────

export function buildGreenhouse(s: BodyShape, detail: Detail): GeoPart[] {
  if (!s.roof || !s.ghRange) return []
  const hi = detail === 'high'
  const stations = ghStations(s, detail)
  const secs = stations.map((x) => s.gh(x)!)
  const nRows = hi ? 14 : 5
  const m1 = hi ? 10 : 4
  const m2 = hi ? 8 : 3
  const sizes = [m1 + 1, m2 + 1, nRows + 1]
  const spec = s.spec
  const byX = new Map<number, GreenhouseSection>()
  stations.forEach((x, i) => byX.set(x, secs[i]))

  return buildLoft({
    stations,
    stripSizes: sizes,
    closedBottom: false,
    ring(x, out) {
      const g = byX.get(x)!
      let k = 0
      const put = (z: number, y: number) => {
        out[k++] = Math.max(0, z)
        out[k++] = y
      }
      const zc = g.cornerEnd[0]
      for (let q = 0; q <= m1; q++) {
        const z = (zc * q) / m1
        const u = zc > 1e-6 ? z / zc : 1
        const kk = 1 - u * u
        put(z, g.yTop + g.crown * kk * kk)
      }
      const [ccx, ccy] = g.cornerCenter
      for (let q = 1; q <= m2; q++) {
        const a = lerp(g.cornerA1, g.cornerA0, q / m2)
        put(ccx + g.cornerRadius * Math.cos(a), ccy + g.cornerRadius * Math.sin(a))
      }
      // costado: filas paramétricas desde el inicio del arco hasta la base (bajo la cintura)
      for (let q = 1; q <= nRows; q++) {
        const y = lerp(g.cornerStart[1], g.y0, q / nRows)
        put(s.ghSideZ(g, y), y)
      }
    },
    classify(strip, i) {
      if (strip !== 0) return 'paint'
      const xa = stations[i]
      const xb = stations[i + 1]
      const xm = (xa + xb) / 2
      if (xm > spec.windshieldTopX) return 'glass'
      if (xm < spec.rearGlassTopX) {
        if (spec.rearGlassBand) {
          const ya = secs[i].yTop
          const yb = secs[i + 1].yTop
          const [lo, hi2] = spec.rearGlassBand
          return Math.min(ya, yb) >= lo && Math.max(ya, yb) <= hi2 ? 'glass' : 'paint'
        }
        return 'glass'
      }
      return 'paint'
    },
  })
}

// ───────────────────────── Piezas superpuestas ─────────────────────────

/** Rejilla genérica: p(u,v) con u,v ∈ [0,1]. Devuelve geometría con normales calculadas. */
function gridGeometry(
  cols: number,
  rows: number,
  fn: (u: number, v: number, out: THREE.Vector3) => void,
  flip = false,
  withUv = false,
): THREE.BufferGeometry {
  const pos = new Float32Array((cols + 1) * (rows + 1) * 3)
  const uv = withUv ? new Float32Array((cols + 1) * (rows + 1) * 2) : undefined
  const v3 = new THREE.Vector3()
  let k = 0
  for (let i = 0; i <= cols; i++) {
    for (let j = 0; j <= rows; j++) {
      fn(i / cols, j / rows, v3)
      pos[k * 3] = v3.x
      pos[k * 3 + 1] = v3.y
      pos[k * 3 + 2] = v3.z
      if (uv) {
        uv[k * 2] = i / cols
        uv[k * 2 + 1] = j / rows
      }
      k++
    }
  }
  const idx: number[] = []
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const a = i * (rows + 1) + j
      const b = a + 1
      const c = a + rows + 1
      const d = c + 1
      if (flip) idx.push(a, c, b, b, c, d)
      else idx.push(a, b, c, b, d, c)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  if (uv) g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  g.computeBoundingSphere()
  return g
}

function mirrorZ(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const m = g.clone()
  m.scale(1, 1, -1)
  const idx = m.getIndex()!
  const arr = idx.array as Uint16Array | Uint32Array
  for (let i = 0; i < arr.length; i += 3) {
    const t = arr[i + 1]
    arr[i + 1] = arr[i + 2]
    arr[i + 2] = t
  }
  idx.needsUpdate = true
  return m
}

function merge(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  // Une geometrías indexadas con position/normal(/uv)
  const hasUv = geos.every((g) => g.getAttribute('uv'))
  let vCount = 0
  let iCount = 0
  for (const g of geos) {
    vCount += g.getAttribute('position').count
    iCount += g.getIndex()!.count
  }
  const pos = new Float32Array(vCount * 3)
  const nrm = new Float32Array(vCount * 3)
  const uv = hasUv ? new Float32Array(vCount * 2) : null
  const idx = new Uint32Array(iCount)
  let vo = 0
  let io = 0
  for (const g of geos) {
    const p = g.getAttribute('position')
    const n = g.getAttribute('normal')
    pos.set(p.array as Float32Array, vo * 3)
    nrm.set(n.array as Float32Array, vo * 3)
    if (uv) uv.set(g.getAttribute('uv').array as Float32Array, vo * 2)
    const ia = g.getIndex()!.array
    for (let k = 0; k < ia.length; k++) idx[io + k] = ia[k] + vo
    vo += p.count
    io += ia.length
  }
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  out.setAttribute('normal', new THREE.BufferAttribute(nrm, 3))
  if (uv) out.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  out.setIndex(new THREE.BufferAttribute(idx, 1))
  out.computeBoundingSphere()
  return out
}

function bothSides(g: THREE.BufferGeometry) {
  const m = mirrorZ(g)
  const out = merge([g, m])
  g.dispose()
  m.dispose()
  return out
}

/** Banda sobre el costado del habitáculo entre x0..x1 con límites verticales por x. */
function ghSideStrip(
  s: BodyShape,
  x0: number,
  x1: number,
  band: (x: number) => [number, number] | null,
  offset: number,
  cols: number,
  rows: number,
): THREE.BufferGeometry {
  const g = gridGeometry(cols, rows, (u, v, o) => {
    const x = lerp(x1, x0, u)
    const sec = s.gh(x)
    const b = band(x)
    if (!sec || !b) {
      o.set(x, 0, 0)
      return
    }
    const y = lerp(b[0], b[1], v)
    o.set(x, y, s.ghSideZ(sec, y) + offset)
  })
  return bothSides(g)
}

/** Banda vertical sobre el costado de la carrocería baja (juntas de puertas, molduras). */
function bodySideStrip(
  s: BodyShape,
  x0: number,
  x1: number,
  band: (x: number) => [number, number] | null,
  offset: number,
  cols: number,
  rows: number,
): THREE.BufferGeometry {
  const g = gridGeometry(cols, rows, (u, v, o) => {
    const x = lerp(x1, x0, u)
    const sec = s.lower(x)
    const b = band(x)
    if (!b) {
      o.set(x, sec.yT, 0)
      return
    }
    const y = lerp(b[0], b[1], v)
    const z = s.outerZ(sec, clamp(y, sec.yB, sec.yT)) ?? 0
    o.set(x, y, z + offset)
  })
  return bothSides(g)
}

interface Contour {
  xs: number[]
  zs: number[]
  ss: number[]
}

/** Contorno en planta a la altura y cerca de un extremo ('front' | 'rear'), desde el eje (z=0) hacia fuera. */
function endContour(s: BodyShape, end: 'front' | 'rear', y: number): Contour {
  const L = 0.95
  const K = 90
  const xs: number[] = []
  const zs: number[] = []
  const ss: number[] = []
  let prevX = 0
  let prevZ = 0
  let acc = 0
  for (let k = 0; k <= K; k++) {
    const t = Math.pow(k / K, 2)
    const x = end === 'front' ? s.front - L * t : s.rear + L * t
    const sec = s.lower(x)
    const z = s.outerZ(sec, clamp(y, sec.yB + 0.001, sec.yT - 0.001)) ?? 0
    if (k > 0) acc += Math.hypot(x - prevX, z - prevZ)
    xs.push(x)
    zs.push(z)
    ss.push(acc)
    prevX = x
    prevZ = z
  }
  return { xs, zs, ss }
}

function contourPoint(c: Contour, sArc: number, end: 'front' | 'rear', offset: number, out: THREE.Vector3, y: number) {
  const n = c.ss.length
  const sa = clamp(Math.abs(sArc), 0, c.ss[n - 1])
  let lo = 0
  let hi = n - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (c.ss[mid] <= sa) lo = mid
    else hi = mid
  }
  const t = (sa - c.ss[lo]) / Math.max(1e-9, c.ss[hi] - c.ss[lo])
  const x = lerp(c.xs[lo], c.xs[hi], t)
  const z = lerp(c.zs[lo], c.zs[hi], t)
  // normal en planta (perpendicular a la tangente, hacia fuera)
  const tx = c.xs[hi] - c.xs[lo]
  const tz = c.zs[hi] - c.zs[lo]
  const tl = Math.hypot(tx, tz) || 1
  let nx = tz / tl
  let nz = -tx / tl
  const sgnOut = end === 'front' ? 1 : -1
  if (nx * sgnOut < 0 || (Math.abs(nx) < 1e-3 && nz < 0)) {
    nx = -nx
    nz = -nz
  }
  const zs = sArc < 0 ? -1 : 1
  out.set(x + nx * offset, y, (z + nz * offset) * zs)
}

/**
 * Banda envolvente en un extremo: u recorre la longitud de arco del contorno (s0..s1, negativa = lado izquierdo),
 * v recorre la altura entre band(s)[0] y band(s)[1].
 */
function wrapStrip(
  s: BodyShape,
  end: 'front' | 'rear',
  s0: number,
  s1: number,
  band: (sArc: number) => [number, number],
  offset: number,
  cols: number,
  rows: number,
  withUv = false,
): THREE.BufferGeometry {
  const contours = new Map<number, Contour>()
  const cAt = (y: number) => {
    const key = Math.round(y * 2000)
    let c = contours.get(key)
    if (!c) contours.set(key, (c = endContour(s, end, key / 2000)))
    return c
  }
  return gridGeometry(
    cols,
    rows,
    (u, v, o) => {
      const sa = lerp(s0, s1, u)
      const [ya, yb] = band(sa)
      const y = lerp(ya, yb, v)
      contourPoint(cAt(y), sa, end, offset, o, y)
    },
    end === 'rear',
    withUv,
  )
}

// ───────────────────────── Detalles de carrocería ─────────────────────────

export interface DetailParts {
  parts: (GeoPart & { name: string; zone?: 'body' | 'electrical' | 'interior' | 'exhaust' })[]
}

export function buildBodyDetails(s: BodyShape, detail: Detail): DetailParts {
  const hi = detail === 'high'
  const spec = s.spec
  const parts: DetailParts['parts'] = []

  // ── Lunas laterales ──
  if (s.dloRange && spec.dlo) {
    const [a, b] = s.dloRange
    const cols = hi ? 90 : 30
    parts.push({ name: 'dlo', mat: 'glass', zone: 'interior', geometry: ghSideStrip(s, a, b, (x) => s.dloAt(x), 0.0035, cols, hi ? 6 : 2) })
    // Montantes negros
    for (const px of spec.dlo.pillars) {
      parts.push({
        name: 'pillar',
        mat: 'trim',
        geometry: ghSideStrip(
          s,
          px - 0.04,
          px + 0.04,
          (x) => {
            const d = s.dloAt(clamp(x, a + 0.01, b - 0.01))
            return d ? [d[0] - 0.006, d[1] + 0.006] : null
          },
          0.0065,
          4,
          hi ? 6 : 2,
        ),
      })
    }
    // Moldura cromada de la cintura
    parts.push({
      name: 'beltTrim',
      mat: 'chrome',
      geometry: ghSideStrip(
        s,
        a - 0.01,
        b + 0.01,
        (x) => {
          const g = s.gh(x)
          if (!g) return null
          return [g.yb + 0.012, g.yb + 0.026]
        },
        0.004,
        cols,
        1,
      ),
    })
    // Marco superior negro brillante alrededor de la luna
    parts.push({
      name: 'dloFrame',
      mat: 'trim',
      geometry: ghSideStrip(
        s,
        a,
        b,
        (x) => {
          const d = s.dloAt(x)
          return d ? [d[1] - 0.001, d[1] + 0.012] : null
        },
        0.003,
        cols,
        1,
      ),
    })
  }

  // ── Juntas de puertas ──
  for (const dx of spec.doors) {
    parts.push({
      name: 'doorSeam',
      mat: 'underbody',
      geometry: bodySideStrip(
        s,
        dx - 0.0035,
        dx + 0.0035,
        (x) => {
          const c = s.lower(x)
          const yBot = c.yB + c.rby * 0.6
          const yTop = c.yT - c.rty * 0.35
          return yTop > yBot ? [yBot, yTop] : null
        },
        0.0012,
        1,
        hi ? 24 : 6,
      ),
    })
  }

  // ── Frontal ──
  const fc = endContour(s, 'front', spec.headlightY)
  const fHalf = fc.ss[fc.ss.length - 1]
  const tipF = s.lower(s.front - 0.002)
  const hY = spec.headlightY
  // ancho de arco de la cara frontal hasta la esquina (donde el contorno gira hacia el costado)
  const faceF = Math.min(fHalf, (s.halfWidth - 0.04) * 1.08)
  const lampIn = faceF * 0.42
  const lampOut = faceF * 1.02
  // carcasa negra del faro
  const lampHousing = (sa: number): [number, number] => {
    const t = clamp((Math.abs(sa) - lampIn) / (lampOut - lampIn), 0, 1)
    return [hY - 0.045 + t * 0.03, hY + 0.035 - t * 0.008]
  }
  // La longitud de arco SIEMPRE crece hacia +z: en el lado izquierdo (arco negativo) el tramo va de fuera a dentro;
  // si no, el orden de los triángulos se invierte y el faro izquierdo queda de espaldas (invisible de frente).
  const span = (sg: number, a: number, b: number): [number, number] => (sg > 0 ? [a, b] : [-b, -a])
  for (const sg of [1, -1]) {
    const [l0, l1] = span(sg, lampIn, lampOut)
    parts.push({
      name: 'headlightLens',
      mat: 'lens',
      zone: 'electrical',
      geometry: wrapStrip(s, 'front', l0, l1, lampHousing, 0.003, hi ? 28 : 8, hi ? 4 : 1),
    })
    const [b0, b1] = span(sg, lampIn + 0.02, lampOut - 0.015)
    parts.push({
      name: 'headlight',
      mat: 'lightFront',
      zone: 'electrical',
      geometry: wrapStrip(
        s,
        'front',
        b0,
        b1,
        (sa) => {
          const b = lampHousing(sa)[1]
          const m = b - 0.01
          return [m - 0.02, m]
        },
        0.0055,
        hi ? 28 : 8,
        1,
      ),
    })
  }
  // tira de luz diurna que cruza el frontal
  parts.push({
    name: 'drl',
    mat: 'lightFront',
    zone: 'electrical',
    geometry: wrapStrip(s, 'front', -lampIn - 0.01, lampIn + 0.01, () => [hY + 0.022, hY + 0.03], 0.004, hi ? 30 : 8, 1),
  })
  // parrilla inferior
  const gBot = tipF.yB + 0.05
  const gTop = Math.min(hY - 0.085, gBot + 0.17)
  if (gTop > gBot + 0.04) {
    parts.push({
      name: 'grille',
      mat: 'grille',
      geometry: wrapStrip(
        s,
        'front',
        -faceF * 0.62,
        faceF * 0.62,
        (sa) => {
          const t = Math.abs(sa) / (faceF * 0.62)
          return [gBot + t * t * 0.02, gTop - t * t * 0.03]
        },
        0.003,
        hi ? 40 : 10,
        hi ? 4 : 1,
        true,
      ),
    })
  }

  // ── Trasera ──
  const rc = endContour(s, 'rear', spec.taillightY)
  const rHalf = rc.ss[rc.ss.length - 1]
  const faceR = Math.min(rHalf, (s.halfWidth - 0.04) * 1.08)
  const tY = spec.taillightY
  const wrapR = faceR + 0.09
  parts.push({
    name: 'tailHousing',
    mat: 'lens',
    zone: 'electrical',
    geometry: wrapStrip(s, 'rear', -wrapR, wrapR, () => [tY - 0.04, tY + 0.028], 0.003, hi ? 60 : 16, 1),
  })
  parts.push({
    name: 'taillight',
    mat: 'lightRear',
    zone: 'electrical',
    geometry: wrapStrip(
      s,
      'rear',
      -wrapR + 0.02,
      wrapR - 0.02,
      (sa) => {
        const t = clamp((Math.abs(sa) - faceR * 0.55) / (wrapR - faceR * 0.55), 0, 1)
        return [tY - 0.012 - t * 0.012, tY + 0.012]
      },
      0.0055,
      hi ? 60 : 16,
      1,
    ),
  })
  // difusor
  const tipR = s.lower(s.rear + 0.002)
  parts.push({
    name: 'diffuser',
    mat: spec.cladding ? 'cladding' : 'trim',
    geometry: wrapStrip(
      s,
      'rear',
      -faceR * 0.8,
      faceR * 0.8,
      (sa) => {
        const t = Math.abs(sa) / (faceR * 0.8)
        return [tipR.yB + 0.004, tipR.yB + 0.11 - t * t * 0.05]
      },
      0.003,
      hi ? 30 : 8,
      1,
    ),
  })

  return { parts }
}

/** Parabrisas suelto (descapotable): superficie curvada + marco. */
export function buildOpenWindshield(s: BodyShape, detail: Detail): GeoPart[] {
  const w = s.spec.openWindshield
  if (!w) return []
  const hi = detail === 'high'
  const baseY = s.top.at(w.baseX) - 0.01
  const sec = s.lower(w.baseX)
  const wBase = (sec.W - sec.tuckTop) * sec.taper - 0.06
  const wTop = wBase - 0.1
  const fn = (u: number, v: number, o: THREE.Vector3) => {
    // u: lateral -1..1, v: base→arriba
    const x = lerp(w.baseX, w.topX, v)
    const y = lerp(baseY, w.topY, v)
    const half = lerp(wBase, wTop, v)
    const zz = (u * 2 - 1) * half
    const bow = 0.07 * (1 - Math.pow(zz / half, 2))
    o.set(x + bow, y + bow * 0.25, zz)
  }
  const glass = gridGeometry(hi ? 24 : 8, hi ? 8 : 3, fn)
  // marco: tubos en los laterales y travesaño superior
  const pts: THREE.Vector3[] = []
  const tmp = new THREE.Vector3()
  for (let k = 0; k <= 20; k++) {
    fn(0, k / 20, tmp)
    pts.push(tmp.clone())
  }
  for (let k = 1; k <= 30; k++) {
    fn(k / 30, 1, tmp)
    pts.push(tmp.clone())
  }
  for (let k = 19; k >= 0; k--) {
    fn(1, k / 20, tmp)
    pts.push(tmp.clone())
  }
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.1)
  const frame = new THREE.TubeGeometry(curve, hi ? 160 : 50, 0.018, hi ? 8 : 5, false)
  frame.deleteAttribute('uv')
  return [
    { mat: 'glass', geometry: glass },
    { mat: 'paint', geometry: frame },
  ]
}
