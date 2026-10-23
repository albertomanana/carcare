import { GripVertical, UserRound } from 'lucide-react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { Link } from 'react-router'
import type { WorkOrder, WorkOrderStatus } from '@/api/types'
import { Avatar } from '@/components/ui/Avatar'
import { Plate } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/cn'
import { CarThumbnail } from '@/three'
import { MoveToMenu } from './MoveToMenu'
import { BayBadge, LateBadge, PriorityBadge, PromisedAt } from './OrderBadges'

export interface OrderCardProps {
  order: WorkOrder
  to: string
  onRequest: (order: WorkOrder, status: WorkOrderStatus) => void
  busy?: boolean
  /** La tarjeta original mientras se arrastra (queda atenuada). */
  dragging?: boolean
  /** Copia que sigue al puntero. */
  ghost?: boolean
  onPointerDown?: (e: ReactPointerEvent<HTMLElement>) => void
}

/**
 * Tarjeta del tablero: toda la tarjeta abre la orden (enlace extendido) y el botón «Mover a…» queda por encima.
 * Con ratón se arrastra desde cualquier punto; en pantallas táctiles, desde el asa (para no bloquear el scroll).
 */
export function OrderCard({ order, to, onRequest, busy, dragging, ghost, onPointerDown }: OrderCardProps) {
  const v = order.vehicle
  return (
    <article
      onPointerDown={onPointerDown}
      onDragStart={(e) => e.preventDefault()}
      aria-busy={busy || undefined}
      className={cn(
        'group relative flex select-none flex-col gap-2 rounded-card border bg-surface p-3 transition-[border-color,box-shadow,opacity] duration-150 ease-out-soft',
        'hover:border-line-strong has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-accent pointer-fine:cursor-grab',
        order.is_late ? 'border-danger/45' : 'border-line',
        dragging && 'opacity-40',
        ghost && 'cursor-grabbing border-accent/60 shadow-2xl shadow-black/40 motion-safe:rotate-[1.5deg]',
      )}
    >
      <div className="flex min-h-7 items-center gap-1.5">
        <span
          data-drag-handle
          aria-hidden
          className="-ml-1.5 hidden size-8 shrink-0 touch-none place-items-center rounded-control text-fg-subtle pointer-coarse:grid"
        >
          <GripVertical className="size-4" />
        </span>
        <span className="font-mono text-[11px] font-medium tracking-wide text-fg-muted tabular">{order.number}</span>
        {busy && <Spinner className="size-3.5 text-fg-subtle" label="Guardando…" />}
        <div className="relative z-10 ml-auto -mr-1.5 -mt-1">
          <MoveToMenu order={order} onRequest={onRequest} />
        </div>
      </div>

      <h3 className="line-clamp-2 text-sm font-medium leading-snug text-fg">
        <Link to={to} draggable={false} className="outline-none after:absolute after:inset-0 after:rounded-card after:content-['']">
          {order.title}
        </Link>
      </h3>

      <div className="flex min-w-0 items-center gap-2">
        <CarThumbnail appearance={{ bodyType: v.body_type, colorHex: v.color_hex }} alt="" className="h-8 w-12 shrink-0" />
        <div className="min-w-0">
          <p className="truncate text-xs text-fg">{v.display_name}</p>
          {v.plate && <Plate value={v.plate} className="mt-0.5 h-5 text-[10px]" />}
        </div>
      </div>

      {order.customer && (
        <p className="flex min-w-0 items-center gap-1.5 text-xs text-fg-muted">
          <UserRound aria-hidden className="size-3.5 shrink-0 text-fg-subtle" />
          <span className="sr-only">Cliente: </span>
          <span className="truncate">{order.customer.name}</span>
        </p>
      )}

      {(order.is_late || order.priority !== 'normal' || order.bay !== null) && (
        <div className="flex flex-wrap gap-1">
          {order.is_late && <LateBadge />}
          <PriorityBadge priority={order.priority} quiet />
          <BayBadge bay={order.bay} />
        </div>
      )}

      {(order.assigned_to || order.promised_at) && (
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-1 border-t border-line pt-2 text-[11px]">
          {order.assigned_to ? (
            <span className="inline-flex min-w-0 items-center gap-1.5 text-fg-muted">
              <Avatar name={order.assigned_to.name} size="xs" className="size-5 text-[9px]" />
              <span className="sr-only">Mecánico: </span>
              <span className="truncate">{order.assigned_to.name.split(' ')[0]}</span>
            </span>
          ) : (
            <span className="text-fg-subtle">Sin asignar</span>
          )}
          <PromisedAt order={order} />
        </div>
      )}
    </article>
  )
}
