import { Ban, Check } from 'lucide-react'
import type { WorkOrder, WorkOrderStatus } from '@/api/types'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/cn'
import { formatDateTime } from '@/lib/format'
import { WORK_ORDER_STATUS } from '@/lib/status'
import { isFinalStatus, ORDER_FLOW, stepStates } from './orderUtils'

/** Etiquetas cortas para pantallas estrechas (360 px). */
const SHORT_LABEL: Record<WorkOrderStatus, string> = {
  received: 'Recibido',
  diagnosing: 'Diagnóstico',
  waiting_parts: 'Piezas',
  in_progress: 'Reparación',
  ready: 'Listo',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
}

export interface StatusStepperProps {
  order: WorkOrder
  /** Si se pasa, cada paso es un botón que pide el cambio (entregar pasa por confirmación). */
  onRequest?: (status: WorkOrderStatus) => void
  busy?: boolean
  className?: string
}

/** Progreso de la orden por su flujo de trabajo; cada paso se puede pulsar para moverla. */
export function StatusStepper({ order, onRequest, busy, className }: StatusStepperProps) {
  if (order.status === 'cancelled') {
    return (
      <div role="status" className={cn('flex items-start gap-3 rounded-card border border-line bg-surface-2/60 px-4 py-3', className)}>
        <Ban aria-hidden className="mt-0.5 size-5 shrink-0 text-fg-muted" />
        <div className="text-sm">
          <p className="font-medium text-fg">Orden cancelada</p>
          <p className="text-fg-muted">Queda en solo lectura y no se ha añadido nada al historial del vehículo.</p>
        </div>
      </div>
    )
  }

  const states = stepStates(order.status)
  const interactive = !!onRequest && !isFinalStatus(order.status)

  return (
    <nav aria-label={`Estado de ${order.number}`} className={className}>
      <ol className="grid grid-cols-6 gap-1 sm:gap-2">
        {ORDER_FLOW.map((s, i) => {
          const st = WORK_ORDER_STATUS[s]
          const Icon = st.icon
          const state = states[s]
          const current = state === 'current'
          const when = s === 'delivered' ? order.delivered_at : s === 'ready' ? order.completed_at : s === 'received' ? order.received_at : null
          const content = (
            <>
              <span
                aria-hidden
                className={cn(
                  'h-1 w-full rounded-full transition-colors duration-200',
                  state === 'done' || current ? 'bg-accent' : state === 'optional' ? 'bg-[repeating-linear-gradient(90deg,var(--line-strong)_0_4px,transparent_4px_8px)]' : 'bg-surface-3',
                )}
              />
              <span className="flex flex-col items-center gap-1 sm:flex-row sm:items-center sm:gap-2">
                <span
                  aria-hidden
                  className={cn(
                    'grid size-7 shrink-0 place-items-center rounded-full border [&_svg]:size-3.5',
                    current
                      ? 'border-accent bg-accent text-on-accent'
                      : state === 'done'
                        ? 'border-accent/50 bg-accent-soft text-accent-ink'
                        : state === 'optional'
                          ? 'border-dashed border-line-strong text-fg-subtle'
                          : 'border-line bg-surface text-fg-subtle group-hover:border-line-strong group-hover:text-fg-muted',
                  )}
                >
                  {current && busy ? <Spinner className="size-3.5" /> : state === 'done' ? <Check strokeWidth={3} /> : <Icon />}
                </span>
                <span className="min-w-0 text-center sm:text-left">
                  <span className={cn('block text-[11px] leading-tight sm:text-xs', current ? 'font-semibold text-fg' : state === 'done' ? 'text-fg-muted' : 'text-fg-subtle')}>
                    <span className="sm:hidden">{SHORT_LABEL[s]}</span>
                    <span className="hidden sm:inline">{st.label}</span>
                    {state === 'optional' && <span className="sr-only"> (paso opcional)</span>}
                    {state === 'done' && <span className="sr-only"> (superado)</span>}
                    {current && <span className="sr-only"> (estado actual)</span>}
                  </span>
                  {when && (state === 'done' || current) && (
                    <span className="hidden text-[11px] text-fg-subtle tabular lg:block">{formatDateTime(when)}</span>
                  )}
                  {s === 'waiting_parts' && <span className="hidden text-[11px] text-fg-subtle lg:block">Opcional</span>}
                </span>
              </span>
            </>
          )
          return (
            <li key={s} className="min-w-0">
              {interactive && !current ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onRequest?.(s)}
                  aria-label={s === 'delivered' ? `Entregar ${order.number} al cliente` : `Mover ${order.number} a «${st.label}»`}
                  className="group flex w-full min-w-0 flex-col gap-2 rounded-control pb-1 text-left transition-colors disabled:cursor-wait"
                >
                  {content}
                </button>
              ) : (
                <div aria-current={current ? 'step' : undefined} className="flex w-full min-w-0 flex-col gap-2 pb-1" title={i === 2 ? 'Paso opcional' : undefined}>
                  {content}
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
