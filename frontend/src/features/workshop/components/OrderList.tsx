import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import type { WorkOrder, WorkOrderStatus } from '@/api/types'
import { Avatar } from '@/components/ui/Avatar'
import { Plate } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { VehicleSwatch } from '@/components/vehicles/VehicleVisuals'
import { cn } from '@/lib/cn'
import { formatDate, formatMoney } from '@/lib/format'
import { CarThumbnail } from '@/three'
import { MoveToMenu } from './MoveToMenu'
import { BayBadge, LateBadge, OrderStatusPill, PriorityBadge, PromisedAt } from './OrderBadges'
import { formatWhen, isFinalStatus } from './orderUtils'

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
  showTotal?: boolean
}

/** Fila compacta enlazada (centro de control, ficha del vehículo, ficha del cliente, lista en móvil). */
export function OrderRow({ order, to, showVehicle = true, showCustomer = true, showTotal }: OrderRowProps) {
  const v = order.vehicle
  const sub = [showVehicle ? v.display_name : null, showVehicle ? v.plate : null, showCustomer ? order.customer?.name : null].filter(Boolean).join(' · ')
  return (
    <li>
      <Link
        to={to}
        className={cn(
          'group flex items-center gap-3 rounded-card border bg-surface p-3 transition-colors duration-150 hover:border-line-strong hover:bg-surface-2/60',
          order.is_late ? 'border-danger/40' : 'border-line',
        )}
      >
        {showVehicle && <CarThumbnail appearance={{ bodyType: v.body_type, colorHex: v.color_hex }} alt="" className="h-10 w-16 shrink-0" />}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[11px] font-medium tracking-wide text-fg-muted tabular">{order.number}</span>
            <OrderStatusPill status={order.status} size="sm" />
            {order.is_late && <LateBadge />}
            <PriorityBadge priority={order.priority} quiet />
            <BayBadge bay={order.bay} />
          </div>
          <p className="mt-1 truncate text-sm font-medium text-fg">{order.title}</p>
          {sub && <p className="truncate text-xs text-fg-muted">{sub}</p>}
          <p className="mt-1 text-xs sm:hidden">
            <KeyDate order={order} />
          </p>
        </div>
        <div className="hidden shrink-0 flex-col items-end gap-1 text-xs sm:flex">
          <KeyDate order={order} />
          {showTotal && <span className="text-sm font-medium text-fg tabular">{formatMoney(order.total)}</span>}
        </div>
        <ChevronRight aria-hidden className="size-4 shrink-0 text-fg-subtle transition-transform group-hover:translate-x-0.5" />
      </Link>
    </li>
  )
}

export function OrderRowSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div role="status" aria-live="polite" className="space-y-2">
      <span className="sr-only">Cargando órdenes…</span>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} aria-hidden className="flex items-center gap-3 rounded-card border border-line bg-surface p-3">
          <Skeleton className="h-10 w-16" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-4 w-3/4" />
          </div>
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
}

/** Vista de lista: tabla en escritorio, filas compactas en móvil. */
export function OrdersTable({ orders, orderHref, vehicleHref, onRequest, showTotal, caption }: OrdersTableProps) {
  return (
    <>
      <ul className="space-y-2 lg:hidden" aria-label={caption}>
        {orders.map((o) => (
          <OrderRow key={o.id} order={o} to={orderHref(o)} showTotal={showTotal} />
        ))}
      </ul>
      <div className="hidden overflow-hidden rounded-card border border-line bg-surface lg:block">
        <table className="w-full table-fixed text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="border-b border-line bg-surface-2/60 text-left text-xs font-medium text-fg-subtle">
            <tr>
              <th scope="col" className="w-[24%] px-4 py-3 font-medium">
                Orden
              </th>
              <th scope="col" className="w-[19%] px-3 py-3 font-medium">
                Vehículo
              </th>
              <th scope="col" className="w-[14%] px-3 py-3 font-medium">
                Cliente
              </th>
              <th scope="col" className="w-[14%] px-3 py-3 font-medium">
                Estado
              </th>
              <th scope="col" className="w-[13%] px-3 py-3 font-medium">
                Asignación
              </th>
              <th scope="col" className="w-[12%] px-3 py-3 font-medium">
                Fecha
              </th>
              {showTotal && (
                <th scope="col" className="w-[10%] px-3 py-3 text-right font-medium">
                  Total
                </th>
              )}
              <th scope="col" className="w-12 px-2 py-3">
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {orders.map((o) => (
              <tr key={o.id} className={cn('align-top transition-colors hover:bg-surface-2/50', o.is_late && 'bg-danger-soft/30')}>
                <td className="px-4 py-3">
                  <span className="block font-mono text-[11px] font-medium tracking-wide text-fg-muted tabular">{o.number}</span>
                  <Link to={orderHref(o)} className="line-clamp-2 font-medium text-fg hover:underline">
                    {o.title}
                  </Link>
                </td>
                <td className="px-3 py-3">
                  <Link to={vehicleHref(o)} className="flex min-w-0 items-center gap-2 hover:underline">
                    <VehicleSwatch vehicle={o.vehicle} size="sm" />
                    <span className="min-w-0">
                      <span className="block truncate text-fg">{o.vehicle.display_name}</span>
                      {o.vehicle.plate && <Plate value={o.vehicle.plate} className="mt-0.5 h-5 text-[10px]" />}
                    </span>
                  </Link>
                </td>
                <td className="truncate px-3 py-3 text-fg-muted">{o.customer?.name ?? <span className="text-fg-subtle">Sin cliente</span>}</td>
                <td className="px-3 py-3">
                  <div className="flex flex-col items-start gap-1">
                    <OrderStatusPill status={o.status} size="sm" />
                    {o.is_late && <LateBadge />}
                    <PriorityBadge priority={o.priority} quiet />
                  </div>
                </td>
                <td className="px-3 py-3 text-xs">
                  <div className="flex flex-col items-start gap-1">
                    <BayBadge bay={o.bay} />
                    {o.assigned_to ? (
                      <span className="inline-flex min-w-0 items-center gap-1.5 text-fg-muted">
                        <Avatar name={o.assigned_to.name} size="xs" className="size-5 text-[9px]" />
                        <span className="truncate">{o.assigned_to.name}</span>
                      </span>
                    ) : (
                      !isFinalStatus(o.status) && <span className="text-fg-subtle">Sin asignar</span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-3 text-xs">
                  <KeyDate order={o} />
                </td>
                {showTotal && <td className="px-3 py-3 text-right font-medium text-fg tabular">{formatMoney(o.total)}</td>}
                <td className="px-2 py-2 text-right">
                  <MoveToMenu order={o} onRequest={onRequest} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
