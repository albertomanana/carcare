/**
 * «Nueva orden»: vehículo del taller o alta rápida (cliente + vehículo) y los campos de la orden.
 * Al enviar se encadenan hasta tres peticiones (cliente → vehículo → orden); lo ya creado se conserva
 * para que un error en un paso posterior no duplique nada al reintentar.
 */
import { z } from 'zod'
import type { BodyType, CustomerInput, ID, VehicleInput, WorkOrderInput } from '@/api/types'
import { COLOR_HEX_REGEX, normalizePlate } from '@/lib/validation'
import { PHONE_REGEX } from './customerForm'
import { orderFields, orderToValues, valuesToInput } from './orderForm'

export const VEHICLE_MODES = ['existing', 'new'] as const
export const CUSTOMER_MODES = ['existing', 'new', 'none'] as const
export type VehicleMode = (typeof VEHICLE_MODES)[number]
export type CustomerMode = (typeof CUSTOMER_MODES)[number]

/** Colores habituales para la miniatura del coche (el resto de datos se completan en su ficha). */
export const QUICK_COLORS: { hex: string; name: string }[] = [
  { hex: '#F2F2EF', name: 'Blanco' },
  { hex: '#15171A', name: 'Negro' },
  { hex: '#A9AEB4', name: 'Gris plata' },
  { hex: '#4B5157', name: 'Gris grafito' },
  { hex: '#C62828', name: 'Rojo' },
  { hex: '#1F4E9C', name: 'Azul' },
  { hex: '#2E6B45', name: 'Verde' },
  { hex: '#CDBA96', name: 'Beige' },
  { hex: '#E8C21C', name: 'Amarillo' },
  { hex: '#E06A1B', name: 'Naranja' },
  { hex: '#6B4A35', name: 'Marrón' },
]

/** Títulos frecuentes para rellenar con un toque. */
export const QUICK_TITLES = ['Revisión periódica', 'Cambio de aceite y filtros', 'Revisión de frenos', 'Cambio de neumáticos', 'Diagnóstico de avería', 'Revisión pre-ITV']

export const newOrderSchema = z
  .object({
    ...orderFields,
    vehicle_mode: z.enum(VEHICLE_MODES),
    vehicle_id: z.string(),
    customer_mode: z.enum(CUSTOMER_MODES),
    customer_id: z.string(),
    customer_name: z.string(),
    customer_phone: z.string(),
    customer_email: z.string(),
    make: z.string(),
    model: z.string(),
    plate: z.string(),
    body_type: z.string(),
    color_hex: z.string(),
    bay: z.string(),
  })
  .superRefine((v, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message })
    if (v.vehicle_mode === 'existing') {
      if (!v.vehicle_id) issue('vehicle_id', 'Elige el vehículo o da de alta uno nuevo.')
      return
    }
    if (!v.make.trim()) issue('make', 'Indica la marca.')
    else if (v.make.trim().length > 60) issue('make', 'Máximo 60 caracteres.')
    if (!v.model.trim()) issue('model', 'Indica el modelo.')
    else if (v.model.trim().length > 80) issue('model', 'Máximo 80 caracteres.')
    if (v.plate.trim() && !/^[A-Z0-9]{2,12}$/.test(normalizePlate(v.plate))) issue('plate', 'Solo letras y números (entre 2 y 12).')
    if (v.color_hex && !COLOR_HEX_REGEX.test(v.color_hex)) issue('color_hex', 'Color no válido.')
    if (v.customer_mode === 'existing' && !v.customer_id) issue('customer_id', 'Elige el cliente, crea uno nuevo o marca «Sin cliente».')
    if (v.customer_mode === 'new') {
      const name = v.customer_name.trim()
      if (name.length < 2) issue('customer_name', 'Escribe el nombre del cliente (al menos 2 caracteres).')
      else if (name.length > 120) issue('customer_name', 'Máximo 120 caracteres.')
      if (v.customer_phone.trim() && !PHONE_REGEX.test(v.customer_phone.trim())) issue('customer_phone', 'Solo números, espacios y los signos + ( ) - . (entre 6 y 30).')
      if (v.customer_email.trim() && !z.string().email().safeParse(v.customer_email.trim()).success) issue('customer_email', 'Escribe un email válido.')
    }
  })

export type NewOrderValues = z.infer<typeof newOrderSchema>

export function newOrderDefaults(preset: { vehicleId?: string | null; customerId?: string | null; bay?: string | null } = {}): NewOrderValues {
  return {
    ...orderToValues(null),
    vehicle_mode: 'existing',
    vehicle_id: preset.vehicleId ?? '',
    customer_mode: preset.customerId ? 'existing' : 'new',
    customer_id: preset.customerId ?? '',
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    make: '',
    model: '',
    plate: '',
    body_type: '',
    color_hex: '',
    bay: preset.bay ?? '',
  }
}

export function customerPayload(v: NewOrderValues): CustomerInput {
  return {
    name: v.customer_name.trim(),
    phone: v.customer_phone.trim() || null,
    email: v.customer_email.trim().toLowerCase() || null,
  }
}

export function vehiclePayload(v: NewOrderValues, customerId: ID | null): VehicleInput {
  return {
    make: v.make.trim(),
    model: v.model.trim(),
    plate: normalizePlate(v.plate) || null,
    body_type: (v.body_type || null) as BodyType | null,
    color_hex: v.color_hex ? v.color_hex.toUpperCase() : null,
    customer_id: customerId,
  }
}

export function orderPayload(v: NewOrderValues, vehicleId: ID): WorkOrderInput {
  const base = valuesToInput(v)
  return { vehicle_id: vehicleId, ...base, diagnosis: null, bay: v.bay ? Number(v.bay) : null }
}

/** Errores 422 de cada paso → campos del formulario. */
export const CUSTOMER_ERROR_MAP: Record<string, string> = { name: 'customer_name', phone: 'customer_phone', email: 'customer_email' }
export const VEHICLE_ERROR_MAP: Record<string, string> = { customer_id: 'customer_id' }
export const NEW_ORDER_FIELD_NAMES = [
  'title',
  'complaint',
  'priority',
  'assigned_to',
  'mileage_in',
  'promised_at',
  'items',
  'vehicle_id',
  'customer_id',
  'customer_name',
  'customer_phone',
  'customer_email',
  'make',
  'model',
  'plate',
  'body_type',
  'color_hex',
  'bay',
] as const
