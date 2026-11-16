import { Banknote, Hourglass } from 'lucide-react'
import type { WorkOrder } from '@/api/types'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/cn'
import { formatMoney, formatNumber } from '@/lib/format'
import { useNow } from '@/lib/orderTiming'
import { floorKpis } from './floorFleet'

/**
 * Indicadores del taller junto a las cifras (no filtran): días medios en el taller de las órdenes abiertas y, solo para
 * quien ve importes (owner y manager), lo que suman las órdenes listas para entregar. Salen de las órdenes abiertas
 * que ya tiene la página; no hay OEE ni productividad porque no hay fichajes ni horas trabajadas.
 */
export function FloorKpis({ orders, loading, failed, canSeeMoney, className }: { orders: WorkOrder[]; loading: boolean; failed: boolean; canSeeMoney: boolean; className?: string }) {
  // Se recalcula cada minuto (los días en el taller avanzan solos)
  const now = useNow(60_000)
  const k = floorKpis(orders, now)
  const cells: { key: string; icon: typeof Hourglass; label: string; value: string | null; hint: string }[] = [
    {
      key: 'age',
      icon: Hourglass,
      label: 'Días en taller',
      value: k.avgDaysOpen == null ? null : formatNumber(k.avgDaysOpen, 1),
      hint: k.avgDaysOpen == null ? 'Sin órdenes abiertas' : 'media de las abiertas, desde la recepción',
    },
  ]
  if (canSeeMoney)
    cells.push({
      key: 'ready',
      icon: Banknote,
      label: 'Listo para cobrar',
      value: formatMoney(k.readyCents / 100, { round: true }),
      hint: k.readyCount ? `${k.readyCount} ${k.readyCount === 1 ? 'orden lista' : 'órdenes listas'} para entregar, con IVA` : 'ninguna orden lista para entregar',
    })
  return (
    <div role="group" aria-label="Indicadores del taller" className={cn('flex min-w-0 gap-2 py-1', className)}>
      {cells.map((c) => {
        const Icon = c.icon
        return (
          <div key={c.key} className="hud-panel flex min-h-[4.5rem] min-w-max flex-col justify-between gap-1 px-3.5 py-2.5 xl:min-h-[5.25rem] xl:px-4">
            <span className="tag-label inline-flex items-center gap-1.5 whitespace-nowrap text-fg-muted">
              <Icon aria-hidden className="size-3.5 shrink-0" />
              {c.label}
            </span>
            {loading ? (
              <Skeleton className="h-8 w-14" />
            ) : failed || c.value == null ? (
              <span className="text-sm text-fg-subtle">{failed ? 'Sin datos' : c.hint}</span>
            ) : (
              <span className="tabular whitespace-nowrap pb-1 text-[1.75rem] font-bold leading-8 text-fg-warm">{c.value}</span>
            )}
            {!loading && !failed && c.value != null && <span className="sr-only">{c.hint}</span>}
          </div>
        )
      })}
    </div>
  )
}
