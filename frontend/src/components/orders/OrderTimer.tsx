/**
 * Cronómetro en vivo de una orden de trabajo (contrato §3.11.1). Tiene su propio intervalo de 1 s, así que solo se
 * repinta este trozo. En reparación compara el tiempo acumulado con lo estimado y dibuja el avance; en los demás
 * estados cuenta el tiempo en el estado. Va con `aria-hidden`: quien lo usa lo dice con palabras (`timingSentence`),
 * para que un lector de pantalla no lo lea cada segundo.
 */
import type { WorkOrder } from '@/api/types'
import { cn } from '@/lib/cn'
import { formatClock, formatDuration, orderTiming, useNow } from '@/lib/orderTiming'

export function LiveTimer({
  order,
  bar = true,
  short = false,
  size = 'sm',
  className,
}: {
  order: Pick<WorkOrder, 'status' | 'status_changed_at' | 'repair_seconds' | 'estimated_minutes'>
  /** Barra de avance (solo en reparación y con tiempo estimado). */
  bar?: boolean
  /** Solo el reloj, sin la comparación. */
  short?: boolean
  size?: 'sm' | 'lg'
  className?: string
}) {
  const now = useNow(1000)
  const t = orderTiming(order, now)
  const seconds = t.repairSeconds ?? t.stateSeconds
  const over = t.overSeconds > 0
  return (
    <span aria-hidden className={cn('flex min-w-0 flex-col gap-1', className)}>
      <span className="flex items-baseline justify-between gap-3 whitespace-nowrap">
        <span className={cn('tabular font-semibold', size === 'lg' ? 'text-2xl' : short ? 'text-xs' : 'text-sm', over ? 'text-danger' : 'text-fg')}>{formatClock(seconds)}</span>
        {!short && (
          <span className={cn('text-fg-muted', size === 'lg' ? 'text-sm' : 'text-[11px]')}>
            {t.repairSeconds == null ? (
              'en este estado'
            ) : t.estimateSeconds == null ? (
              'sin estimación'
            ) : over ? (
              <span className="text-danger">
                +<span className="tabular">{formatDuration(t.overSeconds)}</span>
              </span>
            ) : (
              <>
                de <span className="tabular">{formatDuration(t.estimateSeconds)}</span>
              </>
            )}
          </span>
        )}
      </span>
      {bar && t.progress != null && (
        <span className={cn('block overflow-hidden rounded-full bg-fg/15', size === 'lg' ? 'h-1.5' : 'h-1')}>
          <span
            className={cn('block h-full rounded-full transition-[width] duration-1000 ease-linear motion-reduce:transition-none', over ? 'bg-danger' : 'bg-accent')}
            style={{ width: `${Math.max(3, t.progress * 100)}%` }}
          />
        </span>
      )}
    </span>
  )
}
