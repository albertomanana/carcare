/**
 * Telemetría radial del coche elegido: dónde van las tarjetas de datos alrededor del coche que gira y de dónde salen
 * sus líneas guía. Lógica pura (sin React ni WebGL): se prueba con Vitest.
 *
 * Garantías, por construcción:
 *  - Ninguna tarjeta pisa el coche en ningún ángulo de giro: van en dos columnas, a izquierda y derecha de la elipse
 *    que envuelve al coche girando (su proyección no cambia con el giro), separadas por un margen.
 *  - Ninguna tarjeta pisa a otra: en cada columna se apilan con un hueco fijo.
 *  - Ninguna tarjeta se sale de la zona libre del lienzo: las que no caben, no se dibujan (la página tiene los mismos
 *    datos en HTML debajo).
 *  - Las líneas guía no se cruzan: en cada columna, tarjetas y puntos de anclaje llevan el mismo orden vertical.
 */

export interface RingArea {
  x0: number
  y0: number
  x1: number
  y1: number
}

export interface RingInput {
  /** Centro del coche en px del lienzo. */
  cx: number
  cy: number
  /** Semiejes en px de la elipse que envuelve al coche girando. */
  a: number
  b: number
  /** Zona libre del lienzo (sin lo que tapan los paneles). */
  area: RingArea
  count: number
  cardW: number
  cardH: number
  /** Hueco vertical entre tarjetas. */
  gap?: number
  /** Separación horizontal entre la elipse y las columnas. */
  margin?: number
}

export interface RingSlot {
  /** Índice del dato (orden de prioridad de la página). */
  index: number
  side: 'left' | 'right'
  /** Esquina superior izquierda de la tarjeta. */
  x: number
  y: number
  /** Punto de la elipse del coche del que sale la línea guía. */
  ax: number
  ay: number
  /** Punto del borde interior de la tarjeta al que llega. */
  lx: number
  ly: number
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi))

export function ringLayout({ cx, cy, a, b, area, count, cardW, cardH, gap = 10, margin = 26 }: RingInput): RingSlot[] {
  if (count <= 0 || cardW <= 0 || cardH <= 0) return []
  const rightX = cx + a + margin
  const leftX = cx - a - margin - cardW
  const sides: ('right' | 'left')[] = []
  if (rightX + cardW <= area.x1) sides.push('right')
  if (leftX >= area.x0) sides.push('left')
  if (!sides.length) return []
  const capacity = Math.floor((area.y1 - area.y0 + gap) / (cardH + gap))
  if (capacity <= 0) return []

  // Reparto alterno (derecha, izquierda, derecha…) hasta llenar cada columna
  const columns: Record<'left' | 'right', number[]> = { left: [], right: [] }
  let next = 0
  for (let i = 0; i < count; i++) {
    let placed = false
    for (let k = 0; k < sides.length && !placed; k++) {
      const side = sides[(next + k) % sides.length]
      if (columns[side].length < capacity) {
        columns[side].push(i)
        next = (sides.indexOf(side) + 1) % sides.length
        placed = true
      }
    }
    if (!placed) break
  }

  const out: RingSlot[] = []
  for (const side of sides) {
    const items = columns[side]
    const n = items.length
    if (!n) continue
    const total = n * cardH + (n - 1) * gap
    const top = clamp(cy - total / 2, area.y0, area.y1 - total)
    const x = side === 'right' ? rightX : leftX
    items.forEach((index, row) => {
      const y = top + row * (cardH + gap)
      const midX = x + cardW / 2
      const midY = y + cardH / 2
      const t = Math.atan2(midY - cy, midX - cx)
      out.push({
        index,
        side,
        x,
        y,
        ax: cx + a * Math.cos(t),
        ay: cy + b * Math.sin(t),
        lx: side === 'right' ? x : x + cardW,
        ly: midY,
      })
    })
  }
  return out.sort((p, q) => p.index - q.index)
}

/** Tamaño fijo de cada tarjeta de telemetría (px): el cálculo no depende de medir el DOM. */
export const RING_CARD_W = 190
export const RING_CARD_H = 56
export const RING_MARGIN = 26

/** Elementos DOM de la capa de telemetría: el proyector (dentro del lienzo) escribe en ellos sin renders de React. */
export class RingStore {
  readonly cards: (HTMLElement | null)[] = []
  readonly lines: (SVGLineElement | null)[] = []
  readonly dots: (SVGCircleElement | null)[] = []
}
