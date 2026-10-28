import { CalendarClock } from 'lucide-react'
import type { Priority, WorkOrder } from '@/api/types'
import { Badge, StatusPill } from '@/components/ui/Badge'
import { cn } from '@/lib/cn'
import { LATE, PRIORITY } from '@/lib/status'
import { formatWhen } from './orderUtils'

/**
 * Píldoras de la orden. Solo para lo que pide atención (R5): "Tarde" y "Urgente"; el estado, el elevador
 * y la prioridad normal van en texto.
 */

/** Prioridad con icono + texto. `quiet` oculta la prioridad normal (ruido en tarjetas). */
export function PriorityBadge({ priority, size = 'sm', quiet }: { priority: Priority; size?: 'sm' | 'md'; quiet?: boolean }) {
  if (quiet && priority === 'normal') return null
  const p = PRIORITY[priority]
  const Icon = p.icon
  return (
    <Badge tone={p.tone} size={size} icon={<Icon aria-hidden />}>
      <span className="sr-only">Prioridad </span>
      {p.label}
    </Badge>
  )
}

export function LateBadge({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  return <StatusPill status={LATE} size={size} />
}

/** Fecha prometida con aviso si va tarde. */
export function PromisedAt({ order, className }: { order: Pick<WorkOrder, 'promised_at' | 'is_late'>; className?: string }) {
  if (!order.promised_at) return null
  return (
    <span className={cn('inline-flex items-center gap-1 tabular', order.is_late ? 'text-danger' : 'text-fg-muted', className)}>
      <CalendarClock aria-hidden className="size-3.5 shrink-0" />
      <span className="sr-only">Prometida para </span>
      {formatWhen(order.promised_at)}
    </span>
  )
}
