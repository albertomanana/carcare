/**
 * Cifras, filtros y orden de la «flota en el taller» (pantalla Taller 3D). Funciones puras, sin React.
 * Todo sale de `GET /workspaces/{ws}/bays` y de las órdenes abiertas (`status=open`): nada estimado ni inventado.
 */
import type { Bay, WorkOrder } from '@/api/types'
import { plural } from '@/lib/text'
import { baysSummary, isFinalStatus } from './orderUtils'

/** id del título de la lista de la flota (destino del foco al cerrar la ficha si no hay fila). */
export const FLEET_TITLE_ID = 'floor-fleet-title'

/** id del botón de una fila: al cerrar la ficha, el foco vuelve aquí. */
export function fleetRowId(orderId: number): string {
  return `floor-row-${orderId}`
}

/** Filtro de la tabla. Cada tarjeta de cifras activa uno; `all` es «En taller». */
export type FloorFilter = 'all' | 'bay' | 'waiting' | 'ready' | 'late'

export interface FloorCounts {
  /** Órdenes abiertas. null mientras no hay datos de órdenes (cargando o error). */
  open: number | null
  busyBays: number
  totalBays: number
  /** Sin elevador y sin estar listas. */
  waiting: number | null
  ready: number | null
  late: number | null
}

export function floorCounts(bays: Bay[], orders: WorkOrder[] | undefined): FloorCounts {
  const { total, busy } = baysSummary(bays)
  const open = orders?.filter((o) => !isFinalStatus(o.status))
  return {
    open: open ? open.length : null,
    busyBays: busy,
    totalBays: total,
    waiting: open ? open.filter((o) => matchesFilter(o, 'waiting')).length : null,
    ready: open ? open.filter((o) => matchesFilter(o, 'ready')).length : null,
    late: open ? open.filter((o) => matchesFilter(o, 'late')).length : null,
  }
}

export function matchesFilter(o: WorkOrder, filter: FloorFilter): boolean {
  if (isFinalStatus(o.status)) return false
  switch (filter) {
    case 'all':
      return true
    case 'bay':
      return o.bay !== null
    case 'waiting':
      return o.bay === null && o.status !== 'ready'
    case 'ready':
      return o.status === 'ready'
    case 'late':
      return o.is_late
  }
}

/** Filtro efectivo: «Con retraso» deja de existir si ya no hay ninguna tarde (la tarjeta se oculta). */
export function effectiveFilter(filter: FloorFilter, counts: FloorCounts): FloorFilter {
  if (filter === 'late' && !counts.late) return 'all'
  return filter
}

const PRIORITY_RANK: Record<WorkOrder['priority'], number> = { urgent: 0, high: 1, normal: 2, low: 3 }

/** Zona del taller en el mismo orden que la maqueta: elevadores, espera y listos para entregar. */
function zoneRank(o: WorkOrder): number {
  if (o.bay !== null) return 0
  return o.status === 'ready' ? 2 : 1
}

function promisedTime(o: WorkOrder): number {
  if (!o.promised_at) return Number.POSITIVE_INFINITY
  const t = new Date(o.promised_at).getTime()
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t
}

/**
 * Filas de la tabla: las del filtro, ordenadas como se recorre el taller (elevador 1, 2…; luego la espera, con las
 * que van tarde y las urgentes primero; al final las listas) y, a igualdad, por entrega prometida.
 */
export function fleetRows(orders: WorkOrder[], filter: FloorFilter): WorkOrder[] {
  return orders
    .filter((o) => matchesFilter(o, filter))
    .sort(
      (a, b) =>
        zoneRank(a) - zoneRank(b) ||
        (a.bay ?? 0) - (b.bay ?? 0) ||
        Number(b.is_late) - Number(a.is_late) ||
        PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
        promisedTime(a) - promisedTime(b) ||
        a.id - b.id,
    )
}

export const FILTER_LABEL: Record<FloorFilter, string> = {
  all: 'En taller',
  bay: 'En elevador',
  waiting: 'Esperando',
  ready: 'Listos para entregar',
  late: 'Con retraso',
}

/** Qué enseña la tabla con cada filtro, junto al título «Coches en el taller» (sin repetirlo). */
export function filterCaption(filter: FloorFilter, rows: number): string {
  const n = plural(rows, 'coche', 'coches')
  switch (filter) {
    case 'all':
      return n
    case 'bay':
      return `${n} en elevador`
    case 'waiting':
      return `${n} esperando`
    case 'ready':
      return `${n} ${rows === 1 ? 'listo' : 'listos'} para entregar`
    case 'late':
      return `${n} con retraso`
  }
}

/**
 * Resumen hablado del taller (cabecera, `aria-live`): «5 coches en el taller · 3 de 4 elevadores ocupados ·
 * 1 listo para entregar · 2 con retraso». Sin órdenes cargadas, solo los elevadores.
 */
export function fleetSummary(c: FloorCounts): string {
  const parts: string[] = []
  if (c.open !== null) parts.push(`${plural(c.open, 'coche', 'coches')} en el taller`)
  parts.push(`${c.busyBays} de ${plural(c.totalBays, 'elevador', 'elevadores')} ${c.busyBays === 1 ? 'ocupado' : 'ocupados'}`)
  if (c.ready) parts.push(`${c.ready} ${c.ready === 1 ? 'listo' : 'listos'} para entregar`)
  if (c.late) parts.push(`${c.late} con retraso`)
  return parts.join(' · ')
}
