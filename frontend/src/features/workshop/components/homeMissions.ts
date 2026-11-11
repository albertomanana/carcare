/**
 * «Misiones» de la portada del taller (mundo Diorama): lo que pide atención ahora, calculado solo con datos reales de la
 * API (órdenes abiertas, elevadores y el resumen del taller). Nada de puntos ni objetivos inventados (regla 2): cada
 * misión es una orden que va tarde, una entrega de hoy, coches listos o esperando, o alertas de flota.
 * Funciones puras, sin React.
 */
import type { Bay, WorkOrder, WorkshopDashboard } from '@/api/types'
import type { Tone } from '@/lib/status'
import { isFinalStatus } from './orderUtils'
import type { FloorFilter } from './floorFleet'

export type HomeMission =
  /** Una orden concreta: se elige en la maqueta y se abre su ficha. */
  | { kind: 'order'; key: string; tone: Tone; reason: 'mine' | 'late' | 'today'; order: WorkOrder }
  /** Un grupo de coches: aplica el filtro correspondiente a la lista de la flota. */
  | { kind: 'filter'; key: string; tone: Tone; filter: Extract<FloorFilter, 'ready' | 'waiting'>; count: number; freeBays: number }
  /** Alertas de flota (recordatorios de los vehículos): lleva a la agenda. */
  | { kind: 'alerts'; key: string; tone: Tone; count: number; overdue: number }

export interface HomeMissionsInput {
  /** Órdenes abiertas. undefined mientras cargan o si fallan: no se inventa nada. */
  orders: WorkOrder[] | undefined
  bays: Bay[]
  /** Resumen del taller (alertas de flota y entregas de hoy). undefined si no ha cargado. */
  dashboard: Pick<WorkshopDashboard, 'counts' | 'due_today' | 'fleet_alerts'> | null | undefined
  /** Id del usuario si es mecánico: «sus» órdenes van primero. */
  mechanicId?: number | null
}

const MAX_ORDERS = 3
const MAX_TODAY = 2

function promisedTime(o: WorkOrder): number {
  const t = o.promised_at ? new Date(o.promised_at).getTime() : Number.NaN
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t
}

/** Primero las que van tarde, luego las urgentes y por último las de entrega más cercana. */
function byUrgency(list: WorkOrder[]): WorkOrder[] {
  const rank = { urgent: 0, high: 1, normal: 2, low: 3 } as const
  return [...list].sort((a, b) => Number(b.is_late) - Number(a.is_late) || rank[a.priority] - rank[b.priority] || promisedTime(a) - promisedTime(b) || a.id - b.id)
}

export function homeMissions({ orders, bays, dashboard, mechanicId = null }: HomeMissionsInput): HomeMission[] {
  const out: HomeMission[] = []
  const open = orders?.filter((o) => !isFinalStatus(o.status))
  const shown = new Set<number>()
  const add = (order: WorkOrder, reason: 'mine' | 'late' | 'today') => {
    shown.add(order.id)
    out.push({ kind: 'order', key: `${reason}-${order.id}`, tone: order.is_late ? 'danger' : reason === 'today' ? 'warning' : 'info', reason, order })
  }

  if (open) {
    if (mechanicId !== null) byUrgency(open.filter((o) => o.assigned_to?.id === mechanicId)).slice(0, MAX_ORDERS).forEach((o) => add(o, 'mine'))
    byUrgency(open.filter((o) => o.is_late && !shown.has(o.id)))
      .slice(0, MAX_ORDERS)
      .forEach((o) => add(o, 'late'))
    const today = dashboard?.due_today ?? []
    byUrgency(today.filter((o) => !isFinalStatus(o.status) && !o.is_late && !shown.has(o.id)))
      .slice(0, MAX_TODAY)
      .forEach((o) => add(o, 'today'))

    const ready = open.filter((o) => o.status === 'ready').length
    if (ready > 0) out.push({ kind: 'filter', key: 'ready', tone: 'ok', filter: 'ready', count: ready, freeBays: 0 })
    const waiting = open.filter((o) => o.bay === null && o.status !== 'ready').length
    if (waiting > 0) out.push({ kind: 'filter', key: 'waiting', tone: bays.some((b) => !b.work_order) ? 'warning' : 'info', filter: 'waiting', count: waiting, freeBays: bays.filter((b) => !b.work_order).length })
  }

  const alerts = dashboard?.fleet_alerts.length ?? 0
  if (alerts > 0) {
    const overdue = dashboard?.counts.overdue_reminders ?? 0
    out.push({ kind: 'alerts', key: 'alerts', tone: overdue > 0 ? 'danger' : 'warning', count: alerts, overdue })
  }
  return out
}
