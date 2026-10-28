import { ChevronRight } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router'
import type { WorkOrder, WorkOrderStatus } from '@/api/types'
import { Plate } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { formatDate, formatMoney, formatPlate } from '@/lib/format'
import { WORK_ORDER_STATUS_LABEL } from '@/lib/labels'
import { MoveToMenu } from './MoveToMenu'
import { LateBadge, PriorityBadge, PromisedAt } from './OrderBadges'
import { formatWhen, isFinalStatus, KANBAN_STATUSES } from './orderUtils'

/** Fecha más relevante según el estado: entrega, prometida o recepción. */
function KeyDate({ order }: { order: WorkOrder }) {
  if (order.status === 'delivered') return <span className="text-fg-muted tabular">Entregada {formatDate(order.delivered_at)}</span>
  if (order.status === 'cancelled') return <span className="text-fg-subtle tabular">Recibida {formatDate(order.received_at)}</span>
  if (order.promised_at) return <PromisedAt order={order} />
  return <span className="text-fg-subtle tabular">Recibida {formatWhen(order.received_at)}</span>
}

export interface OrderRowProps {
  order: WorkOrder
  to: string
  showVehicle?: boolean
  showCustomer?: boolean
  /** false dentro de un grupo por estado (el estado ya está en su título). */
  showStatus?: boolean
  showTotal?: boolean
}

/** Fila enlazada sin caja (centro de control, ficha del vehículo, ficha del cliente, lista en móvil).
 *  Píldora solo para "Tarde" y "Urgente" (R5); el estado y lo demás, en texto. Sin miniatura 3D (R11).
 *  El separador va en la fila: la lista que la contiene pone `border-t border-line`. */
export function OrderRow({ order, to, showVehicle = true, showCustomer = true, showStatus = true, showTotal }: OrderRowProps) {
  const v = order.vehicle
  const sub = [
    order.number,
    showStatus ? WORK_ORDER_STATUS_LABEL[order.status] : null,
    showVehicle ? [v.display_name, v.plate ? formatPlate(v.plate) : null].filter(Boolean).join(' ') : null,
    showCustomer ? order.customer?.name : null,
    order.bay !== null && !isFinalStatus(order.status) ? `Elevador ${order.bay}` : null,
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <li className="border-b border-line">
      <Link to={to} className="group flex items-center gap-3 px-1 py-2.5 transition-colors duration-150 hover:bg-surface-2/60">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span className="min-w-0 truncate text-sm font-medium text-fg">{order.title}</span>
            {order.is_late && <LateBadge />}
            {order.priority === 'urgent' && <PriorityBadge priority="urgent" />}
          </div>
          <p className="mt-0.5 truncate text-xs text-fg-muted">
            <span className="tabular">{sub}</span>
          </p>
          <p className="mt-0.5 text-xs sm:hidden">
            <KeyDate order={order} />
          </p>
        </div>
        <div className="hidden shrink-0 flex-col items-end gap-0.5 text-xs sm:flex">
          <KeyDate order={order} />
          {showTotal && <span className="text-sm text-fg tabular">{formatMoney(order.total)}</span>}
        </div>
        <ChevronRight aria-hidden className="size-4 shrink-0 text-fg-subtle transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
      </Link>
    </li>
  )
}

export function OrderRowSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div role="status" aria-live="polite" className="border-t border-line">
      <span className="sr-only">Cargando órdenes…</span>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} aria-hidden className="space-y-2 border-b border-line px-1 py-3">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-48" />
        </div>
      ))}
    </div>
  )
}

export interface OrdersTableProps {
  orders: WorkOrder[]
  orderHref: (order: WorkOrder) => string
  vehicleHref: (order: WorkOrder) => string
  onRequest: (order: WorkOrder, status: WorkOrderStatus) => void
  showTotal?: boolean
  caption: string
  /**
   * En móvil, agrupa las filas por estado en secciones plegables (plan UX 5.4). Solo tiene sentido con todas las
   * órdenes abiertas cargadas: si quedan páginas, los recuentos de cada grupo serían parciales.
   */
  groupByStatus?: boolean
}

/** Vista de lista: tabla sin caja en escritorio (R3/R4), filas en móvil. Píldora solo para "Tarde" y "Urgente" (R5). */
export function OrdersTable({ orders, orderHref, vehicleHref, onRequest, showTotal, caption, groupByStatus }: OrdersTableProps) {
  return (
    <>
      {groupByStatus ? (
        <GroupedOrderRows orders={orders} orderHref={orderHref} showTotal={showTotal} className="lg:hidden" />
      ) : (
        <ul className="border-t border-line lg:hidden" aria-label={caption}>
          {orders.map((o) => (
            <OrderRow key={o.id} order={o} to={orderHref(o)} showTotal={showTotal} />
          ))}
        </ul>
      )}
      <table className="hidden w-full table-fixed border-y border-line text-sm lg:table">
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b border-line text-left text-xs text-fg-muted">
          <tr>
            <th scope="col" className="w-[6.5rem] py-2.5 pr-3 font-medium">
              Nº
            </th>
            <th scope="col" className="py-2.5 pr-3 font-medium">
              Trabajo
            </th>
            <th scope="col" className="w-[19%] py-2.5 pr-3 font-medium">
              Vehículo
            </th>
            <th scope="col" className="w-[13%] py-2.5 pr-3 font-medium">
              Cliente
            </th>
            <th scope="col" className="w-[11%] py-2.5 pr-3 font-medium">
              Estado
            </th>
            <th scope="col" className="w-[11%] py-2.5 pr-3 font-medium">
              Mecánico
            </th>
            <th scope="col" className="w-[10rem] py-2.5 pr-3 font-medium">
              Fecha
            </th>
            {showTotal && (
              <th scope="col" className="w-[7rem] py-2.5 pr-3 text-right font-medium">
                Total
              </th>
            )}
            <th scope="col" className="w-11 py-2.5">
              <span className="sr-only">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {orders.map((o) => (
            <tr key={o.id} className="align-top transition-colors hover:bg-surface-2/50">
              <td className="py-2.5 pr-3 text-fg-muted tabular">{o.number}</td>
              <td className="py-2.5 pr-3">
                <Link to={orderHref(o)} className="line-clamp-2 font-medium text-fg hover:underline">
                  {o.title}
                </Link>
                {(o.is_late || o.priority === 'urgent') && (
                  <span className="mt-1 flex flex-wrap gap-1">
                    {o.is_late && <LateBadge />}
                    {o.priority === 'urgent' && <PriorityBadge priority="urgent" />}
                  </span>
                )}
              </td>
              <td className="py-2.5 pr-3">
                <Link to={vehicleHref(o)} className="block min-w-0 hover:underline">
                  <span className="block truncate text-fg">{o.vehicle.display_name}</span>
                  {o.vehicle.plate && <Plate value={o.vehicle.plate} className="block truncate text-xs" />}
                </Link>
              </td>
              <td className="truncate py-2.5 pr-3 text-fg-muted">{o.customer?.name ?? <span className="text-fg-subtle">Sin cliente</span>}</td>
              <td className="py-2.5 pr-3 text-fg">
                {WORK_ORDER_STATUS_LABEL[o.status]}
                {o.bay !== null && !isFinalStatus(o.status) && <span className="block text-xs text-fg-muted">Elevador {o.bay}</span>}
              </td>
              <td className="truncate py-2.5 pr-3 text-fg-muted">
                {o.assigned_to ? o.assigned_to.name : !isFinalStatus(o.status) && <span className="text-fg-subtle">Sin asignar</span>}
              </td>
              <td className="py-2.5 pr-3 text-xs">
                <KeyDate order={o} />
              </td>
              {showTotal && <td className="py-2.5 pr-3 text-right text-fg tabular">{formatMoney(o.total)}</td>}
              <td className="py-1.5 text-right">
                <MoveToMenu order={o} onRequest={onRequest} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

/** Órdenes abiertas agrupadas por estado, en el orden del flujo, con `<details>` nativo (teclado y lector sin JS). */
function GroupedOrderRows({ orders, orderHref, showTotal, className }: { orders: WorkOrder[]; orderHref: (o: WorkOrder) => string; showTotal?: boolean; className?: string }) {
  const groups = useMemo(
    () => KANBAN_STATUSES.map((s) => [s, orders.filter((o) => o.status === s)] as const).filter(([, list]) => list.length > 0),
    [orders],
  )
  return (
    <div className={className}>
      {groups.map(([status, list]) => {
        const label = WORK_ORDER_STATUS_LABEL[status]
        return (
          <details key={status} open className="group">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 border-b border-line px-1 text-sm font-semibold text-fg [&::-webkit-details-marker]:hidden">
              <ChevronRight aria-hidden className="size-4 shrink-0 text-fg-muted transition-transform duration-150 group-open:rotate-90 motion-reduce:transition-none" />
              {label}
              <span className="font-normal text-fg-muted tabular">
                <span className="sr-only">: </span>
                {list.length}
                <span className="sr-only">{list.length === 1 ? ' orden' : ' órdenes'}</span>
              </span>
            </summary>
            <ul aria-label={label}>
              {list.map((o) => (
                <OrderRow key={o.id} order={o} to={orderHref(o)} showStatus={false} showTotal={showTotal} />
              ))}
            </ul>
          </details>
        )
      })}
    </div>
  )
}
