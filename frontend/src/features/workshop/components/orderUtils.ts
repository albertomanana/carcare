/**
 * Utilidades puras del modo taller (sin React): fechas prometidas, elevadores y flujo de estados.
 */
import type { Bay, ISODateTime, WorkOrder, WorkOrderStatus } from '@/api/types'
import { daysBetween, LOCALE } from '@/lib/format'
import { OPEN_WORK_ORDER_STATUSES, WORK_ORDER_STATUS_LABEL } from '@/lib/labels'

export const KANBAN_STATUSES: WorkOrderStatus[] = OPEN_WORK_ORDER_STATUSES

export function isFinalStatus(status: WorkOrderStatus): boolean {
  return status === 'delivered' || status === 'cancelled'
}

/** El contrato solo permite borrar órdenes recibidas o canceladas (y con permiso manage). */
export function isDeletableStatus(status: WorkOrderStatus): boolean {
  return status === 'received' || status === 'cancelled'
}

/** Paso natural siguiente para el botón principal de la orden (esperar piezas es opcional). */
export function nextStep(status: WorkOrderStatus): { status: WorkOrderStatus; label: string } | null {
  switch (status) {
    case 'received':
      return { status: 'diagnosing', label: 'Empezar diagnóstico' }
    case 'diagnosing':
    case 'waiting_parts':
      return { status: 'in_progress', label: 'Pasar a reparación' }
    case 'in_progress':
      return { status: 'ready', label: 'Marcar como lista' }
    case 'ready':
      return { status: 'delivered', label: 'Entregar al cliente' }
    default:
      return null
  }
}

export function statusLabel(status: WorkOrderStatus): string {
  return WORK_ORDER_STATUS_LABEL[status]
}

// ───────── Fechas con hora (promised_at) ─────────

const pad = (n: number) => String(n).padStart(2, '0')

/** ISO 8601 → valor de <input type="datetime-local"> ('YYYY-MM-DDTHH:mm') en hora local. */
export function toDateTimeLocal(value: ISODateTime | null | undefined): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 'YYYY-MM-DDTHH:mm' (hora local) → ISO 8601 con el desplazamiento local ('2026-10-23T14:00:00+02:00'). */
export function fromDateTimeLocal(value: string | null | undefined): ISODateTime | null {
  if (!value) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value)
  if (!m) return null
  const [, y, mo, d, h, mi] = m.map(Number)
  const date = new Date(y, mo - 1, d, h, mi, 0, 0)
  if (Number.isNaN(date.getTime())) return null
  const offset = -date.getTimezoneOffset()
  const sign = offset >= 0 ? '+' : '-'
  const abs = Math.abs(offset)
  return `${y}-${pad(mo)}-${pad(d)}T${pad(h)}:${pad(mi)}:00${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
}

/** Fecha local + hora fija → valor datetime-local (atajos "Hoy, 19:00", "Mañana, 13:00"). */
export function dateTimeLocalAt(daysFromToday: number, hour: number, minute = 0, now: Date = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysFromToday, hour, minute)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const timeFmt = new Intl.DateTimeFormat(LOCALE, { hour: '2-digit', minute: '2-digit' })
const dayFmt = new Intl.DateTimeFormat(LOCALE, { weekday: 'short', day: 'numeric', month: 'short' })
const dayYearFmt = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' })

/** 'Hoy, 18:00' · 'Mañana, 13:00' · 'Ayer, 19:00' · 'jue 23 oct, 14:00' · '3 ene 2027, 09:00'. */
export function formatWhen(value: ISODateTime | null | undefined, now: Date = new Date()): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  const days = daysBetween(now, d)
  const time = timeFmt.format(d)
  if (days === 0) return `Hoy, ${time}`
  if (days === 1) return `Mañana, ${time}`
  if (days === -1) return `Ayer, ${time}`
  const fmt = d.getFullYear() === now.getFullYear() ? dayFmt : dayYearFmt
  return `${fmt.format(d).replace(/\./g, '').replace(',', '')}, ${time}`
}

// ───────── Elevadores ─────────

export interface BayOption {
  number: number
  /** Orden que lo ocupa (distinta de la orden actual). */
  occupiedBy: WorkOrder | null
  label: string
}

/** Opciones de elevador para una orden: los ocupados por otra orden se marcan (el servidor responde 409). */
export function bayOptions(bays: Bay[] | undefined, currentOrderId?: number | null): BayOption[] {
  return (bays ?? []).map((b) => {
    const occupiedBy = b.work_order && b.work_order.id !== currentOrderId ? b.work_order : null
    return {
      number: b.number,
      occupiedBy,
      label: occupiedBy ? `Elevador ${b.number} · ocupado por ${occupiedBy.number}` : `Elevador ${b.number} · libre`,
    }
  })
}

export function baysSummary(bays: Bay[] | undefined): { total: number; busy: number; free: number } {
  const total = bays?.length ?? 0
  const busy = bays?.filter((b) => b.work_order).length ?? 0
  return { total, busy, free: total - busy }
}

/** Órdenes abiertas sin elevador (zona de espera del taller), las urgentes y con retraso primero. */
export function waitingOrders(orders: WorkOrder[] | undefined): WorkOrder[] {
  const rank: Record<WorkOrder['priority'], number> = { urgent: 0, high: 1, normal: 2, low: 3 }
  return (orders ?? [])
    .filter((o) => o.bay === null && !isFinalStatus(o.status))
    .sort((a, b) => Number(b.is_late) - Number(a.is_late) || rank[a.priority] - rank[b.priority])
}

// ───────── Flujo de estados (stepper) ─────────

/** Flujo natural de una orden. «Esperando piezas» es un desvío opcional. */
export const ORDER_FLOW: WorkOrderStatus[] = ['received', 'diagnosing', 'waiting_parts', 'in_progress', 'ready', 'delivered']

export type StepState = 'done' | 'current' | 'todo' | 'optional'

/**
 * Estado de cada paso respecto al estado actual. No conocemos el historial de estados, así que
 * «Esperando piezas» nunca se marca como hecho: si no es el actual, queda como paso opcional.
 */
export function stepStates(status: WorkOrderStatus): Record<WorkOrderStatus, StepState> {
  const current = ORDER_FLOW.indexOf(status)
  const result = {} as Record<WorkOrderStatus, StepState>
  ORDER_FLOW.forEach((s, i) => {
    if (i === current) result[s] = 'current'
    else if (s === 'waiting_parts') result[s] = 'optional'
    else if (current >= 0 && i < current) result[s] = 'done'
    else result[s] = 'todo'
  })
  result.cancelled = status === 'cancelled' ? 'current' : 'todo'
  return result
}

// ───────── Fecha prometida: atajos ─────────

/** Atajos habituales en un taller: hoy a última hora (si aún da tiempo), mañana a mediodía o por la tarde, pasado mañana. */
export function promisedShortcuts(now: Date = new Date()): { label: string; value: string }[] {
  const list: { label: string; value: string }[] = []
  if (now.getHours() < 18) list.push({ label: 'Hoy, 19:00', value: dateTimeLocalAt(0, 19, 0, now) })
  list.push({ label: 'Mañana, 13:00', value: dateTimeLocalAt(1, 13, 0, now) })
  list.push({ label: 'Mañana, 19:00', value: dateTimeLocalAt(1, 19, 0, now) })
  list.push({ label: 'Pasado mañana, 19:00', value: dateTimeLocalAt(2, 19, 0, now) })
  return list
}

/** true si la fecha (valor datetime-local) ya ha pasado. */
export function isPastLocal(value: string, now: Date = new Date()): boolean {
  const iso = fromDateTimeLocal(value)
  return !!iso && new Date(iso).getTime() < now.getTime()
}

/** Resumen corto para el encabezado: "Elevadores ocupados: 3 de 4 · 11 en espera". */
export function floorSummary(bays: Bay[], orders: WorkOrder[] | undefined): string {
  const { total, busy } = baysSummary(bays)
  const waiting = orders ? waitingOrders(orders).length : null
  return `Elevadores ocupados: ${busy} de ${total}${waiting !== null ? ` · ${waiting} en espera` : ''}`
}

// ───────── Resumen imprimible ─────────

/** Rótulo obligatorio de la hoja imprimible (D12 = A): CarCare no emite facturas. */
export const ORDER_SUMMARY_LABEL = 'Resumen de la orden — no es una factura'

/** Título del documento, que el navegador propone como nombre del PDF: 'Resumen OT-2026-0024 4470LJD 2026-10-24'. */
export function orderSummaryTitle(number: string, plate: string | null, date: string): string {
  return ['Resumen', number, plate, date].filter(Boolean).join(' ')
}
