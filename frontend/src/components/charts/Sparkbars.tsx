import type { Money, YearMonth } from '@/api/types'
import { cn } from '@/lib/cn'
import { formatMoney, formatMonth, toNumber } from '@/lib/format'

/**
 * 12 barras pequeñas sin ejes (Inicio, 5.1). HTML puro: no descarga Recharts.
 * Las barras son decorativas; la lista oculta da los mismos datos al lector de pantalla.
 * El último mes va en el color de los gráficos y los demás en gris (tokens).
 */
export function Sparkbars({ data, label, className }: { data: { month: YearMonth; total: Money }[]; label: string; className?: string }) {
  const values = data.map((d) => toNumber(d.total) ?? 0)
  const max = Math.max(...values, 0)
  return (
    <figure className={cn('min-w-0', className)}>
      <div aria-hidden className="flex h-12 items-end gap-1">
        {data.map((d, i) => {
          const pct = max > 0 ? Math.max(4, Math.round((values[i] / max) * 100)) : 4
          const last = i === data.length - 1
          return (
            <span
              key={d.month}
              title={`${formatMonth(d.month, 'long')}: ${formatMoney(d.total)}`}
              className={cn('min-w-0 flex-1 rounded-t-[2px]', last ? 'bg-chart-1' : 'bg-fg-subtle/50')}
              style={{ height: `${pct}%` }}
            />
          )
        })}
      </div>
      <figcaption className="sr-only">
        {label}:{' '}
        {data.map((d) => `${formatMonth(d.month, 'long')} ${formatMoney(d.total)}`).join('; ')}
      </figcaption>
    </figure>
  )
}
