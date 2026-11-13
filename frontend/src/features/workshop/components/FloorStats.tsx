import type { CSSProperties } from 'react'
import { Car, Clock, Flag, type LucideIcon, TriangleAlert, Wrench } from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/cn'
import { FILTER_LABEL, type FloorCounts, type FloorFilter } from './floorFleet'

const ICON: Record<FloorFilter, LucideIcon> = { all: Car, bay: Wrench, waiting: Clock, ready: Flag, late: TriangleAlert }

/**
 * Cifras de la portada del taller (todas de la API: elevadores y órdenes abiertas). Cada una es una tarjeta flotante que
 * filtra la lista de la flota; pulsar la activa vuelve a «En taller». «Con retraso» solo aparece si hay alguna orden tarde.
 * La activa se ve por el relleno azul suave, el aro y la marca inferior (no solo por color) y lo dice `aria-pressed`.
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
      className={cn('scrollbar-none flex min-w-0 snap-x gap-2 overflow-x-auto overscroll-x-contain py-1 md:overflow-visible', !floating && '-mx-1 px-1', className)}
    >
      {cells.map((c) => {
        const active = filter === c.key
        // «En elevador» sale de los elevadores; el resto, de las órdenes (si fallan, se dice en la lista, no se pone 0).
        const fromOrders = c.key !== 'bay'
        const missing = fromOrders && ordersFailed
        const loading = !counts || (fromOrders && ordersPending)
        const late = c.key === 'late'
        const Icon = ICON[c.key]
        return (
          <button
            key={c.key}
            type="button"
            aria-pressed={active}
            disabled={missing}
            onClick={() => onFilter(active ? 'all' : c.key)}
            className={cn(
              'hud-panel pop-in relative flex min-h-[4.5rem] min-w-max flex-1 snap-start flex-col justify-between gap-1 px-3.5 py-2.5 text-left',
              'transition-[translate,box-shadow,background-color] duration-200 ease-out-soft disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.98] xl:min-h-[5.25rem] xl:px-4',
              'pointer-fine:hover:-translate-y-0.5',
              active && 'border-accent bg-accent-soft',
            )}
            style={{ '--i': cells.indexOf(c) } as CSSProperties}
          >
            <span aria-hidden className={cn('absolute inset-x-4 bottom-1.5 h-[3px] rounded-full bg-accent transition-opacity duration-150', active ? 'opacity-100' : 'opacity-0')} />
            <span className={cn('tag-label inline-flex items-center gap-1.5 whitespace-nowrap', late ? 'text-danger' : active ? 'text-accent-ink' : 'text-fg-muted')}>
              <Icon aria-hidden className="size-3.5 shrink-0" />
              {FILTER_LABEL[c.key]}
            </span>
            <span className="flex items-baseline gap-1.5 pb-1">
              {loading && !missing ? (
                <Skeleton className="h-8 w-12" />
              ) : missing || c.value === null ? (
                <>
                  <span aria-hidden className="font-display text-xl font-bold text-fg-subtle">
                    —
                  </span>
                  <span className="sr-only">sin datos</span>
                </>
              ) : (
                <>
                  <span className={cn('tabular whitespace-nowrap text-[1.75rem] font-bold leading-8', late ? 'text-danger' : 'text-fg-warm')}>{c.value}</span>
                  {c.total !== undefined && (
                    <span className="whitespace-nowrap text-sm text-fg-muted">
                      de <span className="tabular">{c.total}</span>
                    </span>
                  )}
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
