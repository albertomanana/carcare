/**
 * Formateadores es-ES con Intl. Todas las cifras de la interfaz pasan por aquí.
 * Dinero llega de la API como string decimal ('1234.50'); kilometraje como entero.
 * Nota: es-ES no agrupa los números de 4 cifras por defecto (minimumGroupingDigits = 2);
 * forzamos useGrouping: 'always' para que se lea "1.234,56 €" y "1.245 km".
 */
import type { ISODate, ISODateTime, Money, YearMonth } from '@/api/types'

export const LOCALE = 'es-ES'
const EMPTY = '—'

const moneyFmt = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: 'EUR',
  useGrouping: 'always',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const moneyFmtRound = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: 'EUR',
  useGrouping: 'always',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})
const moneyCompactFmt = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: 'EUR',
  notation: 'compact',
  maximumFractionDigits: 1,
})
const intFmt = new Intl.NumberFormat(LOCALE, { useGrouping: 'always', maximumFractionDigits: 0 })

/** Convierte un importe/decimal de la API a número (null si no es válido). */
export function toNumber(value: Money | string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

export function formatMoney(
  value: Money | string | number | null | undefined,
  opts: { round?: boolean; compact?: boolean; empty?: string } = {},
): string {
  const n = toNumber(value)
  if (n === null) return opts.empty ?? EMPTY
  if (opts.compact && Math.abs(n) >= 10000) return moneyCompactFmt.format(n)
  return (opts.round ? moneyFmtRound : moneyFmt).format(n)
}

export function formatNumber(value: number | string | null | undefined, maxFractionDigits = 0): string {
  const n = toNumber(value)
  if (n === null) return EMPTY
  if (maxFractionDigits === 0) return intFmt.format(n)
  return new Intl.NumberFormat(LOCALE, {
    useGrouping: 'always',
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFractionDigits,
  }).format(n)
}

/** Decimal con un número fijo de decimales: formatDecimal('5.9', 1) → '5,9'. */
export function formatDecimal(value: number | string | null | undefined, digits: number): string {
  const n = toNumber(value)
  if (n === null) return EMPTY
  return new Intl.NumberFormat(LOCALE, {
    useGrouping: 'always',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n)
}

/** '12.450 km'. */
export function formatKm(value: number | null | undefined, opts: { empty?: string } = {}): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return opts.empty ?? EMPTY
  return `${intFmt.format(value)} km`
}

/** '+12,5 %' / '−3 %'. */
export function formatPercent(value: number | null | undefined, opts: { signed?: boolean; digits?: number } = {}): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return EMPTY
  const fmt = new Intl.NumberFormat(LOCALE, {
    maximumFractionDigits: opts.digits ?? 1,
    minimumFractionDigits: 0,
    signDisplay: opts.signed ? 'exceptZero' : 'auto',
  })
  return `${fmt.format(value)} %`
}

/**
 * Matrícula como texto legible (la API la guarda en mayúsculas y sin espacios).
 * Formato actual español '4821KTB' → '4821 KTB'; las demás se dejan tal cual.
 */
export function formatPlate(plate: string | null | undefined): string {
  if (!plate) return ''
  const m = /^(\d{4})([A-Z]{3})$/.exec(plate)
  return m ? `${m[1]} ${m[2]}` : plate
}

// ───────── Fechas ─────────

/** 'YYYY-MM-DD' (o ISO con hora) → Date en hora local, sin desfases por zona horaria. */
export function parseISODate(value: ISODate | ISODateTime): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number)
    return new Date(y, m - 1, d)
  }
  return new Date(value)
}

export function toISODate(date: Date): ISODate {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function todayISO(): ISODate {
  return toISODate(new Date())
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date)
  const day = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + months)
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(day, lastDay))
  return d
}

const dateFmt = {
  short: new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' }),
  long: new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'long', year: 'numeric' }),
  numeric: new Intl.DateTimeFormat(LOCALE, { day: '2-digit', month: '2-digit', year: 'numeric' }),
  dayMonth: new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short' }),
  weekday: new Intl.DateTimeFormat(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' }),
}

/** '20 oct 2026' (short) · '20 de octubre de 2026' (long) · '20/10/2026' (numeric). */
export function formatDate(
  value: ISODate | ISODateTime | null | undefined,
  style: keyof typeof dateFmt = 'short',
  opts: { empty?: string } = {},
): string {
  if (!value) return opts.empty ?? EMPTY
  const d = parseISODate(value)
  if (Number.isNaN(d.getTime())) return opts.empty ?? EMPTY
  return dateFmt[style].format(d).replace(/\./g, '')
}

const dateTimeFmt = new Intl.DateTimeFormat(LOCALE, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

export function formatDateTime(value: ISODateTime | null | undefined): string {
  if (!value) return EMPTY
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return EMPTY
  return dateTimeFmt.format(d).replace(/\./g, '')
}

const monthShortFmt = new Intl.DateTimeFormat(LOCALE, { month: 'short' })
const monthLongFmt = new Intl.DateTimeFormat(LOCALE, { month: 'long', year: 'numeric' })
const monthShortYearFmt = new Intl.DateTimeFormat(LOCALE, { month: 'short', year: '2-digit' })

/** 'YYYY-MM' → 'oct' · 'octubre de 2026' · 'oct 26'. */
export function formatMonth(value: YearMonth, style: 'short' | 'long' | 'shortYear' = 'short'): string {
  const [y, m] = value.split('-').map(Number)
  const d = new Date(y, (m || 1) - 1, 1)
  const fmt = style === 'long' ? monthLongFmt : style === 'shortYear' ? monthShortYearFmt : monthShortFmt
  return fmt.format(d).replace(/\./g, '')
}

/** Días enteros entre dos fechas (b − a), ignorando la hora. */
export function daysBetween(a: Date, b: Date): number {
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())
  return Math.round((utcB - utcA) / 86_400_000)
}

const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' })

/** Fecha relativa a hoy: 'hoy', 'ayer', 'hace 3 días', 'en 2 meses', 'hace 1 año'. */
export function formatRelativeDate(value: ISODate | ISODateTime | null | undefined, now: Date = new Date()): string {
  if (!value) return EMPTY
  const d = parseISODate(value)
  if (Number.isNaN(d.getTime())) return EMPTY
  const days = daysBetween(now, d)
  const abs = Math.abs(days)
  if (abs < 31) return rtf.format(days, 'day')
  if (abs < 365) return rtf.format(Math.round(days / 30.44), 'month')
  return rtf.format(Math.round(days / 365.25), 'year')
}

/**
 * Instante relativo con precisión de minutos/horas: 'hace 5 minutos', 'hace 2 horas', 'ayer'.
 * `pastOnly`: para hechos ya ocurridos (actividad); un instante algo futuro por desfase de reloj
 * entre servidor y navegador se muestra como 'ahora mismo' en vez de 'dentro de 3 minutos'.
 */
export function formatRelativeTime(value: ISODateTime | null | undefined, now: Date = new Date(), opts: { pastOnly?: boolean } = {}): string {
  if (!value) return EMPTY
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return EMPTY
  let seconds = Math.round((d.getTime() - now.getTime()) / 1000)
  if (opts.pastOnly && seconds > 0 && seconds < 3600) seconds = 0
  const abs = Math.abs(seconds)
  if (abs < 45) return 'ahora mismo'
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), 'minute')
  if (abs < 86_400) return rtf.format(Math.round(seconds / 3600), 'hour')
  return formatRelativeDate(toISODate(d), now)
}

/** '1 día' / '12 días'. */
export function formatDays(value: number | null | undefined): string {
  if (value === null || value === undefined) return EMPTY
  const n = Math.abs(value)
  return `${intFmt.format(n)} ${n === 1 ? 'día' : 'días'}`
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) return EMPTY
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${formatNumber(bytes / 1024, 0)} KB`
  return `${formatNumber(bytes / (1024 * 1024), 1)} MB`
}

// ───────── Entrada de datos ─────────

/**
 * Normaliza lo que escribe el usuario en un campo decimal (es-ES o en-US) a '1234.56'.
 * '1.234,56' → '1234.56' · '12,5' → '12.5' · '12.50' → '12.50' · '' → null.
 */
export function normalizeDecimalInput(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null
  let s = raw.trim().replace(/\s|€/g, '')
  if (s === '') return null
  const hasComma = s.includes(',')
  const hasDot = s.includes('.')
  if (hasComma && hasDot) {
    // El último separador es el decimal
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.')
    else s = s.replace(/,/g, '')
  } else if (hasComma) {
    s = s.replace(',', '.')
  } else if (hasDot) {
    // '1.234' (miles es-ES) frente a '12.5' (decimal): 3 cifras tras un único punto ⇒ miles
    const parts = s.split('.')
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3 && parts[0].length <= 3 && !/^0/.test(parts[0]))) {
      s = parts.join('')
    }
  }
  if (!/^-?\d*(\.\d*)?$/.test(s) || s === '.' || s === '-') return null
  return s
}

/** Importe de la API ('1234.50') → texto editable en es-ES ('1234,50'). */
export function moneyToInput(value: Money | null | undefined): string {
  if (value === null || value === undefined || value === '') return ''
  const n = toNumber(value)
  if (n === null) return ''
  return n.toFixed(2).replace('.', ',')
}

/** Decimal normalizado → string con 2 decimales para la API ('12.5' → '12.50'). */
export function toMoneyString(value: string | null | undefined): Money | null {
  const normalized = normalizeDecimalInput(value ?? null)
  if (normalized === null) return null
  const n = Number(normalized)
  if (!Number.isFinite(n)) return null
  return n.toFixed(2)
}

/** '12.450' / '12450' / '12 450' → 12450 (null si vacío o inválido). */
export function parseIntegerInput(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined) return null
  const s = raw.replace(/[\s.]/g, '').replace(/km$/i, '')
  if (s === '') return null
  if (!/^\d+$/.test(s)) return null
  return Number(s)
}
