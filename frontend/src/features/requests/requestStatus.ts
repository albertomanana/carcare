/**
 * E16 · textos de estado de una solicitud según quién la mira (contrato §3.13.4) y etiquetas comunes
 * de las pantallas del particular y del taller. El estado nunca va solo con color: icono + texto.
 */
import { Ban, CircleCheck, CircleX, FileText, Hourglass, Inbox, type LucideIcon, Send, Wrench } from 'lucide-react'
import type { BodyType, FuelType, RepairQuote, RepairQuoteStatus, RepairRequest, RepairRequestStatus, WorkshopService } from '@/api/types'
import { vehicleColorName } from '@/lib/colors'
import { formatPlate } from '@/lib/format'
import { BODY_LABEL, FUEL_LABEL } from '@/lib/labels'
import type { Tone } from '@/lib/status'

export type RequestPerspective = RepairRequest['perspective']

/** Tabla "Textos de estado en la SPA" de §3.13.4. `converted` lleva detrás el número de la orden. */
export const REQUEST_STATUS_TEXT: Record<RequestPerspective, Record<RepairRequestStatus, string>> = {
  requester: {
    pending: 'Enviada',
    accepted: 'Aceptada · presupuesto pendiente',
    quoted: 'Presupuesto recibido',
    rejected: 'Rechazada',
    cancelled: 'Cancelada',
    converted: 'En el taller',
  },
  workshop: {
    pending: 'Nueva',
    accepted: 'Aceptada · falta el presupuesto',
    quoted: 'Presupuesto enviado',
    rejected: 'Rechazada',
    cancelled: 'Cancelada por el cliente',
    converted: 'Orden',
  },
}

const STATUS_ICON: Record<RepairRequestStatus, LucideIcon> = {
  pending: Send,
  accepted: Hourglass,
  quoted: FileText,
  rejected: CircleX,
  cancelled: Ban,
  converted: Wrench,
}

export const OPEN_REQUEST_STATUSES: RepairRequestStatus[] = ['pending', 'accepted', 'quoted']

export function isOpenRequest(status: RepairRequestStatus): boolean {
  return OPEN_REQUEST_STATUSES.includes(status)
}

/**
 * Texto del estado. `converted` ⇒ "En el taller · OT‑2026‑0031" (particular) u "Orden OT‑2026‑0031" (taller).
 * Si el taller borró la orden, `work_order` llega a null y se dice.
 */
export function requestStatusText(request: Pick<RepairRequest, 'status' | 'perspective' | 'work_order'>): string {
  const base = REQUEST_STATUS_TEXT[request.perspective][request.status]
  if (request.status !== 'converted') return base
  if (!request.work_order) return request.perspective === 'requester' ? 'En el taller · orden eliminada' : 'Orden eliminada'
  return request.perspective === 'requester' ? `${base} · ${request.work_order.number}` : `${base} ${request.work_order.number}`
}

/** ¿Le toca actuar a quien mira? Particular: presupuesto recibido. Taller: nueva o aceptada sin presupuesto. */
export function needsAttention(request: Pick<RepairRequest, 'status' | 'perspective'>): boolean {
  return request.perspective === 'requester' ? request.status === 'quoted' : request.status === 'pending' || request.status === 'accepted'
}

export interface RequestStatusDescriptor {
  label: string
  icon: LucideIcon
  tone: Tone
  /** true ⇒ se pinta como píldora (R5: solo lo que pide atención). Si no, texto gris con su icono. */
  attention: boolean
}

export function requestStatusDescriptor(request: Pick<RepairRequest, 'status' | 'perspective' | 'work_order'>): RequestStatusDescriptor {
  const attention = needsAttention(request)
  return {
    label: requestStatusText(request),
    icon: STATUS_ICON[request.status],
    tone: attention ? 'info' : request.status === 'converted' ? 'ok' : 'neutral',
    attention,
  }
}

// ───────── Presupuesto ─────────

export const QUOTE_STATUS_TEXT: Record<RepairQuoteStatus, string> = {
  sent: 'Vigente',
  accepted: 'Aceptado',
  rejected: 'Rechazado',
  superseded: 'Sustituido',
}

const QUOTE_STATUS_ICON: Record<RepairQuoteStatus, LucideIcon> = {
  sent: Inbox,
  accepted: CircleCheck,
  rejected: CircleX,
  superseded: Ban,
}

/** Estado de una versión; una vigente caducada se muestra como "Caducado". */
export function quoteStatus(quote: Pick<RepairQuote, 'status' | 'is_expired'>): { label: string; icon: LucideIcon; tone: Tone } {
  if (quote.status === 'sent' && quote.is_expired) return { label: 'Caducado', icon: Hourglass, tone: 'warning' }
  return { label: QUOTE_STATUS_TEXT[quote.status], icon: QUOTE_STATUS_ICON[quote.status], tone: quote.status === 'accepted' ? 'ok' : 'neutral' }
}

/** Versión vigente (la primera de `quotes`, si su estado es `sent`). */
export function currentQuote(request: Pick<RepairRequest, 'quotes'>): RepairQuote | null {
  const first = request.quotes[0]
  return first && first.status === 'sent' ? first : null
}

// ───────── Directorio ─────────

export const WORKSHOP_SERVICE_LABEL: Record<WorkshopService, string> = {
  maintenance: 'Mantenimiento y revisiones',
  mechanics: 'Mecánica general',
  tyres: 'Neumáticos',
  brakes: 'Frenos',
  bodywork: 'Chapa y pintura',
  electrical: 'Electricidad y baterías',
  ac: 'Aire acondicionado',
  pre_itv: 'Pre‑ITV',
}

export const WORKSHOP_SERVICES: WorkshopService[] = ['maintenance', 'mechanics', 'tyres', 'brakes', 'bodywork', 'electrical', 'ac', 'pre_itv']

// ───────── Copia fija del coche (§3.13.3) ─────────

interface VehicleLook {
  make: string
  model: string
  year: number | null
  fuel_type: FuelType | null
  body_type: BodyType | null
  color_hex: string | null
  plate: string | null
}

/**
 * Los 7 datos del coche que recibe el taller, en el orden del consentimiento:
 * "Seat Ibiza · 2019 · Gasolina · Hatchback · Gris · 1234 ABC". Lo que falta no se rellena.
 */
export function vehicleCopyFacts(v: VehicleLook): string[] {
  return [
    `${v.make} ${v.model}`.trim(),
    v.year ? String(v.year) : null,
    v.fuel_type ? FUEL_LABEL[v.fuel_type] : null,
    v.body_type ? BODY_LABEL[v.body_type] : null,
    vehicleColorName(v.color_hex),
    v.plate ? formatPlate(v.plate) : null,
  ].filter((x): x is string => !!x)
}

// ───────── Consentimiento (§3.13.7) ─────────

/** Primer párrafo del consentimiento, literal del contrato, con el nombre del taller. */
export function consentText(workshopName: string): string {
  return `${workshopName} verá tu nombre, tu email, el teléfono que indiques, estos datos del coche (marca, modelo, año, combustible, carrocería, color y matrícula) y los km. Si aceptas su presupuesto, te dará de alta como cliente suyo.`
}

/** Texto de la casilla "Compartir historial", literal del contrato. */
export const SHARE_HISTORY_TEXT =
  'Compartir también el historial de intervenciones (fecha, tipo, zona, título, km y taller; nunca importes ni notas) mientras la solicitud esté abierta. Puedes retirarlo cuando quieras.'
