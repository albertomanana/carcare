import { TriangleAlert } from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/cn'
import { FILTER_LABEL, type FloorCounts, type FloorFilter } from './floorFleet'

/**
 * Cifras del Taller 3D (todas de la API: elevadores y órdenes abiertas). Cada celda es un botón que filtra la lista de
 * la flota; pulsar la activa vuelve a «En taller». «Con retraso» solo aparece si hay alguna orden tarde.
 */
export function FloorStats({
  counts,
  ordersPending,
  ordersFailed,
  filter,
  onFilter,
  floating,
  className,
}: {
  counts: FloorCounts | null
  ordersPending: boolean
  ordersFailed: boolean
  filter: FloorFilter
  onFilter: (f: FloorFilter) => void
  floating: boolean
  className?: string
}) {
  const cells: { key: FloorFilter; value: number | null; total?: number; hint: string }[] = [
    { key: 'all', value: counts?.open ?? null, hint: 'órdenes abiertas' },
    { key: 'bay', value: counts ? counts.busyBays : null, total: counts?.totalBays, hint: 'elevadores ocupados' },
    { key: 'waiting', value: counts?.waiting ?? null, hint: 'sin elevador y sin terminar' },
    { key: 'ready', value: counts?.ready ?? null, hint: 'esperan al cliente' },
  ]
  if (counts?.late) cells.push({ key: 'late', value: counts.late, hint: 'pasada la entrega prometida' })

  return (
    <div
      role="group"
      aria-label="Cifras del taller. Cada una filtra la lista de coches"
      className={cn(
        'flex min-w-0 snap-x overflow-x-auto overscroll-x-contain',
        floating ? 'floor-glass' : 'list-panel mb-0',
        '[&>*+*]:border-l [&>*+*]:border-line',
        className,
      )}
    >
      {cells.map((c) => {
        const active = filter === c.key
        // «En elevador» sale de los elevadores; el resto, de las órdenes (si fallan, se dice en la lista, no se pone 0).
        const fromOrders = c.key !== 'bay'
        const missing = fromOrders && ordersFailed
        const loading = !counts || (fromOrders && ordersPending)
        const late = c.key === 'late'
        return (
          <button
            key={c.key}
            type="button"
            aria-pressed={active}
            disabled={missing}
            onClick={() => onFilter(active ? 'all' : c.key)}
            className={cn(
              'relative flex min-h-[4.5rem] min-w-[7rem] flex-1 snap-start flex-col justify-between gap-1.5 px-3.5 py-3 text-left outline-offset-[-2px] xl:min-h-[5.25rem] xl:px-4',
              'transition-colors duration-150 ease-out-soft first:rounded-l-[15px] last:rounded-r-[15px] disabled:cursor-not-allowed',
              active ? 'bg-surface-3' : 'hover:bg-surface-2',
            )}
          >
            {/* Regla inferior de la celda activa: el filtro aplicado se ve sin depender del fondo (y lo dice aria-pressed). */}
            <span aria-hidden className={cn('absolute inset-x-3 bottom-0 h-[3px] rounded-t-full bg-fg-warm transition-opacity duration-150', active ? 'opacity-100' : 'opacity-0')} />
            <span className={cn('tag-label inline-flex items-start gap-1', late ? 'text-danger' : 'text-fg-muted')}>
              {late && <TriangleAlert aria-hidden className="mt-px size-3.5 shrink-0" />}
              {FILTER_LABEL[c.key]}
            </span>
            <span className="flex items-baseline justify-end gap-1">
              {loading && !missing ? (
                <Skeleton className="h-8 w-12" />
              ) : missing || c.value === null ? (
                <>
                  <span aria-hidden className="font-display text-xl font-semibold text-fg-subtle">
                    —
                  </span>
                  <span className="sr-only">sin datos</span>
                </>
              ) : (
                <>
                  <span className={cn('tabular whitespace-nowrap font-display text-[1.75rem] font-bold leading-8', late ? 'text-danger' : 'text-fg-warm')}>{c.value}</span>
                  {c.total !== undefined && <span className="tabular whitespace-nowrap text-sm text-fg-muted">de {c.total}</span>}
                </>
              )}
            </span>
            <span className="sr-only">
              {' '}
              {c.hint}
              {active ? '. Filtro aplicado' : ''}
            </span>
          </button>
        )
      })}
    </div>
  )
}
