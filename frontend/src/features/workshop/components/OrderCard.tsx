import { GripVertical } from 'lucide-react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { Link } from 'react-router'
import type { WorkOrder, WorkOrderStatus } from '@/api/types'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/cn'
import { formatPlate } from '@/lib/format'
import { MoveToMenu } from './MoveToMenu'
import { LateBadge, PriorityBadge } from './OrderBadges'
import { formatWhenInline, shortOrderNumber } from './orderUtils'

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
 * Tarjeta del tablero (plan UX 5.4): título, vehículo · matrícula en texto y una línea con "Tarde"/"Urgente"
 * (solo si aplica), mecánico, fecha prometida y el número corto. Sin miniatura 3D (R11), sin placa (R6),
 * sin cliente (está en el detalle) y sin prioridad "Baja"/"Alta" (R5).
 * Toda la tarjeta abre la orden (enlace extendido) y el botón «Mover a…» queda por encima.
 * Con ratón se arrastra desde cualquier punto; en pantallas táctiles, desde el asa (para no bloquear el scroll).
 */
export function OrderCard({ order, to, onRequest, busy, dragging, ghost, onPointerDown }: OrderCardProps) {
  const v = order.vehicle
  const vehicle = [v.display_name, v.plate ? formatPlate(v.plate) : null].filter(Boolean).join(' · ')
  return (
    <article
      onPointerDown={onPointerDown}
      onDragStart={(e) => e.preventDefault()}
      aria-busy={busy || undefined}
      className={cn(
        'group relative flex select-none flex-col gap-1 rounded-card border bg-surface px-3 py-2.5 transition-[border-color,opacity] duration-150 ease-out-soft motion-reduce:transition-none',
        'hover:border-line-strong has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-accent pointer-fine:cursor-grab',
        order.is_late ? 'border-danger/45' : 'border-line',
        dragging && 'opacity-40',
        ghost && 'cursor-grabbing border-accent shadow-lg',
      )}
    >
      <div className="flex items-start gap-1">
        <h3 className="line-clamp-2 min-w-0 flex-1 text-sm font-medium leading-snug text-fg">
          <Link to={to} draggable={false} className="outline-none after:absolute after:inset-0 after:rounded-card after:content-['']">
            {order.title}
          </Link>
        </h3>
        <div className="relative z-10 -mr-1.5 -mt-1 shrink-0">
          <MoveToMenu order={order} onRequest={onRequest} />
        </div>
      </div>

      {vehicle && <p className="truncate text-xs text-fg-muted">{vehicle}</p>}

      <div className="flex min-w-0 items-center gap-1.5 text-xs text-fg-muted">
        <span
          data-drag-handle
          aria-hidden
          className="-ml-1.5 hidden size-7 shrink-0 touch-none place-items-center rounded-control text-fg-subtle pointer-coarse:grid"
        >
          <GripVertical className="size-4" />
        </span>
        {order.is_late && <LateBadge />}
        {order.priority === 'urgent' && <PriorityBadge priority="urgent" />}
        <span className="min-w-0 truncate">
          <span className="sr-only">Mecánico: </span>
          {order.assigned_to ? order.assigned_to.name.split(' ')[0] : 'Sin asignar'}
          {order.promised_at && (
            <>
              {' · '}
              <span className="sr-only">prometida para </span>
              <span className="tabular">{formatWhenInline(order.promised_at)}</span>
            </>
          )}
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-1 pl-1 text-fg-subtle tabular">
          {busy && <Spinner className="size-3.5" label="Guardando…" />}
          <span aria-hidden>{shortOrderNumber(order.number)}</span>
          <span className="sr-only">{order.number}</span>
        </span>
      </div>
    </article>
  )
}
