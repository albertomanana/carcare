/**
 * Campos de la orden de trabajo compartidos por «Nueva orden» y el detalle (validación alineada con
 * WorkOrderRequest del backend: título 2–120, textos ≤ 5.000, km 0–2.000.000, máx. 50 líneas).
 */
import { z } from 'zod'
import type { Priority, WorkOrder, WorkOrderInput } from '@/api/types'
import { formToLine, lineItemSchema, lineToForm } from '@/components/forms/LineItemsEditor'
import { formatNumber, parseIntegerInput } from '@/lib/format'
import { mileageError } from '@/lib/validation'
import { fromDateTimeLocal, toDateTimeLocal } from './orderUtils'

export const PRIORITY_VALUES = ['low', 'normal', 'high', 'urgent'] as const satisfies readonly Priority[]

export const orderFields = {
  title: z.string().trim().min(2, 'Describe el trabajo en al menos 2 caracteres.').max(120, 'Máximo 120 caracteres.'),
  complaint: z.string().max(5000, 'Máximo 5.000 caracteres.'),
  diagnosis: z.string().max(5000, 'Máximo 5.000 caracteres.'),
  priority: z.enum(PRIORITY_VALUES),
  assigned_to: z.string(),
  mileage_in: z.string().superRefine((v, ctx) => {
    const e = mileageError(v)
    if (e) ctx.addIssue({ code: z.ZodIssueCode.custom, message: e })
  }),
  promised_at: z.string().refine((v) => !v || fromDateTimeLocal(v) !== null, 'Fecha y hora no válidas.'),
  items: z.array(lineItemSchema).max(50, 'Una orden admite como máximo 50 líneas.'),
}

export const orderSchema = z.object(orderFields)
export type OrderValues = z.infer<typeof orderSchema>

/** Campos que el servidor puede devolver con error 422 y que existen en el formulario. */
export const ORDER_FIELD_NAMES = ['title', 'complaint', 'diagnosis', 'priority', 'assigned_to', 'mileage_in', 'promised_at', 'items'] as const

export function orderToValues(order: WorkOrder | null): OrderValues {
  return {
    title: order?.title ?? '',
    complaint: order?.complaint ?? '',
    diagnosis: order?.diagnosis ?? '',
    priority: order?.priority ?? 'normal',
    assigned_to: order?.assigned_to ? String(order.assigned_to.id) : '',
    mileage_in: order?.mileage_in != null ? formatNumber(order.mileage_in) : '',
    promised_at: toDateTimeLocal(order?.promised_at),
    items: order?.items.map(lineToForm) ?? [],
  }
}

export function valuesToInput(v: OrderValues): Omit<WorkOrderInput, 'vehicle_id'> {
  return {
    title: v.title.trim(),
    complaint: v.complaint.trim() || null,
    diagnosis: v.diagnosis.trim() || null,
    priority: v.priority,
    assigned_to: v.assigned_to ? Number(v.assigned_to) : null,
    mileage_in: parseIntegerInput(v.mileage_in),
    promised_at: fromDateTimeLocal(v.promised_at),
    items: v.items.map(formToLine),
  }
}
