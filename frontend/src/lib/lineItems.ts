/**
 * Cálculo de líneas (piezas, mano de obra…) en céntimos enteros para evitar errores de coma flotante.
 * Replica las reglas del servidor: total línea = cantidad × precio; IVA con redondeo half-up a 2 decimales.
 */
import type { Money } from '@/api/types'
import { normalizeDecimalInput } from './format'

/** '12.34' / '12,34' → 1234. null si vacío o inválido. */
export function toCents(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null
  const normalized = typeof value === 'number' ? String(value) : normalizeDecimalInput(value)
  if (normalized === null || normalized === '') return null
  const n = Number(normalized)
  if (!Number.isFinite(n)) return null
  return Math.round(n * 100)
}

export function centsToMoney(cents: number): Money {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`
}

export interface LineLike {
  quantity: string | number | null | undefined
  unit_price: string | number | null | undefined
}

/** Total de una línea en céntimos (null si no hay precio o la cantidad no es válida). */
export function lineTotalCents(line: LineLike): number | null {
  const qty = toCents(line.quantity) // cantidad × 100
  const price = toCents(line.unit_price)
  if (qty === null || price === null || qty <= 0) return null
  return Math.round((qty * price) / 100)
}

export interface LinesTotals {
  /** Suma de líneas con precio. */
  subtotalCents: number
  /** Número de líneas sin precio (no suman). */
  unpricedCount: number
  pricedCount: number
}

export function sumLines(lines: LineLike[]): LinesTotals {
  let subtotalCents = 0
  let unpricedCount = 0
  let pricedCount = 0
  for (const line of lines) {
    const total = lineTotalCents(line)
    if (total === null) unpricedCount++
    else {
      subtotalCents += total
      pricedCount++
    }
  }
  return { subtotalCents, unpricedCount, pricedCount }
}

/** IVA half-up: subtotal × tipo / 100, redondeado a céntimos. */
export function taxCents(subtotalCents: number, taxRate: string | number | null | undefined): number {
  const rate = typeof taxRate === 'number' ? taxRate : Number(normalizeDecimalInput(taxRate ?? '') ?? 0)
  if (!Number.isFinite(rate) || rate <= 0) return 0
  // Trabajamos en centésimas de céntimo para que el redondeo sea exacto en los casos habituales
  return Math.round((subtotalCents * Math.round(rate * 100)) / 10000)
}

export function orderTotals(lines: LineLike[], taxRate: string | number | null | undefined) {
  const { subtotalCents, unpricedCount } = sumLines(lines)
  const tax = taxCents(subtotalCents, taxRate)
  return {
    subtotalCents,
    taxCents: tax,
    totalCents: subtotalCents + tax,
    unpricedCount,
  }
}

/** Reparte la suma de líneas en piezas (pieza, fluido, otro) y mano de obra, en céntimos. */
export function splitLines(lines: (LineLike & { kind: string })[]): { partsCents: number; laborCents: number; pricedCount: number } {
  let partsCents = 0
  let laborCents = 0
  let pricedCount = 0
  for (const line of lines) {
    const total = lineTotalCents(line)
    if (total === null) continue
    pricedCount++
    if (line.kind === 'labor') laborCents += total
    else partsCents += total
  }
  return { partsCents, laborCents, pricedCount }
}

/**
 * Total que se guardará si el usuario deja el campo «Total» vacío. Replica la regla del servidor al crear
 * (piezas + mano de obra; si no hay desglose, la suma de las líneas con precio; si no, sin coste).
 */
export function effectiveTotalCents(
  manual: { total: string | null | undefined; parts: string | null | undefined; labor: string | null | undefined },
  lines: LineLike[],
): { cents: number | null; source: 'manual' | 'breakdown' | 'lines' | 'none' } {
  const total = toCents(manual.total ?? null)
  if (total !== null) return { cents: total, source: 'manual' }
  const parts = toCents(manual.parts ?? null)
  const labor = toCents(manual.labor ?? null)
  if (parts !== null || labor !== null) return { cents: (parts ?? 0) + (labor ?? 0), source: 'breakdown' }
  const { subtotalCents, pricedCount } = sumLines(lines)
  if (pricedCount > 0) return { cents: subtotalCents, source: 'lines' }
  return { cents: null, source: 'none' }
}

/** true si el total introducido a mano no coincide con la suma de líneas (y hay líneas con precio). */
export function totalMismatch(manualTotal: string | null | undefined, lines: LineLike[]): { mismatch: boolean; linesCents: number; manualCents: number | null } {
  const { subtotalCents, pricedCount } = sumLines(lines)
  const manualCents = toCents(manualTotal ?? null)
  return {
    mismatch: pricedCount > 0 && manualCents !== null && manualCents !== subtotalCents,
    linesCents: subtotalCents,
    manualCents,
  }
}
