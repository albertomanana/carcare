/**
 * Formulario de cliente (alineado con CustomerRequest del backend: nombre 2–120, email válido,
 * teléfono 6–30 caracteres con números, espacios y + ( ) - ., NIF ≤ 20, notas ≤ 2.000).
 */
import { z } from 'zod'
import type { Customer, CustomerInput } from '@/api/types'

export const PHONE_REGEX = /^[0-9+()\s.-]{6,30}$/

export const customerFields = {
  name: z.string().trim().min(2, 'Escribe al menos 2 caracteres.').max(120, 'Máximo 120 caracteres.'),
  phone: z
    .string()
    .trim()
    .refine((v) => !v || PHONE_REGEX.test(v), 'Solo números, espacios y los signos + ( ) - . (entre 6 y 30).'),
  email: z
    .string()
    .trim()
    .max(255, 'Máximo 255 caracteres.')
    .refine((v) => !v || z.string().email().safeParse(v).success, 'Escribe un email válido.'),
  tax_id: z.string().trim().max(20, 'Máximo 20 caracteres.'),
  notes: z.string().max(2000, 'Máximo 2.000 caracteres.'),
}

export const customerSchema = z.object(customerFields)
export type CustomerValues = z.infer<typeof customerSchema>
export const CUSTOMER_FIELD_NAMES = ['name', 'phone', 'email', 'tax_id', 'notes'] as const

export function customerToValues(c: Customer | null): CustomerValues {
  return {
    name: c?.name ?? '',
    phone: c?.phone ?? '',
    email: c?.email ?? '',
    tax_id: c?.tax_id ?? '',
    notes: c?.notes ?? '',
  }
}

export function valuesToCustomerInput(v: CustomerValues): CustomerInput {
  return {
    name: v.name.trim(),
    phone: v.phone.trim() || null,
    email: v.email.trim().toLowerCase() || null,
    tax_id: v.tax_id.replace(/[\s-]+/g, '').toUpperCase() || null,
    notes: v.notes.trim() || null,
  }
}

/** `mailto:` y `tel:` solo con datos válidos. */
export function mailHref(email: string): string {
  return `mailto:${email}`
}
