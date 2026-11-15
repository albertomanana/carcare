import { describe, expect, it } from 'vitest'
import { ringLayout, type RingInput, type RingSlot } from './telemetry'

const base: RingInput = { cx: 460, cy: 420, a: 130, b: 90, area: { x0: 8, y0: 160, x1: 912, y1: 700 }, count: 8, cardW: 190, cardH: 56 }

const rect = (s: RingSlot, i: RingInput) => ({ x0: s.x, y0: s.y, x1: s.x + i.cardW, y1: s.y + i.cardH })
const overlap = (p: ReturnType<typeof rect>, q: ReturnType<typeof rect>) => p.x0 < q.x1 && q.x0 < p.x1 && p.y0 < q.y1 && q.y0 < p.y1

/** Comprueba las cuatro garantías de `ringLayout` sobre un resultado. */
function check(i: RingInput, slots: RingSlot[]) {
  const margin = i.margin ?? 26
  for (const s of slots) {
    const r = rect(s, i)
    // dentro de la zona libre
    expect(r.x0).toBeGreaterThanOrEqual(i.area.x0)
    expect(r.x1).toBeLessThanOrEqual(i.area.x1)
    expect(r.y0).toBeGreaterThanOrEqual(i.area.y0)
    expect(r.y1).toBeLessThanOrEqual(i.area.y1)
    // fuera de la elipse del coche girando, con su margen (basta con el eje horizontal)
    if (s.side === 'right') expect(r.x0).toBeGreaterThanOrEqual(i.cx + i.a + margin)
    else expect(r.x1).toBeLessThanOrEqual(i.cx - i.a - margin)
    // la línea guía sale de la elipse y llega al borde interior de la tarjeta
    expect(((s.ax - i.cx) / i.a) ** 2 + ((s.ay - i.cy) / i.b) ** 2).toBeCloseTo(1, 5)
    expect(s.lx).toBe(s.side === 'right' ? r.x0 : r.x1)
  }
  // ninguna tarjeta pisa a otra
  for (let p = 0; p < slots.length; p++) for (let q = p + 1; q < slots.length; q++) expect(overlap(rect(slots[p], i), rect(slots[q], i))).toBe(false)
  // las líneas de una columna no se cruzan: mismo orden vertical en la tarjeta y en el anclaje
  for (const side of ['left', 'right'] as const) {
    const col = slots.filter((s) => s.side === side).sort((p, q) => p.ly - q.ly)
    for (let k = 1; k < col.length; k++) expect(col[k].ay).toBeGreaterThan(col[k - 1].ay)
  }
}

describe('ringLayout', () => {
  it('reparte los datos en dos columnas, alternando, sin pisar el coche ni entre sí', () => {
    const slots = ringLayout(base)
    expect(slots).toHaveLength(8)
    expect(slots.filter((s) => s.side === 'right')).toHaveLength(4)
    expect(slots.filter((s) => s.side === 'left')).toHaveLength(4)
    expect(slots.map((s) => s.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
    check(base, slots)
  })

  it('cumple las garantías con cualquier número de datos, tamaño de coche y zona libre', () => {
    for (const count of [1, 2, 3, 5, 8, 12])
      for (const a of [60, 130, 220])
        for (const h of [180, 320, 540])
          for (const cx of [300, 460, 700]) {
            const i: RingInput = { ...base, count, a, b: a * 0.7, cx, area: { ...base.area, y1: base.area.y0 + h } }
            check(i, ringLayout(i))
          }
  })

  it('si un lado no tiene sitio, usa solo el otro; si no cabe ninguno, no dibuja nada', () => {
    const rightOnly = ringLayout({ ...base, cx: 200 })
    expect(rightOnly.length).toBeGreaterThan(0)
    expect(rightOnly.every((s) => s.side === 'right')).toBe(true)
    check({ ...base, cx: 200 }, rightOnly)
    expect(ringLayout({ ...base, a: 400 })).toEqual([])
  })

  it('lo que no cabe en vertical se queda fuera, respetando la prioridad', () => {
    const i: RingInput = { ...base, area: { ...base.area, y1: base.area.y0 + 130 } }
    const slots = ringLayout(i)
    // 130 px: dos tarjetas de 56 con 10 de hueco por columna
    expect(slots.map((s) => s.index)).toEqual([0, 1, 2, 3])
    check(i, slots)
  })

  it('sin datos no hay tarjetas', () => {
    expect(ringLayout({ ...base, count: 0 })).toEqual([])
  })
})
