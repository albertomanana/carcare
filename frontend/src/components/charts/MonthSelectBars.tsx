/**
 * Barras por mes en las que cada mes es un botón: se pulsa (o se elige con el teclado) para ver su detalle.
 * Una sola serie, así que no hay leyenda: el mes elegido va en el acento y los demás en gris; el importe del mes elegido
 * se rotula encima de su barra y el de los demás aparece al pasar el puntero o al enfocar. El nombre accesible de cada
 * botón lleva el mes y el importe; quien usa la gráfica aporta además la tabla.
 */
import type { Money, YearMonth } from '@/api/types'
import { niceMax } from '@/lib/analytics'
import { cn } from '@/lib/cn'
import { formatMoney, formatMonth, toNumber } from '@/lib/format'

export function MonthSelectBars({
  data,
  selected,
  onSelect,
  label,
  height = 200,
  className,
}: {
  data: { month: YearMonth; total: Money }[]
  selected: YearMonth | null
  /** Pulsar el mes ya elegido lo suelta (`null`). */
  onSelect: (month: YearMonth | null) => void
  label: string
  height?: number
  className?: string
}) {
  const rows = data.map((d) => ({ month: d.month, value: toNumber(d.total) ?? 0, total: d.total }))
  const top = niceMax(Math.max(0, ...rows.map((r) => r.value)))
  const ticks = [top, top / 2, 0]
  return (
    <div className={cn('flex min-w-0 gap-2', className)}>
      {/* eje: tres marcas, en gris, sin protagonismo */}
      <div aria-hidden className="tabular flex w-12 shrink-0 flex-col justify-between pb-6 text-right text-[11px] leading-none text-fg-subtle" style={{ height }}>
        {ticks.map((t) => (
          <span key={t}>{formatMoney(t, { round: true, compact: true })}</span>
        ))}
      </div>
      <div className="relative min-w-0 flex-1" style={{ height }}>
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-6 top-0 flex flex-col justify-between">
          {ticks.map((t) => (
            <span key={t} className={cn('block border-t', t === 0 ? 'border-line-strong' : 'border-dashed border-line')} />
          ))}
        </div>
        <div role="group" aria-label={label} className="relative flex h-full items-stretch gap-0.5">
          {rows.map((r, i) => {
            const on = r.month === selected
            const pct = top > 0 ? (r.value / top) * 100 : 0
            // el año se rotula en enero y en el primer mes, para saber dónde se está en periodos de más de un año
            const showYear = i === 0 || r.month.endsWith('-01')
            return (
              <button
                key={r.month}
                type="button"
                aria-pressed={on}
                aria-label={`${formatMonth(r.month, 'long')}: ${formatMoney(r.total)}`}
                onClick={() => onSelect(on ? null : r.month)}
                className="group relative flex min-w-0 flex-1 cursor-pointer flex-col rounded-control outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-ink"
              >
                <span className="relative flex min-h-0 flex-1 items-end justify-center">
                  <span
                    className={cn(
                      'relative block w-full max-w-9 rounded-t-[4px] transition-colors duration-150',
                      on ? 'bg-accent' : 'bg-fg-subtle/45 group-hover:bg-fg-subtle/80 group-focus-visible:bg-fg-subtle/80',
                    )}
                    style={{ height: r.value > 0 ? `max(3px, ${pct}%)` : 0 }}
                  >
                    <span
                      className={cn(
                        'tabular pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-semibold',
                        on ? 'bg-surface text-fg shadow-sm ring-1 ring-line' : 'bg-surface text-fg opacity-0 shadow-sm ring-1 ring-line group-hover:opacity-100 group-focus-visible:opacity-100',
                      )}
                    >
                      {formatMoney(r.total)}
                    </span>
                  </span>
                  {r.value <= 0 && (
                    <span className="tabular pointer-events-none absolute bottom-1 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-surface px-1.5 py-0.5 text-[11px] font-semibold text-fg opacity-0 shadow-sm ring-1 ring-line group-hover:opacity-100 group-focus-visible:opacity-100">
                      {formatMoney(r.total)}
                    </span>
                  )}
                </span>
                <span className={cn('flex h-6 shrink-0 items-end justify-center truncate text-[11px] leading-none', on ? 'font-semibold text-fg' : 'text-fg-subtle group-hover:text-fg')}>
                  {formatMonth(r.month, showYear && rows.length > 12 ? 'shortYear' : 'short')}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
