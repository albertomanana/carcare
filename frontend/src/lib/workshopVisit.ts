/**
 * «Coche en el taller» visto desde el garaje del particular. Un vehículo personal solo se une a una orden de taller a
 * través de una solicitud convertida (contrato §3.13.6): de ahí salen el taller, el estado, el elevador, el nombre de
 * pila de quien lo lleva y los tiempos. Nada de esto se inventa: si el taller no usa CarCare, aquí no aparece nada.
 * Lógica pura (se prueba con Vitest).
 */
import type { ID, RepairRequest, RepairRequestWorkOrder, WorkOrderStatus } from '@/api/types'
import { WORK_ORDER_STATUS_LABEL } from '@/lib/labels'

export interface WorkshopVisit {
  requestId: ID
  vehicleId: ID
  workshopName: string
  /** Asunto de la solicitud (pasa a ser el título de la orden). */
  title: string
  order: RepairRequestWorkOrder
}

const CLOSED: WorkOrderStatus[] = ['delivered', 'cancelled']

/** true si la orden sigue abierta: el coche está (o va a estar) en el taller. */
export function isVisitOpen(order: Pick<RepairRequestWorkOrder, 'status'> | null | undefined): order is RepairRequestWorkOrder {
  return !!order && !CLOSED.includes(order.status)
}

/**
 * Visitas abiertas por vehículo. Si un coche tuviera dos órdenes abiertas (dos talleres), gana la que cambió de estado
 * más tarde: es la que está viva.
 */
export function openVisits(requests: readonly RepairRequest[]): Map<ID, WorkshopVisit> {
  const out = new Map<ID, WorkshopVisit>()
  for (const r of requests) {
    if (r.perspective !== 'requester' || r.vehicle_id == null || !isVisitOpen(r.work_order)) continue
    const prev = out.get(r.vehicle_id)
    if (prev && Date.parse(prev.order.status_changed_at) >= Date.parse(r.work_order.status_changed_at)) continue
    out.set(r.vehicle_id, { requestId: r.id, vehicleId: r.vehicle_id, workshopName: r.workshop.name, title: r.title, order: r.work_order })
  }
  return out
}

/** Dónde está el coche dentro del taller, con las palabras del taller. */
export function visitPlace(order: Pick<RepairRequestWorkOrder, 'status' | 'bay'>): string {
  if (order.status === 'ready') return 'Listo para recoger'
  if (order.bay != null) return `Elevador ${order.bay}`
  return order.status === 'received' ? 'Recibido, a la espera' : 'En la zona de espera'
}

/** Estado en una frase corta para el particular: «En reparación · lo lleva Andrés». */
export function visitStatus(order: Pick<RepairRequestWorkOrder, 'status' | 'mechanic_name'>): string {
  const label = order.status === 'ready' ? 'Trabajo terminado' : WORK_ORDER_STATUS_LABEL[order.status]
  return order.mechanic_name && order.status !== 'ready' ? `${label} · lo lleva ${order.mechanic_name}` : label
}

export interface VisitStep {
  status: WorkOrderStatus
  label: string
  state: 'done' | 'current' | 'todo'
}

const STEPS: WorkOrderStatus[] = ['received', 'diagnosing', 'in_progress', 'ready', 'delivered']

/**
 * El recorrido de la orden para el particular: por dónde va y qué queda. «Esperando piezas» solo aparece si es el estado
 * actual (no toda reparación pasa por ahí). Una orden cancelada no tiene recorrido. Los pasos anteriores al actual se dan
 * por pasados: el taller puede haberse saltado alguno.
 */
export function visitSteps(status: WorkOrderStatus): VisitStep[] {
  if (status === 'cancelled') return []
  const order = status === 'waiting_parts' ? ['received', 'diagnosing', 'waiting_parts', 'in_progress', 'ready', 'delivered'] as WorkOrderStatus[] : STEPS
  const at = order.indexOf(status)
  return order.map((s, i) => ({ status: s, label: WORK_ORDER_STATUS_LABEL[s], state: i < at ? 'done' : i === at ? 'current' : 'todo' }))
}

/** Frase completa para lectores de pantalla y títulos. */
export function visitSentence(v: WorkshopVisit): string {
  const o = v.order
  const label = (o.status === 'ready' ? 'Trabajo terminado' : WORK_ORDER_STATUS_LABEL[o.status]).toLowerCase()
  const who = o.mechanic_name && o.status !== 'ready' ? `, lo lleva ${o.mechanic_name}` : ''
  return `En el taller ${v.workshopName}: ${visitPlace(o).toLowerCase()}, ${label}${who}`
}
