/**
 * Reglas de validación compartidas por los formularios, alineadas con el contrato (§3.3, §3.5, §3.6).
 * El servidor valida igualmente: esto solo da feedback inmediato.
 */
import { normalizeDecimalInput, parseIntegerInput, todayISO } from './format'

export const MAX_MILEAGE = 2_000_000
export const MAX_AMOUNT = 999_999.99

/** Mayúsculas, sin espacios ni guiones (igual que el backend). */
export function normalizePlate(value: string | null | undefined): string {
  return (value ?? '').toUpperCase().replace(/[\s-]/g, '')
}

export const VIN_REGEX = /^[A-HJ-NPR-Z0-9]{17}$/

export function normalizeVin(value: string | null | undefined): string {
  return (value ?? '').toUpperCase().replace(/\s/g, '')
}

export function maxVehicleYear(): number {
  return new Date().getFullYear() + 1
}

export const COLOR_HEX_REGEX = /^#[0-9A-Fa-f]{6}$/

export function isFutureDate(value: string): boolean {
  return value > todayISO()
}

/** Texto de un campo de km → número válido o mensaje de error. */
export function mileageError(raw: string, { required = false } = {}): string | null {
  if (!raw.trim()) return required ? 'Indica los kilómetros.' : null
  const n = parseIntegerInput(raw)
  if (n === null) return 'Escribe solo números enteros.'
  if (n < 0 || n > MAX_MILEAGE) return 'Debe estar entre 0 y 2.000.000 km.'
  return null
}

/** Texto de un importe → error o null. `positive` exige > 0. */
export function amountError(raw: string, { required = false, positive = false } = {}): string | null {
  if (!raw.trim()) return required ? 'Indica el importe.' : null
  const normalized = normalizeDecimalInput(raw)
  if (normalized === null) return 'Importe no válido.'
  const n = Number(normalized)
  if (!Number.isFinite(n)) return 'Importe no válido.'
  if (positive ? n <= 0 : n < 0) return positive ? 'Debe ser mayor que 0.' : 'No puede ser negativo.'
  if (n > MAX_AMOUNT) return 'Máximo 999.999,99 €.'
  if (/\.\d{3,}$/.test(normalized)) return 'Máximo 2 decimales.'
  return null
}

export function quantityError(raw: string): string | null {
  const normalized = normalizeDecimalInput(raw)
  if (normalized === null) return 'Cantidad no válida.'
  const n = Number(normalized)
  if (!Number.isFinite(n) || n <= 0) return 'Debe ser mayor que 0.'
  if (/\.\d{3,}$/.test(normalized)) return 'Máximo 2 decimales.'
  return null
}
