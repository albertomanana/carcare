/**
 * Formulario de un presupuesto de solicitud (contrato §3.13.5): 1–50 líneas con precio obligatorio, IVA 0–100,
 * validez 1–90 días (15 por defecto) y nota ≤ 1.000. El dinero viaja como string DECIMAL ('12.50').
 */
import { z } from 'zod'
import type { QuoteLineItemInput, RepairQuote, RepairQuoteInput } from '@/api/types'
import { emptyLine, formToLine, lineItemSchema, lineToForm, MAX_ITEMS } from '@/components/forms/LineItemsEditor'
import { addDays, normalizeDecimalInput, parseIntegerInput, toISODate } from '@/lib/format'

export const DEFAULT_VALID_DAYS = 15
export const MAX_VALID_DAYS = 90
export const MAX_QUOTE_NOTE = 1000

/** Campos del formulario que pueden recibir un 422 del servidor. */
export const QUOTE_FIELD_NAMES = ['items', 'tax_rate', 'valid_days', 'note'] as const

/** IVA escrito por el usuario ('21', '10,5') → error o null. */
export function taxRateError(raw: string): string | null {
  if (!raw.trim()) return 'Indica el IVA (0 si no se aplica).'
  const normalized = normalizeDecimalInput(raw.replace('%', ''))
  if (normalized === null) return 'Porcentaje no válido.'
  const n = Number(normalized)
  if (!Number.isFinite(n) || n < 0 || n > 100) return 'Debe estar entre 0 y 100.'
  if (/\.\d{3,}$/.test(normalized)) return 'Máximo 2 decimales.'
  return null
}

export function validDaysError(raw: string): string | null {
  const n = parseIntegerInput(raw)
  if (n === null) return 'Escribe un número entero de días.'
  if (n < 1 || n > MAX_VALID_DAYS) return `Entre 1 y ${MAX_VALID_DAYS} días.`
  return null
}

/** En un presupuesto el precio es obligatorio (en una orden no). */
const quoteItemSchema = lineItemSchema.superRefine((v, ctx) => {
  if (!v.unit_price.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['unit_price'], message: 'Indica el precio.' })
})

export const quoteSchema = z.object({
  items: z.array(quoteItemSchema).min(1, 'Añade al menos una línea.').max(MAX_ITEMS, `Máximo ${MAX_ITEMS} líneas.`),
  tax_rate: z.string().superRefine((v, ctx) => {
    const e = taxRateError(v)
    if (e) ctx.addIssue({ code: z.ZodIssueCode.custom, message: e })
  }),
  valid_days: z.string().superRefine((v, ctx) => {
    const e = validDaysError(v)
    if (e) ctx.addIssue({ code: z.ZodIssueCode.custom, message: e })
  }),
  note: z.string().max(MAX_QUOTE_NOTE, 'Máximo 1.000 caracteres.'),
})

export type QuoteValues = z.infer<typeof quoteSchema>

/** '21.00' → '21' · '10.50' → '10,5' (como lo escribiría una persona). */
export function rateToInput(rate: string | null | undefined): string {
  const n = Number(rate ?? '')
  if (rate == null || rate === '' || !Number.isFinite(n)) return ''
  return String(Number(n.toFixed(2))).replace('.', ',')
}

/**
 * Valores iniciales. Con `initial` (la versión anterior, p. ej. la que rechazó el cliente) se parte de sus líneas,
 * su IVA, su validez y su nota; si no, una línea vacía de mano de obra y el IVA del taller.
 */
export function quoteToValues(defaultTaxRate: string, initial?: RepairQuote | null): QuoteValues {
  return {
    items: initial?.items.length ? initial.items.map(lineToForm) : [emptyLine('labor')],
    tax_rate: rateToInput(initial?.tax_rate ?? defaultTaxRate),
    valid_days: String(initial?.valid_days ?? DEFAULT_VALID_DAYS),
    note: initial?.note ?? '',
  }
}

export function valuesToQuoteInput(v: QuoteValues): RepairQuoteInput {
  const rate = Number(normalizeDecimalInput(v.tax_rate.replace('%', '')) ?? '0')
  return {
    items: v.items.map((item): QuoteLineItemInput => {
      const line = formToLine(item)
      // El esquema ya exige el precio: el respaldo solo satisface al tipo
      return { ...line, unit_price: line.unit_price ?? '0.00' }
    }),
    tax_rate: rate.toFixed(2),
    valid_days: parseIntegerInput(v.valid_days) ?? DEFAULT_VALID_DAYS,
    note: v.note.trim() || null,
  }
}

/** Fecha hasta la que valdría si se envía hoy (el servidor la fija con su fecha de envío). */
export function validUntilPreview(validDays: string, today: Date = new Date()): string | null {
  if (validDaysError(validDays)) return null
  return toISODate(addDays(today, parseIntegerInput(validDays) ?? DEFAULT_VALID_DAYS))
}

/**
 * Las claves 422 llegan como `quote.items.0.unit_price` al aceptar con presupuesto y como `items.0.unit_price`
 * al enviar una versión: se quita el prefijo para llevarlas a su campo.
 */
export function stripErrorPrefix(errors: Record<string, string[]>, prefix: string): Record<string, string> {
  return Object.fromEntries(Object.keys(errors).map((k) => [k, prefix && k.startsWith(prefix) ? k.slice(prefix.length) : k]))
}

/** Última versión, si el cliente la rechazó (para partir de ella al enviar otra). */
export function lastRejectedQuote(quotes: RepairQuote[]): RepairQuote | null {
  return quotes[0]?.status === 'rejected' ? quotes[0] : null
}
